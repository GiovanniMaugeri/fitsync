import { Injectable } from '@angular/core';
import { db, generateUUID } from '../db/app-db';
import { WorkoutTemplate, TemplateExercise, TemplateExerciseDetail } from '../models/fitsync.models';
import { SupabaseService } from './supabase.service';
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
    const templates = await db.workoutTemplates.toArray();
    for (const t of templates) {
      t.exercises = await this.getTemplateExercises(t.id);
    }
    return templates;
  }

  async getTemplateById(id: string): Promise<WorkoutTemplate | undefined> {
    const template = await db.workoutTemplates.get(id);
    if (template) {
      template.exercises = await this.getTemplateExercises(template.id);
    }
    return template;
  }

  async getTemplateExercises(templateId: string): Promise<TemplateExerciseDetail[]> {
    const items = await db.templateExercises
      .where('template_id')
      .equals(templateId)
      .sortBy('order_index');

    const result: TemplateExerciseDetail[] = [];
    for (const item of items) {
      const exercise = await db.exercises.get(item.exercise_id);
      result.push({
        ...item,
        exercise
      });
    }
    return result;
  }

  async saveTemplate(
    templateId: string | null,
    name: string,
    description: string,
    exercisesList: { exercise_id: string; target_sets: number; target_reps: number; rest_time_seconds: number }[]
  ): Promise<WorkoutTemplate> {
    const userId = this.supabaseService.currentUserId;
    const now = new Date().toISOString();

    const id = templateId || generateUUID();

    const template: WorkoutTemplate = {
      id,
      user_id: userId,
      name,
      description,
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
