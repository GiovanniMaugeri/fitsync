import { Injectable } from '@angular/core';
import { db, generateUUID } from '../db/app-db';
import { Exercise } from '../models/fitsync.models';
import { SupabaseService } from './supabase.service';
import { SyncService } from './sync.service';

@Injectable({
  providedIn: 'root'
})
export class ExerciseService {
  constructor(
    private supabaseService: SupabaseService,
    private syncService: SyncService
  ) {}

  async getAllExercises(): Promise<Exercise[]> {
    const currentUserId = this.supabaseService.currentUserId;
    const all = await db.exercises.toArray();
    return all.filter(ex => {
      // Esercizi di default del sistema (non custom)
      if (!ex.is_custom) return true;
      // Esercizi custom pubblici (visibili a tutti durante la creazione delle schede)
      if (ex.is_public !== false) return true;
      // Esercizi custom privati (visibili solo al creatore)
      return ex.user_id === currentUserId;
    });
  }

  async getExerciseById(id: string): Promise<Exercise | undefined> {
    return await db.exercises.get(id);
  }

  async getExercisesByCategory(category: string): Promise<Exercise[]> {
    const all = await this.getAllExercises();
    return all.filter(ex => ex.category.toLowerCase() === category.toLowerCase());
  }

  async createCustomExercise(name: string, category: string, equipment?: string, isPublic: boolean = false): Promise<Exercise> {
    const userId = this.supabaseService.currentUserId;
    const newExercise: Exercise = {
      id: generateUUID(),
      user_id: userId,
      name,
      category,
      equipment: equipment || 'Corpo Libero',
      is_custom: true,
      is_public: isPublic,
      created_at: new Date().toISOString()
    };

    await db.exercises.add(newExercise);
    await this.syncService.enqueue('exercises', 'INSERT', { ...newExercise });
    return newExercise;
  }
}
