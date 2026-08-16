import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { db, generateUUID } from '../db/app-db';
import { DietLog, DietMeal, DietLogItem, DietMealDetail } from '../models/fitsync.models';
import { logger } from '../utils/logger';
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
    // Al costruttore, l'autenticazione Supabase non si è ancora risolta: currentUserId
    // restituisce LOCAL_USER_ID finché client.auth.getUser() non completa. Questa
    // sottoscrizione è l'unico punto che aspetta esplicitamente una pull di rete: quando
    // l'utente reale viene riconosciuto (o cambia), scarica i dati aggiornati una volta,
    // poi ricarica dal locale. loadLogForDate() da sola non tocca più la rete (vedi sotto),
    // quindi senza questo la vista resterebbe agganciata ai dati "locali" pre-login per sempre.
    this.supabaseService.currentUser$
      .pipe(distinctUntilChanged((a, b) => (a?.id || null) === (b?.id || null)))
      .subscribe(async () => {
        const userId = this.supabaseService.currentUserId;
        if (navigator.onLine && this.supabaseService.isConfigured && userId !== LOCAL_USER_ID) {
          try {
            await this.syncService.pullRemoteData();
          } catch (e) {
            logger.warn('FitSync DietService: pull dei dati remoti non completato:', e);
          }
        }
        this.loadLogForDate(this.selectedDateSubject.value);
      });
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

    // Legge sempre e solo dal locale (Dexie) — niente pull bloccante qui: la pull di rete
    // avviene una volta al riconoscimento dell'utente (vedi costruttore), dopo ogni mutazione
    // e alla riconnessione (via syncService.enqueue/syncNow). Lancia comunque una sync in
    // background (non attesa) per tenere i dati ragionevolmente freschi senza far aspettare
    // la UI ad ogni cambio data.
    if (isOnline && userId && userId !== LOCAL_USER_ID) {
      this.syncService.syncNow();
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
      await this.syncService.enqueue('diet_logs', 'INSERT', { ...log });

      // Copia la struttura dei pasti (nome + ordine, non gli alimenti) dall'ultimo giorno
      // precedente registrato, qualunque sia la sua data. Se non esiste nessun giorno
      // precedente (primo utilizzo in assoluto), il nuovo giorno resta senza pasti.
      const priorLogs = await db.dietLogs
        .where('user_id').equals(userId)
        .filter(l => l.date < dateStr)
        .toArray();

      if (priorLogs.length > 0) {
        priorLogs.sort((a, b) => b.date.localeCompare(a.date));
        const priorLog = priorLogs[0];
        const priorMeals = await db.dietMeals.where({ diet_log_id: priorLog.id }).sortBy('order_index');

        for (const pm of priorMeals) {
          const carriedMeal: DietMeal = {
            id: generateUUID(),
            user_id: userId,
            diet_log_id: log.id,
            name: pm.name,
            order_index: pm.order_index
          };
          await db.dietMeals.add(carriedMeal);
          await this.syncService.enqueue('diet_meals', 'INSERT', { ...carriedMeal });
        }
      }
    }

    // Load meals & items
    const meals = await db.dietMeals.where({ diet_log_id: log.id }).sortBy('order_index');
    const mealDetails: DietMealDetail[] = [];

    for (const meal of meals) {
      const items = await db.dietLogItems.where({ meal_id: meal.id }).toArray();
      const totals = items.reduce((acc, item) => {
        acc.calories += item.calories || 0;
        acc.protein += item.protein || 0;
        acc.carbs += item.carbs || 0;
        acc.fat += item.fat || 0;
        return acc;
      }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

      mealDetails.push({
        ...meal,
        items,
        total_calories: totals.calories,
        total_protein: totals.protein,
        total_carbs: totals.carbs,
        total_fat: totals.fat
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
    await this.syncService.enqueue('diet_meals', 'INSERT', { ...newMeal });
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

  async addFoodItem(
    mealId: string,
    name: string,
    calories: number,
    amountNote?: string,
    protein: number = 0,
    carbs: number = 0,
    fat: number = 0
  ): Promise<void> {
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
      protein: Math.max(0, Number(protein) || 0),
      carbs: Math.max(0, Number(carbs) || 0),
      fat: Math.max(0, Number(fat) || 0),
      created_at: new Date().toISOString()
    };

    await db.dietLogItems.add(newItem);
    await this.syncService.enqueue('diet_log_items', 'INSERT', { ...newItem });
    await this.loadLogForDate(currentLog.date);
  }

  /**
   * Aggiunge un alimento scelto dal catalogo. Calorie/macro vengono calcolate una sola
   * volta (snapshot) da foods.*_100g × quantityGrams/100 e salvate sulla riga: una futura
   * correzione dei valori nel catalogo non altera retroattivamente i log già registrati.
   */
  async addFoodItemFromCatalog(mealId: string, foodId: string, quantityGrams: number): Promise<void> {
    const currentLog = this.activeLogSubject.value;
    if (!currentLog) return;

    const food = await db.foods.get(foodId);
    if (!food) return;

    const grams = Math.max(0, Number(quantityGrams) || 0);
    const factor = grams / 100;

    const userId = this.supabaseService.currentUserId;
    const newItem: DietLogItem = {
      id: generateUUID(),
      user_id: userId,
      meal_id: mealId,
      name: food.name,
      calories: Math.round(food.kcal_100g * factor),
      amount_note: `${grams}g`,
      food_id: food.id,
      quantity_grams: grams,
      protein: Math.round(food.protein_100g * factor * 10) / 10,
      carbs: Math.round(food.carbs_100g * factor * 10) / 10,
      fat: Math.round(food.fat_100g * factor * 10) / 10,
      created_at: new Date().toISOString()
    };

    await db.dietLogItems.add(newItem);
    await this.syncService.enqueue('diet_log_items', 'INSERT', { ...newItem });
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
