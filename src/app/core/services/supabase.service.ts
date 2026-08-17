import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Table } from 'dexie';
import { BehaviorSubject, Observable } from 'rxjs';
import { db } from '../db/app-db';
import { Profile, SyncQueueItem } from '../models/fitsync.models';
import { logger } from '../utils/logger';
import { environment } from '../../../environments/environment';

export const SUPABASE_URL = environment.supabaseUrl;
export const SUPABASE_ANON_KEY = environment.supabaseAnonKey;

// Identifica i dati creati offline prima del login, poi "reclamati" dall'utente reale al primo accesso.
export const LOCAL_USER_ID = 'local-user-id';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private client: SupabaseClient | null = null;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  
  private isConfiguredSubject = new BehaviorSubject<boolean>(false);
  public isConfigured$: Observable<boolean> = this.isConfiguredSubject.asObservable();

  constructor() {
    this.initSupabase();
  }

  private initSupabase() {
    if (SUPABASE_URL !== 'https://tuo-progetto.supabase.co' && SUPABASE_ANON_KEY !== 'la-tua-anon-key') {
      try {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        this.isConfiguredSubject.next(true);

        this.client.auth.getUser().then(async ({ data }) => {
          if (data?.user) {
            await this.claimLocalData(data.user.id);
            this.currentUserSubject.next(data.user);
            this.syncUserProfile(data.user);
          }
        });

        // Non async: onAuthStateChange non deve mai restare in attesa (await) di codice che
        // chiama a sua volta client.auth.* al suo interno, pena un deadlock nel lock interno
        // di Supabase. La riconciliazione dei dati locali tocca solo Dexie, quindi è sicura,
        // ma la incateniamo comunque con .then()/.finally() invece di renderla async.
        this.client.auth.onAuthStateChange((event, session) => {
          const user = session?.user || null;
          if (user) {
            this.claimLocalData(user.id).finally(() => {
              this.currentUserSubject.next(user);
              this.syncUserProfile(user);
            });
          } else {
            this.currentUserSubject.next(user);
          }
        });
      } catch (err) {
        logger.warn('Supabase initialization failed or using offline mode:', err);
      }
    } else {
      logger.log('FitSync running in local-only / offline demo mode. Supabase keys can be updated in env.');
    }
  }

  public get supabase(): SupabaseClient | null {
    return this.client;
  }

  public get isConfigured(): boolean {
    return this.isConfiguredSubject.value;
  }

  public get currentUserId(): string {
    return this.currentUserSubject.value?.id || LOCAL_USER_ID;
  }

  private async syncUserProfile(user: User) {
    const profile: Profile = {
      id: user.id,
      username: user.email?.split('@')[0] || 'Utente',
      full_name: user.user_metadata?.['full_name'] || user.email || 'Utente FitSync',
      avatar_url: user.user_metadata?.['avatar_url'] || '',
      updated_at: new Date().toISOString()
    };
    await db.profiles.put(profile);

    if (this.client) {
      try {
        await this.client.from('profiles').upsert(profile);
      } catch (err) {
        logger.warn('Could not sync user profile to remote Supabase:', err);
      }
    }
  }

  async signUp(username: string, password: string, fullName?: string) {
    if (!this.client) {
      throw new Error('Supabase non è configurato. Inserisci le tue API key.');
    }
    const email = `${username.toLowerCase().trim()}@fitsync.com`;
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username }
      }
    });
    if (error) throw error;
    return data;
  }

  async signIn(username: string, password: string) {
    if (!this.client) {
      throw new Error('Supabase non è configurato. Inserisci le tue API key.');
    }
    const email = `${username.toLowerCase().trim()}@fitsync.com`;
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    if (this.client) {
      await this.client.auth.signOut();
    }
    this.currentUserSubject.next(null);
  }

  /**
   * Riassegna all'utente reale i dati creati offline/pre-login (ancora sotto LOCAL_USER_ID)
   * prima che qualunque altro servizio possa leggerli — chiamata prima di emettere l'utente
   * su currentUser$. Senza questo, i dati locali restavano orfani sotto LOCAL_USER_ID per
   * sempre: DietService (e gli altri servizi) non li trovava filtrando per l'id reale, ne
   * creava di nuovi da zero, e il vecchio item in coda di sync — ri-stampato con l'id reale
   * solo al momento dell'invio — finiva quasi sempre per collidere con quello nuovo già
   * sincronizzato (unique violation, retry infinito). Vedi nota Bugs "Log locale pre-login
   * non riconciliato con account reale".
   */
  private async claimLocalData(realUserId: string): Promise<void> {
    try {
      await this.reassignLocalUserId(db.exercises, realUserId);
      await this.reassignLocalUserId(db.foods, realUserId);
      await this.reassignLocalUserId(db.workoutTemplates, realUserId);
      await this.reassignLocalUserId(db.workoutSessions, realUserId);
      await this.claimDietLogs(realUserId);
    } catch (err) {
      logger.error('FitSync: errore durante la riconciliazione dei dati locali pre-login:', err);
    }
  }

  /** Riassegna a realUserId le righe di `table` ancora sotto LOCAL_USER_ID, sia in locale sia nel payload di eventuali item ancora in coda di sync. */
  private async reassignLocalUserId<T extends { id: string; user_id?: string | null }>(table: Table<T, string>, realUserId: string): Promise<T[]> {
    const orphanRows = await table.where('user_id').equals(LOCAL_USER_ID).toArray();
    if (orphanRows.length === 0) return [];

    // Dexie non riesce a inferire UpdateSpec<T> per un generico vincolato: il tipo è comunque
    // garantito a runtime dal filtro `.where('user_id')` sopra.
    const orphanCollection = table.where('user_id').equals(LOCAL_USER_ID) as unknown as { modify(changes: Record<string, unknown>): Promise<number> };
    await orphanCollection.modify({ user_id: realUserId });
    await this.patchQueuePayloads(orphanRows.map(r => r.id), { user_id: realUserId });
    return orphanRows;
  }

  /**
   * diet_logs ha un vincolo UNIQUE(user_id, date) lato Postgres: se esiste già un log reale
   * per la stessa data (creato dopo il login, prima che questa riconciliazione arrivasse a
   * girare), riassegnare lo user_id del log orfano creerebbe due righe locali per lo stesso
   * (utente, data) destinate a scontrarsi al push. In quel caso pasti e alimenti del log
   * orfano vengono spostati sul log reale già esistente (reparenting) e il log orfano viene
   * scartato, invece di essere riassegnato.
   */
  private async claimDietLogs(realUserId: string): Promise<void> {
    const orphanLogs = await db.dietLogs.where('user_id').equals(LOCAL_USER_ID).toArray();
    if (orphanLogs.length === 0) return;

    const realLogs = await db.dietLogs.where('user_id').equals(realUserId).toArray();
    const realLogByDate = new Map(realLogs.map(l => [l.date, l]));

    for (const orphan of orphanLogs) {
      const conflict = realLogByDate.get(orphan.date);
      const targetLogId = conflict ? conflict.id : orphan.id;

      const meals = await db.dietMeals.where({ diet_log_id: orphan.id }).toArray();
      for (const meal of meals) {
        const items = await db.dietLogItems.where({ meal_id: meal.id }).toArray();
        await db.dietLogItems.where({ meal_id: meal.id }).modify({ user_id: realUserId });
        await this.patchQueuePayloads(items.map(i => i.id), { user_id: realUserId });
      }
      await db.dietMeals.where({ diet_log_id: orphan.id }).modify({ user_id: realUserId, diet_log_id: targetLogId });
      await this.patchQueuePayloads(meals.map(m => m.id), { user_id: realUserId, diet_log_id: targetLogId });

      if (conflict) {
        await db.dietLogs.delete(orphan.id);
        await this.deleteQueueItemsForRow('diet_logs', orphan.id);
      } else {
        await db.dietLogs.update(orphan.id, { user_id: realUserId });
        await this.patchQueuePayloads([orphan.id], { user_id: realUserId });
      }
    }
  }

  /** Aggiorna i campi indicati nel payload di ogni item ancora in coda di sync che referenzia una delle righe locali riassegnate. */
  private async patchQueuePayloads(rowIds: string[], patch: Record<string, unknown>): Promise<void> {
    if (rowIds.length === 0) return;
    const idSet = new Set(rowIds);
    const queueItems = await db.syncQueue.toArray();
    for (const item of queueItems) {
      const payloadId = item.payload?.['id'];
      if (typeof payloadId === 'string' && idSet.has(payloadId)) {
        await db.syncQueue.update(item.id, { payload: { ...item.payload, ...patch } });
      }
    }
  }

  /** Elimina dalla coda di sync gli item di una tabella che referenziano una riga locale ormai scartata (es. log orfano andato in conflitto). */
  private async deleteQueueItemsForRow(tableName: SyncQueueItem['table_name'], rowId: string): Promise<void> {
    const queueItems = await db.syncQueue.where('table_name').equals(tableName).toArray();
    const toDelete = queueItems.filter(q => q.payload?.['id'] === rowId).map(q => q.id);
    if (toDelete.length > 0) {
      await db.syncQueue.bulkDelete(toDelete);
    }
  }
}
