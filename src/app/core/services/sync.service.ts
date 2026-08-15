import { Injectable, signal } from '@angular/core';
import { PostgrestError } from '@supabase/supabase-js';
import { db } from '../db/app-db';
import { SyncQueueItem } from '../models/fitsync.models';
import { SupabaseService, LOCAL_USER_ID } from './supabase.service';
import { logger } from '../utils/logger';

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  public isOnline = signal<boolean>(navigator.onLine);
  public isSyncing = signal<boolean>(false);
  public pendingCount = signal<number>(0);

  private static readonly RETRY_BASE_DELAY_MS = 30_000;
  private static readonly RETRY_MAX_DELAY_MS = 30 * 60_000;
  private static readonly RETRY_TIMER_INTERVAL_MS = 5 * 60_000;

  constructor(private supabaseService: SupabaseService) {
    this.initNetworkListeners();
    this.updatePendingCount();

    // Retry periodico degli item in ERROR il cui backoff è scaduto, anche senza un trigger esterno (enqueue/online/login)
    setInterval(() => {
      if (this.isOnline()) {
        this.syncNow();
      }
    }, SyncService.RETRY_TIMER_INTERVAL_MS);

    // Reagisce all'autenticazione dell'utente scaricando i dati reali dal database Supabase
    this.supabaseService.currentUser$.subscribe(user => {
      if (user) {
        logger.log('FitSync Auth State Changed: Utente autenticato. Avvio sync e pull dal DB remoto Supabase...');
        this.syncNow();
      }
    });
  }

  /** Calcola il prossimo istante di retry con backoff esponenziale (30s, 1m, 2m, 4m... cap 30min) */
  private async markError(itemId: string, retryCountSoFar: number, message: string | undefined): Promise<void> {
    const delayMs = Math.min(SyncService.RETRY_BASE_DELAY_MS * Math.pow(2, retryCountSoFar), SyncService.RETRY_MAX_DELAY_MS);
    await db.syncQueue.update(itemId, {
      status: 'ERROR',
      error_message: message,
      retry_count: retryCountSoFar + 1,
      next_retry_at: Date.now() + delayMs
    });
  }

  private initNetworkListeners() {
    window.addEventListener('online', () => {
      logger.log('Network connected. FitSync is ONLINE.');
      this.isOnline.set(true);
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      logger.log('Network lost. FitSync is OFFLINE.');
      this.isOnline.set(false);
    });
  }

  public async updatePendingCount(): Promise<number> {
    const count = await db.syncQueue.where('status').equals('PENDING').count();
    this.pendingCount.set(count);
    return count;
  }

  public async enqueue(
    tableName: SyncQueueItem['table_name'],
    action: SyncQueueItem['action'],
    payload: Record<string, unknown>
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

    if (this.isOnline() && this.supabaseService.isConfigured) {
      this.syncNow();
    }

    return queueItem.id;
  }

  public async syncNow(): Promise<void> {
    if (!this.isOnline() || !this.supabaseService.isConfigured) {
      return;
    }

    const client = this.supabaseService.supabase;
    if (!client) return;

    this.isSyncing.set(true);

    try {
      // 1. Ripristina gli elementi in stato ERROR il cui backoff è scaduto, così possano essere riprovati
      const now = Date.now();
      const errorItems = await db.syncQueue.where('status').equals('ERROR').toArray();
      for (const errItem of errorItems) {
        if (!errItem.next_retry_at || errItem.next_retry_at <= now) {
          await db.syncQueue.update(errItem.id, { status: 'PENDING', error_message: undefined });
        }
      }

      const pendingItems = await db.syncQueue
        .where('status')
        .equals('PENDING')
        .toArray();

      // Ordiniamo le tabelle in base alle dipendenze di Foreign Key (genitori prima dei figli):
      const tablePriority: Record<string, number> = {
        'exercises': 1,
        'workout_templates': 2,
        'template_exercises': 3,
        'workout_sessions': 4,
        'workout_sets': 5,
        'diet_logs': 6,
        'diet_meals': 7,
        'diet_log_items': 8
      };

      pendingItems.sort((a, b) => {
        const pA = tablePriority[a.table_name] || 99;
        const pB = tablePriority[b.table_name] || 99;
        if (pA !== pB) return pA - pB;
        return a.timestamp - b.timestamp;
      });

      const currentUserId = this.supabaseService.currentUserId;
      const isRealUser = currentUserId && currentUserId !== LOCAL_USER_ID;

      for (const item of pendingItems) {
        try {
          await db.syncQueue.update(item.id, { status: 'SYNCING' });

          // Se l'utente è autenticato su Supabase e l'oggetto richiede user_id, colleghiamo l'utente corrente
          if (isRealUser && item.payload && typeof item.payload === 'object') {
            if (['exercises', 'workout_templates', 'workout_sessions', 'diet_logs', 'diet_meals', 'diet_log_items'].includes(item.table_name)) {
              if (!item.payload['user_id'] || item.payload['user_id'] === LOCAL_USER_ID) {
                item.payload['user_id'] = currentUserId;
              }
            }
          }

          let res: { error: PostgrestError | null; status: number } | undefined;
          if (item.action === 'INSERT') {
            res = await client.from(item.table_name).upsert(item.payload);
          } else if (item.action === 'UPDATE') {
            res = await client.from(item.table_name).update(item.payload).eq('id', item.payload['id'] as string);
          } else if (item.action === 'DELETE') {
            res = await client.from(item.table_name).delete().eq('id', item.payload['id'] as string);
          }

          // Fallback Failsafe: Se il DB Supabase remoto non possiede ancora la colonna 'is_public' o 'user_id' (PGRST204), riproviamo omettendo il campo mancante
          if (res?.error && res.error.code === 'PGRST204') {
            logger.warn(`FitSync Sync Fallback: Colonna mancante nello schema Supabase per '${item.table_name}'. Riprovo l'invio...`);
            const fallbackPayload = { ...item.payload };
            if (res.error.message?.includes('is_public')) {
              delete fallbackPayload['is_public'];
            }
            if (res.error.message?.includes('user_id')) {
              delete fallbackPayload['user_id'];
            }

            if (item.action === 'INSERT') {
              res = await client.from(item.table_name).upsert(fallbackPayload);
            } else if (item.action === 'UPDATE') {
              res = await client.from(item.table_name).update(fallbackPayload).eq('id', fallbackPayload['id'] as string);
            }
          }

          if (res?.error) {
            if (res.error.code === '23503') {
              logger.warn(`FitSync Sync Warning: L'elemento genitore per '${item.table_name}' non esiste su Supabase (FK 23503). Rimuovo l'elemento orfano dalla coda.`);
              await db.syncQueue.delete(item.id);
            } else if (res.status === 404 || res.error.code === '42P01' || res.error.message?.includes('relation') || res.error.message?.includes('does not exist')) {
              logger.warn(`FitSync Sync Warning: La tabella '${item.table_name}' non è ancora stata creata sul database Supabase remoto. Esegui lo script SQL nel Supabase Dashboard per crearla.`);
              await this.markError(item.id, item.retry_count || 0, res.error.message);
            } else {
              logger.error(`Sync error for item ${item.id} (${item.table_name}):`, res.error);
              await this.markError(item.id, item.retry_count || 0, res.error.message);
            }
          } else {
            logger.log(`FitSync Sync: caricamento riuscito per elemento ${item.id} (${item.table_name})`);
            await db.syncQueue.delete(item.id);
          }
        } catch (err) {
          logger.error(`Execution error syncing item ${item.id}:`, err);
          const message = err instanceof Error ? err.message : 'Unknown error';
          await this.markError(item.id, item.retry_count || 0, message);
        }
      }

      await this.pullRemoteData();
    } finally {
      await this.updatePendingCount();
      this.isSyncing.set(false);
    }
  }

  public async pullRemoteData(): Promise<void> {
    const client = this.supabaseService.supabase;
    if (!client || !this.isOnline()) return;

    const userId = this.supabaseService.currentUserId;

    try {
      logger.log('FitSync: Sincronizzazione ed allineamento dati con il DB Supabase...');

      // 1. Pull Exercises (Globali + Custom dell'utente)
      const { data: exercises, error: exErr } = await client.from('exercises').select('*');
      if (exErr) {
        logger.warn('FitSync: Errore durante il pull degli esercizi da Supabase:', exErr);
      } else if (exercises) {
        const remoteIds = new Set(exercises.map(e => e.id));
        const localExercises = await db.exercises.toArray();
        const toDelete = localExercises.filter(e => !remoteIds.has(e.id)).map(e => e.id);
        if (toDelete.length > 0) {
          await db.exercises.bulkDelete(toDelete);
          logger.log(`FitSync: Rimossi ${toDelete.length} esercizi locali eliminati dal DB remoto.`);
        }
        if (exercises.length > 0) {
          await db.exercises.bulkPut(exercises);
        }
      }

      // 2. Pull Templates (Pubbliche + dell'utente)
      let query = client.from('workout_templates').select('*');
      if (userId && userId !== LOCAL_USER_ID) {
        query = query.or(`is_public.eq.true,user_id.eq.${userId}`);
      } else {
        query = query.eq('is_public', true);
      }
      const { data: templates, error: tplErr } = await query;
      if (tplErr) {
        logger.warn('FitSync: Errore durante il pull delle schede da Supabase:', tplErr);
      } else if (templates) {
        const pendingQueue = await db.syncQueue.toArray();
        const pendingTplIds = new Set(pendingQueue.filter(q => q.table_name === 'workout_templates').map(q => q.payload?.['id']));

        const remoteIds = new Set(templates.map(t => t.id));
        const localTemplates = await db.workoutTemplates.toArray();
        const toDelete = localTemplates.filter(t => !remoteIds.has(t.id) && !pendingTplIds.has(t.id) && t.user_id === userId).map(t => t.id);
        if (toDelete.length > 0) {
          await db.workoutTemplates.bulkDelete(toDelete);
          logger.log(`FitSync: Rimosse ${toDelete.length} schede locali eliminate dal DB remoto.`);
        }
        if (templates.length > 0) {
          await db.workoutTemplates.bulkPut(templates);
        }
      }

      // 3. Pull Template Exercises
      const { data: tempExs, error: teErr } = await client.from('template_exercises').select('*');
      if (teErr) {
        logger.warn('FitSync: Errore durante il pull degli esercizi scheda da Supabase:', teErr);
      } else if (tempExs) {
        const pendingQueue = await db.syncQueue.toArray();
        const pendingTeIds = new Set(pendingQueue.filter(q => q.table_name === 'template_exercises').map(q => q.payload?.['id']));

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
      if (userId && userId !== LOCAL_USER_ID) {
        const { data: sessions, error: sErr } = await client.from('workout_sessions').select('*').eq('user_id', userId);
        if (sErr) {
          logger.warn('FitSync: Errore durante il pull delle sessioni da Supabase:', sErr);
        } else if (sessions) {
          const remoteIds = new Set(sessions.map(s => s.id));
          const localSessions = await db.workoutSessions.where('user_id').equals(userId).toArray();
          const toDelete = localSessions.filter(s => !remoteIds.has(s.id)).map(s => s.id);
          if (toDelete.length > 0) {
            await db.workoutSessions.bulkDelete(toDelete);
            logger.log(`FitSync: Rimosse ${toDelete.length} sessioni locali eliminate dal DB remoto.`);
          }
          if (sessions.length > 0) {
            await db.workoutSessions.bulkPut(sessions);
          }
        }
      }

      // 5. Pull Workout Sets (solo per le sessioni dell'utente corrente, dati sensibili)
      if (userId && userId !== LOCAL_USER_ID) {
        const userSessionIds = (await db.workoutSessions.where('user_id').equals(userId).toArray()).map(s => s.id);
        if (userSessionIds.length > 0) {
          const { data: sets, error: setErr } = await client.from('workout_sets').select('*').in('session_id', userSessionIds);
          if (setErr) {
            logger.warn('FitSync: Errore durante il pull dei set da Supabase:', setErr);
          } else if (sets) {
            const remoteIds = new Set(sets.map(s => s.id));
            const localSets = await db.workoutSets.where('session_id').anyOf(userSessionIds).toArray();
            const toDelete = localSets.filter(s => !remoteIds.has(s.id)).map(s => s.id);
            if (toDelete.length > 0) {
              await db.workoutSets.bulkDelete(toDelete);
            }
            if (sets.length > 0) {
              await db.workoutSets.bulkPut(sets);
            }
          }
        }
      }

      // 6. Pull Diet Logs dell'utente
      if (userId && userId !== LOCAL_USER_ID) {
        try {
          const { data: dietLogs, error: dlErr } = await client.from('diet_logs').select('*').eq('user_id', userId);
          if (!dlErr && dietLogs) {
            const remoteLogIds = new Set(dietLogs.map(l => l.id));
            const localLogs = await db.dietLogs.where('user_id').equals(userId).toArray();
            const toDelLogs = localLogs.filter(l => !remoteLogIds.has(l.id)).map(l => l.id);
            if (toDelLogs.length > 0) {
              await db.dietLogs.bulkDelete(toDelLogs);
            }
            if (dietLogs.length > 0) {
              await db.dietLogs.bulkPut(dietLogs);
            }
          }

          const { data: dietMeals, error: dmErr } = await client.from('diet_meals').select('*');
          if (!dmErr && dietMeals) {
            const userMeals = dietMeals.filter(m => !m.user_id || m.user_id === userId);
            if (userMeals.length > 0) {
              await db.dietMeals.bulkPut(userMeals);
            }
          }

          const { data: dietLogItems, error: dliErr } = await client.from('diet_log_items').select('*');
          if (!dliErr && dietLogItems) {
            const userItems = dietLogItems.filter(i => !i.user_id || i.user_id === userId);
            if (userItems.length > 0) {
              await db.dietLogItems.bulkPut(userItems);
            }
          }
        } catch (dErr) {
          logger.warn('FitSync: Pull tabella dieta non riuscito:', dErr);
        }
      }

      logger.log('FitSync: Allineamento completo ed eliminazioni sincronizzate dal DB remoto!');
    } catch (err) {
      logger.warn('Errore durante il download dei dati remoti:', err);
    }
  }
}
