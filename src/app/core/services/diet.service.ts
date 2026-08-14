import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { db, generateUUID } from '../db/app-db';
import { DietLog, DietMeal, DietLogItem, DietMealDetail } from '../models/fitsync.models';
import { SupabaseService, LOCAL_USER_ID } from './supabase.service';
import { SyncService } from './sync.service';

@Injectable({
  providedIn: 'root'
})
export class DietService {
  private selectedDateSubject = new BehaviorSubject<string>(this.getTodayDateString());
  selectedDate$ = this.selectedDateSubject.asObservable();

  private activeLogSubject = new BehaviorSubject<DietLog | null>(null);
  activeLog$ = this.activeLogSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private syncService: SyncService
  ) {
    this.loadLogForDate(this.selectedDateSubject.value);
  }

  getTodayDateString(): string {
    const today = new Date();
    return this.formatDate(today);
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  setDate(dateStr: string) {
    this.selectedDateSubject.next(dateStr);
    this.loadLogForDate(dateStr);
  }

  async clearLocalDietData(): Promise<void> {
    await db.dietLogItems.clear();
    await db.dietMeals.clear();
    await db.dietLogs.clear();

    const queue = await db.syncQueue.toArray();
    const dietQueue = queue.filter(q => ['diet_logs', 'diet_meals', 'diet_log_items'].includes(q.table_name)).map(q => q.id);
    if (dietQueue.length > 0) {
      await db.syncQueue.bulkDelete(dietQueue);
    }

    await this.loadLogForDate(this.selectedDateSubject.value);
  }

  async loadLogForDate(dateStr: string): Promise<DietLog> {
    const userId = this.supabaseService.currentUserId;
    const isOnline = navigator.onLine && this.supabaseService.isConfigured;

    // Se l'utente è online ed autenticato su Supabase, effettua prima il pull dei dati remoti
    if (isOnline && userId && userId !== LOCAL_USER_ID) {
      try {
        await this.syncService.pullRemoteData();
      } catch (e) {
        console.warn('FitSync DietService: pull dei dati remoti non completato:', e);
      }
    }

    let log = await db.dietLogs.where('user_id').equals(userId).filter(l => l.date === dateStr).first();

    if (!log) {
      log = {
        id: generateUUID(),
        user_id: userId,
        date: dateStr,
        target_calories: 2000,
        created_at: new Date().toISOString()
      };
      await db.dietLogs.add(log);
      await this.syncService.enqueue('diet_logs', 'INSERT', log);
    }

    // Load meals & items
    const meals = await db.dietMeals.where({ diet_log_id: log.id }).sortBy('order_index');
    const mealDetails: DietMealDetail[] = [];

    for (const meal of meals) {
      const items = await db.dietLogItems.where({ meal_id: meal.id }).toArray();
      const totalCalories = items.reduce((sum, item) => sum + (item.calories || 0), 0);
      mealDetails.push({
        ...meal,
        items,
        total_calories: totalCalories
      });
    }

    const fullLog: DietLog = {
      ...log,
      meals: mealDetails
    };

    this.activeLogSubject.next(fullLog);
    return fullLog;
  }

  async addMeal(name: string): Promise<void> {
    const currentLog = this.activeLogSubject.value;
    if (!currentLog) return;

    const userId = this.supabaseService.currentUserId;
    const existingMeals = currentLog.meals || [];
    const newMeal: DietMeal = {
      id: generateUUID(),
      user_id: userId,
      diet_log_id: currentLog.id,
      name: name.trim(),
      order_index: existingMeals.length
    };

    await db.dietMeals.add(newMeal);
    await this.syncService.enqueue('diet_meals', 'INSERT', newMeal);
    await this.loadLogForDate(currentLog.date);
  }

  async deleteMeal(mealId: string): Promise<void> {
    const currentLog = this.activeLogSubject.value;
    if (!currentLog) return;

    const items = await db.dietLogItems.where({ meal_id: mealId }).toArray();
    for (const item of items) {
      await this.syncService.enqueue('diet_log_items', 'DELETE', { id: item.id });
    }

    await db.dietLogItems.where({ meal_id: mealId }).delete();
    await db.dietMeals.delete(mealId);
    await this.syncService.enqueue('diet_meals', 'DELETE', { id: mealId });

    await this.loadLogForDate(currentLog.date);
  }

  async addFoodItem(mealId: string, name: string, calories: number, amountNote?: string): Promise<void> {
    const currentLog = this.activeLogSubject.value;
    if (!currentLog) return;

    const userId = this.supabaseService.currentUserId;
    const newItem: DietLogItem = {
      id: generateUUID(),
      user_id: userId,
      meal_id: mealId,
      name: name.trim(),
      calories: Math.max(0, Number(calories) || 0),
      amount_note: amountNote ? amountNote.trim() : undefined,
      created_at: new Date().toISOString()
    };

    await db.dietLogItems.add(newItem);
    await this.syncService.enqueue('diet_log_items', 'INSERT', newItem);
    await this.loadLogForDate(currentLog.date);
  }

  async deleteFoodItem(itemId: string): Promise<void> {
    const currentLog = this.activeLogSubject.value;
    if (!currentLog) return;

    await db.dietLogItems.delete(itemId);
    await this.syncService.enqueue('diet_log_items', 'DELETE', { id: itemId });
    await this.loadLogForDate(currentLog.date);
  }

  async updateTargetCalories(targetCalories: number): Promise<void> {
    const currentLog = this.activeLogSubject.value;
    if (!currentLog) return;

    const newTarget = Math.max(500, Number(targetCalories) || 2000);
    await db.dietLogs.update(currentLog.id, { target_calories: newTarget });
    await this.syncService.enqueue('diet_logs', 'UPDATE', { id: currentLog.id, target_calories: newTarget });
    await this.loadLogForDate(currentLog.date);
  }

  async getRecentHistory(limitDays: number = 30): Promise<{ date: string; total_calories: number; target_calories: number; meal_count: number }[]> {
    const userId = this.supabaseService.currentUserId;
    const logs = await db.dietLogs.where('user_id').equals(userId).toArray();
    logs.sort((a, b) => b.date.localeCompare(a.date));
    const recentLogs = logs.slice(0, limitDays);
    const history = [];

    for (const log of recentLogs) {
      const meals = await db.dietMeals.where({ diet_log_id: log.id }).toArray();
      let totalCal = 0;

      for (const meal of meals) {
        const items = await db.dietLogItems.where({ meal_id: meal.id }).toArray();
        totalCal += items.reduce((sum, item) => sum + (item.calories || 0), 0);
      }

      history.push({
        date: log.date,
        total_calories: totalCal,
        target_calories: log.target_calories || 2000,
        meal_count: meals.length
      });
    }

    return history;
  }

  async deleteDietLogByDate(dateStr: string): Promise<void> {
    const userId = this.supabaseService.currentUserId;
    const logs = await db.dietLogs.where('user_id').equals(userId).toArray();
    const log = logs.find(l => l.date === dateStr);
    if (log) {
      const meals = await db.dietMeals.where({ diet_log_id: log.id }).toArray();
      for (const meal of meals) {
        const items = await db.dietLogItems.where({ meal_id: meal.id }).toArray();
        for (const item of items) {
          await this.syncService.enqueue('diet_log_items', 'DELETE', { id: item.id });
        }
        await db.dietLogItems.where({ meal_id: meal.id }).delete();
        await this.syncService.enqueue('diet_meals', 'DELETE', { id: meal.id });
      }
      await db.dietMeals.where({ diet_log_id: log.id }).delete();
      await db.dietLogs.delete(log.id);
      await this.syncService.enqueue('diet_logs', 'DELETE', { id: log.id });

      // If deleted log was active, reload
      if (this.activeLogSubject.value && this.activeLogSubject.value.date === dateStr) {
        await this.loadLogForDate(dateStr);
      }
    }
  }
}
