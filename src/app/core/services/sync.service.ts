import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { db } from '../db/app-db';
import { SyncQueueItem } from '../models/fitsync.models';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private isOnlineSubject = new BehaviorSubject<boolean>(navigator.onLine);
  public isOnline$: Observable<boolean> = this.isOnlineSubject.asObservable();

  private isSyncingSubject = new BehaviorSubject<boolean>(false);
  public isSyncing$: Observable<boolean> = this.isSyncingSubject.asObservable();

  private pendingCountSubject = new BehaviorSubject<number>(0);
  public pendingCount$: Observable<number> = this.pendingCountSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {
    this.initNetworkListeners();
    this.updatePendingCount();
  }

  private initNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Network connected. FitSync is ONLINE.');
      this.isOnlineSubject.next(true);
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      console.log('Network lost. FitSync is OFFLINE.');
      this.isOnlineSubject.next(false);
    });
  }

  public async updatePendingCount(): Promise<number> {
    const count = await db.syncQueue.where('status').equals('PENDING').count();
    this.pendingCountSubject.next(count);
    return count;
  }

  public async enqueue(
    tableName: SyncQueueItem['table_name'],
    action: SyncQueueItem['action'],
    payload: any
  ): Promise<string> {
    const queueItem: SyncQueueItem = {
      id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
      table_name: tableName,
      action: action,
      payload: payload,
      timestamp: Date.now(),
      status: 'PENDING'
    };

    await db.syncQueue.add(queueItem);
    await this.updatePendingCount();

    if (this.isOnlineSubject.value && this.supabaseService.isConfigured) {
      this.syncNow();
    }

    return queueItem.id;
  }

  public async syncNow(): Promise<void> {
    if (!this.isOnlineSubject.value || !this.supabaseService.isConfigured) {
      return;
    }

    const client = this.supabaseService.supabase;
    if (!client) return;

    this.isSyncingSubject.next(true);

    try {
      const pendingItems = await db.syncQueue
        .where('status')
        .equals('PENDING')
        .sortBy('timestamp');

      for (const item of pendingItems) {
        try {
          await db.syncQueue.update(item.id, { status: 'SYNCING' });

          let res: any;
          if (item.action === 'INSERT') {
            res = await client.from(item.table_name).upsert(item.payload);
          } else if (item.action === 'UPDATE') {
            res = await client.from(item.table_name).update(item.payload).eq('id', item.payload.id);
          } else if (item.action === 'DELETE') {
            res = await client.from(item.table_name).delete().eq('id', item.payload.id || item.payload);
          }

          if (res?.error) {
            console.error(`Sync error for item ${item.id}:`, res.error);
            await db.syncQueue.update(item.id, {
              status: 'ERROR',
              error_message: res.error.message
            });
          } else {
            await db.syncQueue.delete(item.id);
          }
        } catch (err: any) {
          console.error(`Execution error syncing item ${item.id}:`, err);
          await db.syncQueue.update(item.id, {
            status: 'ERROR',
            error_message: err?.message || 'Unknown error'
          });
        }
      }

      await this.pullRemoteData();
    } finally {
      await this.updatePendingCount();
      this.isSyncingSubject.next(false);
    }
  }

  public async pullRemoteData(): Promise<void> {
    const client = this.supabaseService.supabase;
    if (!client || !this.isOnlineSubject.value) return;

    const userId = this.supabaseService.currentUserId;

    try {
      // 1. Pull Exercises
      const { data: exercises } = await client.from('exercises').select('*');
      if (exercises && exercises.length > 0) {
        await db.exercises.bulkPut(exercises);
      }

      // 2. Pull Templates
      const { data: templates } = await client.from('workout_templates').select('*').eq('user_id', userId);
      if (templates && templates.length > 0) {
        await db.workoutTemplates.bulkPut(templates);
      }

      // 3. Pull Template Exercises
      const { data: tempExs } = await client.from('template_exercises').select('*');
      if (tempExs && tempExs.length > 0) {
        await db.templateExercises.bulkPut(tempExs);
      }

      // 4. Pull Workout Sessions
      const { data: sessions } = await client.from('workout_sessions').select('*').eq('user_id', userId);
      if (sessions && sessions.length > 0) {
        await db.workoutSessions.bulkPut(sessions);
      }

      // 5. Pull Workout Sets
      const { data: sets } = await client.from('workout_sets').select('*');
      if (sets && sets.length > 0) {
        await db.workoutSets.bulkPut(sets);
      }
    } catch (err) {
      console.warn('Error pulling remote data:', err);
    }
  }
}
