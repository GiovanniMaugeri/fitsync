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
    return await db.exercises.toArray();
  }

  async getExerciseById(id: string): Promise<Exercise | undefined> {
    return await db.exercises.get(id);
  }

  async getExercisesByCategory(category: string): Promise<Exercise[]> {
    return await db.exercises.where('category').equalsIgnoreCase(category).toArray();
  }

  async createCustomExercise(name: string, category: string, equipment?: string): Promise<Exercise> {
    const userId = this.supabaseService.currentUserId;
    const newExercise: Exercise = {
      id: generateUUID(),
      user_id: userId,
      name,
      category,
      equipment: equipment || 'Corpo Libero',
      is_custom: true,
      created_at: new Date().toISOString()
    };

    await db.exercises.add(newExercise);
    await this.syncService.enqueue('exercises', 'INSERT', newExercise);
    return newExercise;
  }
}
