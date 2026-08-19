import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import { db, generateUUID } from '../db/app-db';
import { BodyWeightLog } from '../models/fitsync.models';
import { logger } from '../utils/logger';
import { SupabaseService, LOCAL_USER_ID } from './supabase.service';
import { SyncService } from './sync.service';

@Injectable({
  providedIn: 'root'
})
export class WeightService {
  private historySubject = new BehaviorSubject<BodyWeightLog[]>([]);
  history$ = this.historySubject.asObservable();

  private selectedDateSubject = new BehaviorSubject<string>(this.getTodayDateString());
  selectedDate$ = this.selectedDateSubject.asObservable();

  private selectedEntrySubject = new BehaviorSubject<BodyWeightLog | null>(null);
  selectedEntry$ = this.selectedEntrySubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private syncService: SyncService
  ) {
    this.supabaseService.currentUser$
      .pipe(distinctUntilChanged((a, b) => (a?.id || null) === (b?.id || null)))
      .subscribe(async () => {
        const userId = this.supabaseService.currentUserId;
        if (navigator.onLine && this.supabaseService.isConfigured && userId !== LOCAL_USER_ID) {
          try {
            await this.syncService.pullRemoteData();
          } catch (e) {
            logger.warn('FitSync WeightService: pull dei dati remoti non completato:', e);
          }
        }
        this.loadAll();
      });
  }

  getTodayDateString(): string {
    return this.formatDate(new Date());
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Cambia il giorno selezionato per l'inserimento senza rileggere Dexie: history$ contiene già tutte le date. */
  setDate(dateStr: string): void {
    this.selectedDateSubject.next(dateStr);
    const logs = this.historySubject.value;
    this.selectedEntrySubject.next(logs.find(l => l.date === dateStr) || null);
  }

  async loadAll(): Promise<void> {
    const userId = this.supabaseService.currentUserId;
    const isOnline = navigator.onLine && this.supabaseService.isConfigured;

    if (isOnline && userId && userId !== LOCAL_USER_ID) {
      this.syncService.syncNow();
    }

    const logs = await db.bodyWeightLogs.where('user_id').equals(userId).toArray();
    logs.sort((a, b) => b.date.localeCompare(a.date));

    this.historySubject.next(logs);
    const selectedStr = this.selectedDateSubject.value;
    this.selectedEntrySubject.next(logs.find(l => l.date === selectedStr) || null);
  }

  /**
   * Get-or-create per il peso del giorno selezionato: se esiste già una riga per quella
   * data ne aggiorna il valore, altrimenti ne crea una nuova. Un solo peso al giorno per
   * utente (mirror del comportamento diet_logs, vincolo UNIQUE(user_id, date) anche lato
   * Postgres).
   */
  async saveWeight(weightKg: number): Promise<void> {
    const userId = this.supabaseService.currentUserId;
    const value = Math.round(Math.max(20, Math.min(400, Number(weightKg) || 0)) * 100) / 100;
    if (!value) return;

    const dateStr = this.selectedDateSubject.value;
    const existing = await db.bodyWeightLogs.where('user_id').equals(userId).filter(l => l.date === dateStr).first();

    if (existing) {
      await db.bodyWeightLogs.update(existing.id, { weight_kg: value });
      await this.syncService.enqueue('body_weight_logs', 'UPDATE', { id: existing.id, weight_kg: value });
    } else {
      const newLog: BodyWeightLog = {
        id: generateUUID(),
        user_id: userId,
        date: dateStr,
        weight_kg: value,
        created_at: new Date().toISOString()
      };
      await db.bodyWeightLogs.add(newLog);
      await this.syncService.enqueue('body_weight_logs', 'INSERT', { ...newLog });
    }

    await this.loadAll();
  }

  async deleteEntry(id: string): Promise<void> {
    await db.bodyWeightLogs.delete(id);
    await this.syncService.enqueue('body_weight_logs', 'DELETE', { id });
    await this.loadAll();
  }

  /** Pesi nell'intervallo [fromDate, toDate] (incluso), ordinati per data crescente — un elemento per ogni giorno che ha effettivamente una registrazione. */
  async getWeightsInRange(fromDate: string, toDate: string): Promise<{ date: string; weight_kg: number }[]> {
    const userId = this.supabaseService.currentUserId;
    const logs = await db.bodyWeightLogs
      .where('user_id').equals(userId)
      .filter(l => l.date >= fromDate && l.date <= toDate)
      .toArray();

    logs.sort((a, b) => a.date.localeCompare(b.date));
    return logs.map(l => ({ date: l.date, weight_kg: l.weight_kg }));
  }
}
