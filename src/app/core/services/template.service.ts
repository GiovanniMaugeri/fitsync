import { Injectable } from '@angular/core';
import { db, generateUUID, fetchRemoteRow, fetchRemoteRows } from '../db/app-db';
import { WorkoutTemplate, TemplateExercise, TemplateExerciseDetail } from '../models/fitsync.models';
import { SupabaseService, LOCAL_USER_ID } from './supabase.service';
import { SyncService } from './sync.service';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  constructor(
    private supabaseService: SupabaseService,
    private syncService: SyncService
  ) {}

  async getTemplates(): Promise<WorkoutTemplate[]> {
    const currentUserId = this.supabaseService.currentUserId;
    const client = this.supabaseService.supabase;

    // Se l'utente è autenticato su Supabase, allineiamo le schede pubbliche + le proprie schede da remoto
    if (client && currentUserId && currentUserId !== LOCAL_USER_ID) {
      try {
        const { data: remoteTemplates, error } = await client
          .from('workout_templates')
          .select('*')
          .or(`is_public.eq.true,user_id.eq.${currentUserId}`);

        if (!error && remoteTemplates && remoteTemplates.length > 0) {
          await db.workoutTemplates.bulkPut(remoteTemplates);

          const templateIds = remoteTemplates.map(t => t.id);
          const { data: remoteExercises } = await client
            .from('template_exercises')
            .select('*')
            .in('template_id', templateIds);

          if (remoteExercises && remoteExercises.length > 0) {
            await db.templateExercises.bulkPut(remoteExercises);
          }
        }
      } catch (err) {
        console.warn('FitSync: Allineamento remoto schede pubbliche:', err);
      }
    }

    const all = await db.workoutTemplates.toArray();
    const visible = all.filter(t => {
      // Schede pubbliche (is_public !== false)
      if (t.is_public !== false) return true;
      // Schede private: visibili solo al creatore o schede create in locale
      return !t.user_id || t.user_id === LOCAL_USER_ID || t.user_id === currentUserId;
    });
    for (const t of visible) {
      t.exercises = await this.getTemplateExercises(t.id);
    }
    return visible;
  }

  async getTemplateById(id: string): Promise<WorkoutTemplate | undefined> {
    const template = await db.workoutTemplates.get(id);
    if (template) {
      template.exercises = await this.getTemplateExercises(template.id);
    }
    return template;
  }

  async getTemplateExercises(templateId: string): Promise<TemplateExerciseDetail[]> {
    let items = await db.templateExercises
      .where('template_id')
      .equals(templateId)
      .sortBy('order_index');

    // Se in locale non ci sono esercizi per questa scheda (es. scheda pubblica di altro utente),
    // proviamo a recuperarli direttamente da Supabase
    const client = this.supabaseService.supabase;
    if (items.length === 0 && client && this.supabaseService.currentUserId && this.supabaseService.currentUserId !== LOCAL_USER_ID) {
      const remoteItems = await fetchRemoteRows(client, 'template_exercises', 'template_id', templateId, db.templateExercises, 'order_index');
      if (remoteItems.length > 0) {
        items = remoteItems;
      }
    }

    const result: TemplateExerciseDetail[] = [];
    for (const item of items) {
      let exercise = await db.exercises.get(item.exercise_id);

      // Se l'esercizio non è presente nel DB locale IndexedDB, lo cerchiamo da Supabase
      if (!exercise && client && this.supabaseService.currentUserId && this.supabaseService.currentUserId !== LOCAL_USER_ID) {
        exercise = await fetchRemoteRow(client, 'exercises', 'id', item.exercise_id, db.exercises);
      }

      result.push({
        ...item,
        exercise: exercise || {
          id: item.exercise_id,
          name: 'Esercizio',
          category: 'Generale',
          equipment: 'Varie',
          is_custom: false,
          is_public: true
        }
      });
    }
    return result;
  }

  async saveTemplate(
    templateId: string | null,
    name: string,
    description: string,
    exercisesList: { exercise_id: string; target_sets: number; target_reps: number; rest_time_seconds: number }[],
    isPublic: boolean = true
  ): Promise<WorkoutTemplate> {
    const userId = this.supabaseService.currentUserId;
    const now = new Date().toISOString();

    const id = templateId || generateUUID();

    const template: WorkoutTemplate = {
      id,
      user_id: userId,
      name,
      description,
      is_public: isPublic,
      created_at: templateId ? undefined : now,
      updated_at: now
    };

    if (templateId) {
      await db.workoutTemplates.put(template);
      await this.syncService.enqueue('workout_templates', 'UPDATE', template);
      // Delete existing template_exercises in local db
      const existingItems = await db.templateExercises.where('template_id').equals(templateId).toArray();
      for (const item of existingItems) {
        await db.templateExercises.delete(item.id);
        await this.syncService.enqueue('template_exercises', 'DELETE', { id: item.id });
      }
    } else {
      await db.workoutTemplates.add(template);
      await this.syncService.enqueue('workout_templates', 'INSERT', template);
    }

    // Add new template exercises
    for (let index = 0; index < exercisesList.length; index++) {
      const item = exercisesList[index];
      const tempEx: TemplateExercise = {
        id: generateUUID(),
        template_id: id,
        exercise_id: item.exercise_id,
        order_index: index + 1,
        target_sets: item.target_sets,
        target_reps: item.target_reps,
        rest_time_seconds: item.rest_time_seconds
      };
      await db.templateExercises.add(tempEx);
      await this.syncService.enqueue('template_exercises', 'INSERT', tempEx);
    }

    template.exercises = await this.getTemplateExercises(id);
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.workoutTemplates.delete(id);
    await this.syncService.enqueue('workout_templates', 'DELETE', { id });
    
    const items = await db.templateExercises.where('template_id').equals(id).toArray();
    for (const item of items) {
      await db.templateExercises.delete(item.id);
      await this.syncService.enqueue('template_exercises', 'DELETE', { id: item.id });
    }
  }
}
