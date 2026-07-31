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

    // Reagisce all'autenticazione dell'utente scaricando i dati reali dal database Supabase
    this.supabaseService.currentUser$.subscribe(user => {
      if (user) {
        console.log('FitSync Auth State Changed: Utente autenticato. Avvio sync e pull dal DB remoto Supabase...');
        this.syncNow();
      }
    });
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
      // 1. Ripristina eventuali elementi in stato ERROR in modo che possano essere riprovati con le correzioni del user_id
      const errorItems = await db.syncQueue.where('status').equals('ERROR').toArray();
      for (const errItem of errorItems) {
        await db.syncQueue.update(errItem.id, { status: 'PENDING', error_message: undefined });
      }

      const pendingItems = await db.syncQueue
        .where('status')
        .equals('PENDING')
        .toArray();

      // Ordiniamo le tabelle in base alle dipendenze di Foreign Key (genitori prima dei figli):
      // 1: exercises, 2: workout_templates, 3: template_exercises, 4: workout_sessions, 5: workout_sets
      const tablePriority: Record<string, number> = {
        'exercises': 1,
        'workout_templates': 2,
        'template_exercises': 3,
        'workout_sessions': 4,
        'workout_sets': 5
      };

      pendingItems.sort((a, b) => {
        const pA = tablePriority[a.table_name] || 99;
        const pB = tablePriority[b.table_name] || 99;
        if (pA !== pB) return pA - pB;
        return a.timestamp - b.timestamp;
      });

      const currentUserId = this.supabaseService.currentUserId;
      const isRealUser = currentUserId && currentUserId !== 'local-user-id';

      for (const item of pendingItems) {
        try {
          await db.syncQueue.update(item.id, { status: 'SYNCING' });

          // Se l'utente è autenticato su Supabase e l'oggetto richiede user_id, colleghiamo l'utente corrente
          if (isRealUser && item.payload && typeof item.payload === 'object') {
            if (['exercises', 'workout_templates', 'workout_sessions'].includes(item.table_name)) {
              if (!item.payload.user_id || item.payload.user_id === 'local-user-id') {
                item.payload.user_id = currentUserId;
              }
            }
          }

          let res: any;
          if (item.action === 'INSERT') {
            res = await client.from(item.table_name).upsert(item.payload);
          } else if (item.action === 'UPDATE') {
            res = await client.from(item.table_name).update(item.payload).eq('id', item.payload.id);
          } else if (item.action === 'DELETE') {
            res = await client.from(item.table_name).delete().eq('id', item.payload.id || item.payload);
          }

          // Fallback Failsafe: Se il DB Supabase remoto non possiede ancora la colonna 'is_public' (PGRST204), riproviamo omettendo is_public
          if (res?.error && (res.error.code === 'PGRST204' || res.error.message?.includes('is_public'))) {
            console.warn(`FitSync Sync Fallback: La colonna 'is_public' non è ancora presente su Supabase per '${item.table_name}'. Eseguo il caricamento senza il campo is_public...`);
            const fallbackPayload = { ...item.payload };
            delete fallbackPayload.is_public;

            if (item.action === 'INSERT') {
              res = await client.from(item.table_name).upsert(fallbackPayload);
            } else if (item.action === 'UPDATE') {
              res = await client.from(item.table_name).update(fallbackPayload).eq('id', fallbackPayload.id);
            }
          }

          if (res?.error) {
            console.error(`Sync error for item ${item.id} (${item.table_name}):`, res.error);
            await db.syncQueue.update(item.id, {
              status: 'ERROR',
              error_message: res.error.message
            });
          } else {
            console.log(`FitSync Sync: caricamento riuscito per elemento ${item.id} (${item.table_name})`);
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
      console.log('FitSync: Sincronizzazione ed allineamento dati con il DB Supabase...');

      // 1. Pull Exercises (Globali + Custom dell'utente)
      const { data: exercises, error: exErr } = await client.from('exercises').select('*');
      if (exErr) {
        console.warn('FitSync: Errore durante il pull degli esercizi da Supabase:', exErr);
      } else if (exercises) {
        const remoteIds = new Set(exercises.map(e => e.id));
        const localExercises = await db.exercises.toArray();
        const toDelete = localExercises.filter(e => !remoteIds.has(e.id)).map(e => e.id);
        if (toDelete.length > 0) {
          await db.exercises.bulkDelete(toDelete);
          console.log(`FitSync: Rimossi ${toDelete.length} esercizi locali eliminati dal DB remoto.`);
        }
        if (exercises.length > 0) {
          await db.exercises.bulkPut(exercises);
        }
      }

      // 2. Pull Templates (Pubbliche + dell'utente)
      let query = client.from('workout_templates').select('*');
      if (userId && userId !== 'local-user-id') {
        query = query.or(`is_public.eq.true,user_id.eq.${userId}`);
      } else {
        query = query.eq('is_public', true);
      }
      const { data: templates, error: tplErr } = await query;
      if (tplErr) {
        console.warn('FitSync: Errore durante il pull delle schede da Supabase:', tplErr);
      } else if (templates) {
        const pendingQueue = await db.syncQueue.toArray();
        const pendingTplIds = new Set(pendingQueue.filter(q => q.table_name === 'workout_templates').map(q => q.payload?.id));

        const remoteIds = new Set(templates.map(t => t.id));
        const localTemplates = await db.workoutTemplates.toArray();
        const toDelete = localTemplates.filter(t => !remoteIds.has(t.id) && !pendingTplIds.has(t.id) && t.user_id === userId).map(t => t.id);
        if (toDelete.length > 0) {
          await db.workoutTemplates.bulkDelete(toDelete);
          console.log(`FitSync: Rimosse ${toDelete.length} schede locali eliminate dal DB remoto.`);
        }
        if (templates.length > 0) {
          await db.workoutTemplates.bulkPut(templates);
        }
      }

      // 3. Pull Template Exercises
      const { data: tempExs, error: teErr } = await client.from('template_exercises').select('*');
      if (teErr) {
        console.warn('FitSync: Errore durante il pull degli esercizi scheda da Supabase:', teErr);
      } else if (tempExs) {
        const pendingQueue = await db.syncQueue.toArray();
        const pendingTeIds = new Set(pendingQueue.filter(q => q.table_name === 'template_exercises').map(q => q.payload?.id));

        const remoteIds = new Set(tempExs.map(te => te.id));
        const localTempExs = await db.templateExercises.toArray();
        const toDelete = localTempExs.filter(te => !remoteIds.has(te.id) && !pendingTeIds.has(te.id)).map(te => te.id);
        if (toDelete.length > 0) {
          await db.templateExercises.bulkDelete(toDelete);
        }
        if (tempExs.length > 0) {
          await db.templateExercises.bulkPut(tempExs);
        }
      }

      // 4. Pull Workout Sessions dell'utente
      if (userId && userId !== 'local-user-id') {
        const { data: sessions, error: sErr } = await client.from('workout_sessions').select('*').eq('user_id', userId);
        if (sErr) {
          console.warn('FitSync: Errore durante il pull delle sessioni da Supabase:', sErr);
        } else if (sessions) {
          const remoteIds = new Set(sessions.map(s => s.id));
          const localSessions = await db.workoutSessions.where('user_id').equals(userId).toArray();
          const toDelete = localSessions.filter(s => !remoteIds.has(s.id)).map(s => s.id);
          if (toDelete.length > 0) {
            await db.workoutSessions.bulkDelete(toDelete);
            console.log(`FitSync: Rimosse ${toDelete.length} sessioni locali eliminate dal DB remoto.`);
          }
          if (sessions.length > 0) {
            await db.workoutSessions.bulkPut(sessions);
          }
        }
      }

      // 5. Pull Workout Sets
      const { data: sets, error: setErr } = await client.from('workout_sets').select('*');
      if (setErr) {
        console.warn('FitSync: Errore durante il pull dei set da Supabase:', setErr);
      } else if (sets) {
        const remoteIds = new Set(sets.map(s => s.id));
        const localSets = await db.workoutSets.toArray();
        const toDelete = localSets.filter(s => !remoteIds.has(s.id)).map(s => s.id);
        if (toDelete.length > 0) {
          await db.workoutSets.bulkDelete(toDelete);
        }
        if (sets.length > 0) {
          await db.workoutSets.bulkPut(sets);
        }
      }

      console.log('FitSync: Allineamento completo ed eliminazioni sincronizzate dal DB remoto!');
    } catch (err) {
      console.warn('Errore durante il download dei dati remoti:', err);
    }
  }
}
