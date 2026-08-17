import { Injectable } from '@angular/core';
import { db, generateUUID } from '../db/app-db';
import { Food } from '../models/fitsync.models';
import { SupabaseService } from './supabase.service';
import { SyncService } from './sync.service';

@Injectable({
  providedIn: 'root'
})
export class FoodService {
  constructor(
    private supabaseService: SupabaseService,
    private syncService: SyncService
  ) {}

  async getAllFoods(): Promise<Food[]> {
    const currentUserId = this.supabaseService.currentUserId;
    const all = await db.foods.toArray();
    return all.filter(f => {
      // Alimenti di default del catalogo (non custom)
      if (!f.is_custom) return true;
      // Alimenti custom pubblici (visibili a tutti)
      if (f.is_public !== false) return true;
      // Alimenti custom privati (visibili solo al creatore)
      return f.user_id === currentUserId;
    });
  }

  async getFoodById(id: string): Promise<Food | undefined> {
    return await db.foods.get(id);
  }

  async findByBarcode(barcode: string): Promise<Food | undefined> {
    return await db.foods.where('barcode').equals(barcode).first();
  }

  canDeleteCustomFood(food: Food): boolean {
    return food.is_custom === true && food.user_id === this.supabaseService.currentUserId;
  }

  async deleteCustomFood(id: string): Promise<void> {
    await db.foods.delete(id);
    await this.syncService.enqueue('foods', 'DELETE', { id });
  }

  async updateCustomFood(
    food: Food,
    updates: { name: string; kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number }
  ): Promise<Food> {
    const trimmedName = updates.name.trim();
    const patch: Partial<Food> = {
      name: trimmedName,
      kcal_100g: Math.max(0, Number(updates.kcal_100g) || 0),
      protein_100g: Math.max(0, Number(updates.protein_100g) || 0),
      carbs_100g: Math.max(0, Number(updates.carbs_100g) || 0),
      fat_100g: Math.max(0, Number(updates.fat_100g) || 0)
    };
    if (trimmedName !== food.name && !food.original_name) {
      patch.original_name = food.name;
    }

    await db.foods.update(food.id, patch);
    await this.syncService.enqueue('foods', 'UPDATE', { id: food.id, ...patch });
    return { ...food, ...patch };
  }

  async createCustomFood(
    name: string,
    kcal_100g: number,
    protein_100g: number,
    carbs_100g: number,
    fat_100g: number,
    isPublic: boolean = false,
    barcode?: string
  ): Promise<Food> {
    const userId = this.supabaseService.currentUserId;
    const newFood: Food = {
      id: generateUUID(),
      user_id: userId,
      name: name.trim(),
      is_custom: true,
      is_public: isPublic,
      kcal_100g: Math.max(0, Number(kcal_100g) || 0),
      protein_100g: Math.max(0, Number(protein_100g) || 0),
      carbs_100g: Math.max(0, Number(carbs_100g) || 0),
      fat_100g: Math.max(0, Number(fat_100g) || 0),
      barcode: barcode ?? null,
      created_at: new Date().toISOString()
    };

    await db.foods.add(newFood);
    await this.syncService.enqueue('foods', 'INSERT', { ...newFood });
    return newFood;
  }

  /**
   * Alimenti più usati storicamente in pasti con lo stesso nome (case-insensitive/trim),
   * calcolato al volo su dietMeals + dietLogItems — nessuna tabella di statistiche dedicata.
   */
  async getFrequentFoodsForMeal(mealName: string, limit: number = 5): Promise<Food[]> {
    const target = mealName.trim().toLowerCase();
    if (!target) return [];

    const allMeals = await db.dietMeals.toArray();
    const mealIds = allMeals
      .filter(m => m.name.trim().toLowerCase() === target)
      .map(m => m.id);
    if (mealIds.length === 0) return [];

    const items = await db.dietLogItems.where('meal_id').anyOf(mealIds).toArray();

    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.food_id) continue;
      counts.set(item.food_id, (counts.get(item.food_id) || 0) + 1);
    }
    if (counts.size === 0) return [];

    const rankedIds = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([foodId]) => foodId);

    const foods = await db.foods.bulkGet(rankedIds);
    return foods.filter((f): f is Food => !!f);
  }
}
