import Dexie, { Table } from 'dexie';
import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import {
  Profile,
  Exercise,
  Food,
  WorkoutTemplate,
  TemplateExercise,
  WorkoutSession,
  WorkoutSet,
  SyncQueueItem,
  DietLog,
  DietMeal,
  DietLogItem
} from '../models/fitsync.models';
import defaultExercisesData from '../data/default-exercises.json';
import defaultFoodsData from '../data/default-foods.json';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Recupera una singola riga da Supabase (per colonna = valore) e la salva in locale.
 * Usata come fallback quando un dato non è (ancora) presente nel DB locale IndexedDB
 * (es. una scheda pubblica di un altro utente mai sincronizzata prima).
 */
export async function fetchRemoteRow<T>(
  client: SupabaseClient,
  table: string,
  column: string,
  value: string,
  dexieTable: Table<T, string>
): Promise<T | undefined> {
  try {
    const { data, error } = await client.from(table).select('*').eq(column, value).maybeSingle();
    if (!error && data) {
      await dexieTable.put(data as T);
      return data as T;
    }
  } catch (err) {
    logger.warn(`FitSync: recupero remoto fallito per ${table}.${column}=${value}:`, err);
  }
  return undefined;
}

/**
 * Recupera più righe da Supabase filtrate per colonna = valore e le salva in locale.
 * Stesso scopo di fetchRemoteRow, per i casi in cui il fallback restituisce una lista
 * (es. gli esercizi di una scheda) invece di un singolo elemento.
 */
export async function fetchRemoteRows<T>(
  client: SupabaseClient,
  table: string,
  column: string,
  value: string,
  dexieTable: Table<T, string>,
  orderBy?: string
): Promise<T[]> {
  try {
    let query = client.from(table).select('*').eq(column, value);
    if (orderBy) {
      query = query.order(orderBy, { ascending: true }) as typeof query;
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      await dexieTable.bulkPut(data as T[]);
      return data as T[];
    }
  } catch (err) {
    logger.warn(`FitSync: recupero remoto fallito per ${table} dove ${column}=${value}:`, err);
  }
  return [];
}

/**
 * Migra i vecchi ID testuali (es. 'ex-001') a UUID su esercizi personalizzati, schede,
 * collegamenti scheda-esercizio, sessioni e set, accodando ogni riga migrata alla sync queue.
 * Usata sia dalla migrazione Dexie versione 4 (dentro la sua transazione di upgrade) sia dal
 * controllo failsafe eseguito ad ogni avvio app — stessa logica, due punti di ingresso diversi
 * (una transazione di upgrade Dexie e l'istanza `db` stessa espongono entrambe `.table(name)`).
 */
async function migrateLegacyIds(source: { table(name: string): Table<any, string> }, logLabel: string) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUuid = (id: unknown): id is string => typeof id === 'string' && uuidRegex.test(id);

  const exercisesTable = source.table('exercises');
  const templatesTable = source.table('workoutTemplates');
  const templateExercisesTable = source.table('templateExercises');
  const sessionsTable = source.table('workoutSessions');
  const setsTable = source.table('workoutSets');
  const syncQueueTable = source.table('syncQueue');

  const enqueueSync = (table_name: string, payload: Record<string, unknown>) =>
    syncQueueTable.add({
      id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
      table_name,
      action: 'INSERT',
      payload,
      timestamp: Date.now(),
      status: 'PENDING'
    });

  const exerciseMap: Record<string, string> = {};
  const templateMap: Record<string, string> = {};
  const sessionMap: Record<string, string> = {};

  // 1. Migra gli esercizi personalizzati (is_custom === true) non-UUID
  const exercises = await exercisesTable.toArray();
  for (const ex of exercises) {
    if (ex.is_custom && !isUuid(ex.id)) {
      const newId = generateUUID();
      exerciseMap[ex.id] = newId;

      const migratedEx = { ...ex, id: newId };
      await exercisesTable.add(migratedEx);
      await enqueueSync('exercises', migratedEx);
      await exercisesTable.delete(ex.id);
      logger.log(`FitSyncDB ${logLabel}: Migrato esercizio personalizzato "${ex.name}" (${ex.id} -> ${newId})`);
    }
  }

  // 2. Migra le schede (workoutTemplates) non-UUID
  const templates = await templatesTable.toArray();
  for (const t of templates) {
    if (!isUuid(t.id)) {
      const newId = generateUUID();
      templateMap[t.id] = newId;

      const migratedTpl = { ...t, id: newId };
      await templatesTable.add(migratedTpl);
      await enqueueSync('workout_templates', migratedTpl);
      await templatesTable.delete(t.id);
      logger.log(`FitSyncDB ${logLabel}: Migrata scheda "${t.name}" (${t.id} -> ${newId})`);
    }
  }

  // 3. Migra i template exercises associati
  const tempExs = await templateExercisesTable.toArray();
  for (const te of tempExs) {
    const needsMigrate = !isUuid(te.id) || exerciseMap[te.exercise_id] || templateMap[te.template_id];
    if (needsMigrate) {
      const newId = isUuid(te.id) ? te.id : generateUUID();
      const newExId = exerciseMap[te.exercise_id] || te.exercise_id;
      const newTplId = templateMap[te.template_id] || te.template_id;

      const migratedTe = { ...te, id: newId, exercise_id: newExId, template_id: newTplId };

      if (newId !== te.id) {
        await templateExercisesTable.add(migratedTe);
        await templateExercisesTable.delete(te.id);
      } else {
        await templateExercisesTable.put(migratedTe);
      }
      await enqueueSync('template_exercises', migratedTe);
    }
  }

  // 4. Migra le sessioni di allenamento non-UUID
  const sessions = await sessionsTable.toArray();
  for (const s of sessions) {
    const needsMigrate = !isUuid(s.id) || (s.template_id && templateMap[s.template_id]);
    if (needsMigrate) {
      const newId = isUuid(s.id) ? s.id : generateUUID();
      if (!isUuid(s.id)) {
        sessionMap[s.id] = newId;
      }
      const newTplId = s.template_id ? (templateMap[s.template_id] || s.template_id) : s.template_id;

      const migratedSession = { ...s, id: newId, template_id: newTplId };

      if (newId !== s.id) {
        await sessionsTable.add(migratedSession);
        await sessionsTable.delete(s.id);
      } else {
        await sessionsTable.put(migratedSession);
      }
      await enqueueSync('workout_sessions', migratedSession);
      logger.log(`FitSyncDB ${logLabel}: Migrata sessione di allenamento "${s.name}" (${s.id} -> ${newId})`);
    }
  }

  // 5. Migra i set completati non-UUID
  const sets = await setsTable.toArray();
  for (const set of sets) {
    const needsMigrate = !isUuid(set.id) || sessionMap[set.session_id] || exerciseMap[set.exercise_id];
    if (needsMigrate) {
      const newId = isUuid(set.id) ? set.id : generateUUID();
      const newSessionId = sessionMap[set.session_id] || set.session_id;
      const newExId = exerciseMap[set.exercise_id] || set.exercise_id;

      const migratedSet = { ...set, id: newId, session_id: newSessionId, exercise_id: newExId };

      if (newId !== set.id) {
        await setsTable.add(migratedSet);
        await setsTable.delete(set.id);
      } else {
        await setsTable.put(migratedSet);
      }
      await enqueueSync('workout_sets', migratedSet);
    }
  }
}

export class FitSyncDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  exercises!: Table<Exercise, string>;
  workoutTemplates!: Table<WorkoutTemplate, string>;
  templateExercises!: Table<TemplateExercise, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  workoutSets!: Table<WorkoutSet, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  dietLogs!: Table<DietLog, string>;
  dietMeals!: Table<DietMeal, string>;
  dietLogItems!: Table<DietLogItem, string>;
  foods!: Table<Food, string>;

  constructor() {
    super('FitSyncDB');

    const schemaV1 = {
      profiles: 'id, username',
      exercises: 'id, user_id, name, category, equipment, is_custom, is_public',
      workoutTemplates: 'id, user_id, name, is_public, created_at',
      templateExercises: 'id, template_id, exercise_id, order_index',
      workoutSessions: 'id, user_id, template_id, start_time',
      workoutSets: 'id, session_id, exercise_id, set_number',
      syncQueue: 'id, table_name, action, timestamp, status'
    };

    const schemaV5 = {
      ...schemaV1,
      dietLogs: 'id, user_id, date, [user_id+date]',
      dietMeals: 'id, user_id, diet_log_id, order_index',
      dietLogItems: 'id, user_id, meal_id'
    };

    const schemaV6 = {
      ...schemaV5,
      foods: 'id, user_id, name, is_custom, is_public'
    };

    this.version(1).stores(schemaV1);
    this.version(5).stores(schemaV5);
    this.version(6).stores(schemaV6);

    this.version(2).stores(schemaV1).upgrade(async tx => {
      // Migrazione degli esercizi esistenti da 'Braccia' a 'Bicipiti' o 'Tricipiti'
      await tx.table('exercises').where('id').anyOf(['ex-020', 'ex-021']).modify({ category: 'Bicipiti' });
      await tx.table('exercises').where('id').anyOf(['ex-022', 'ex-023']).modify({ category: 'Tricipiti' });
      
      // Se ci sono altri esercizi personalizzati con categoria 'Braccia', li impostiamo come 'Bicipiti' di default
      await tx.table('exercises').where('category').equals('Braccia').modify({ category: 'Bicipiti' });
    });

    this.version(3).stores(schemaV1).upgrade(async tx => {
      const EX_MIGRATION_MAP: Record<string, string> = {
        'ex-001': 'd8970cee-e3d6-4dd0-ab09-c569f3f750f2',
        'ex-002': 'd9a5c5c4-fe5b-44c2-b380-adc5aacda21f',
        'ex-003': 'ebc33cb9-539d-41f9-bdae-e163dfa09762',
        'ex-004': 'c8714d09-e448-4a60-baec-6e82092d27a4',
        'ex-005': '73c1430b-8c79-490c-bd37-8174fe0beee8',
        'ex-006': 'd95f12cc-c0fa-4e29-b172-1ce437fb03f9',
        'ex-007': '8cc14caa-ee32-4042-ac72-f059125d4d03',
        'ex-008': '085593f7-7472-43f6-85f5-a672f7e93719',
        'ex-009': '36e581ac-1306-4b76-87ad-410a6aef3ab0',
        'ex-010': '9db7902f-dd5f-4ea8-8617-71dfc66f0fcb',
        'ex-011': '95ebce18-a76a-440e-84be-3a07bf0d37a0',
        'ex-012': 'f35fd411-5022-4e1b-884a-7eb3438ec20c',
        'ex-013': '781e167f-d8ee-45b7-8c5f-9a7828395674',
        'ex-014': '461c4269-f5bd-4440-85e1-24fd7c8820dc',
        'ex-015': '7752da0c-aa55-4dae-8a64-84a461febd4e',
        'ex-016': '9759a35a-c2a2-4096-9422-cffcc25b0a38',
        'ex-017': 'a4bc39b7-8d68-47fc-94f3-f619f19b13bb',
        'ex-018': '9f6634fb-ae52-4055-bacc-236082644880',
        'ex-019': '661d2322-266d-4ffa-992f-62dd6fa0d3db',
        'ex-020': '11c3fe8e-7b82-4791-b862-4f0152dcdb6e',
        'ex-021': '8fab3d46-ba8d-4866-a7d1-7864b127ada0',
        'ex-022': '63fa0bc9-0773-4d09-8843-b44df47a1946',
        'ex-023': '1f77326a-0fc1-4a02-b646-1df719087f03',
        'ex-024': '098506fa-10b5-4e23-a9ae-cdee10375a11',
        'ex-025': '00dd5fdd-76cf-4823-bfd3-0d88cff2fbc0',
        'ex-026': '8391ec26-3a48-422a-899a-1710cb72f18a'
      };

      // 1. Elimina i vecchi esercizi di default non-UUID
      const oldIds = Object.keys(EX_MIGRATION_MAP);
      await tx.table('exercises').bulkDelete(oldIds);

      // 2. Aggiorna i riferimenti in templateExercises
      await tx.table('templateExercises').toCollection().modify(te => {
        if (EX_MIGRATION_MAP[te.exercise_id]) {
          te.exercise_id = EX_MIGRATION_MAP[te.exercise_id];
        }
      });

      // 3. Aggiorna i riferimenti in workoutSets
      await tx.table('workoutSets').toCollection().modify(ws => {
        if (EX_MIGRATION_MAP[ws.exercise_id]) {
          ws.exercise_id = EX_MIGRATION_MAP[ws.exercise_id];
        }
      });
    });

    this.version(4).stores(schemaV1).upgrade(async tx => {
      logger.log('FitSyncDB: Avvio migrazione schema Versione 4 (migrazione ID testuali -> UUID)...');
      await migrateLegacyIds(tx, 'Versione 4');
      logger.log('FitSyncDB: Migrazione schema Versione 4 completata con successo!');
    });

    this.on('populate', () => {
      this.populateInitialExercises();
      this.populateInitialFoods();
    });

    // Failsafe: se il database esiste già ma mancano gli esercizi di default UUID, li popoliamo all'avvio.
    this.on('ready', async () => {
      try {
        const hasDefault = await this.exercises.get('d8970cee-e3d6-4dd0-ab09-c569f3f750f2');
        if (!hasDefault) {
          logger.log('FitSyncDB exercises table is missing default UUID exercises. Seeding...');
          await this.populateInitialExercises();
        }

        const foodsCount = await this.foods.count();
        if (foodsCount === 0) {
          logger.log('FitSyncDB foods table is empty. Seeding default foods...');
          await this.populateInitialFoods();
        }

        // Esegue sempre un controllo e migrazione dei dati vecchi rimasti con ID non-UUID
        await this.performLegacyMigrationCheck();

        // Recupera gli item rimasti bloccati in SYNCING da un run precedente interrotto (es.
        // refresh di pagina a metà sync): all'avvio non può esserci nessuna sync realmente in
        // corso, quindi qualunque item ancora in questo stato è orfano e va rimesso in coda.
        const stuckSyncingCount = await this.syncQueue.where('status').equals('SYNCING').count();
        if (stuckSyncingCount > 0) {
          await this.syncQueue.where('status').equals('SYNCING').modify({ status: 'PENDING' });
          logger.log(`FitSyncDB: Ripristinati ${stuckSyncingCount} elementi di sync bloccati in SYNCING da un run precedente interrotto.`);
        }

        // Rimuove eventuali elementi di sync bloccati con ID non-UUID (pre-migrazione)
        const syncItems = await this.syncQueue.toArray();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const item of syncItems) {
          const payloadId = item.payload?.['id'] || item.payload;
          if (item.table_name !== 'profiles' && typeof payloadId === 'string' && !uuidRegex.test(payloadId)) {
            logger.warn(`Rimozione elemento di sync non valido ${item.id} (ID non-UUID: ${payloadId})`);
            await this.syncQueue.delete(item.id);
          }
        }
      } catch (err) {
        logger.error('Errore durante il controllo o la pulizia del database:', err);
      }
    });
  }

  private async performLegacyMigrationCheck() {
    try {
      await migrateLegacyIds(this, '[Runtime Failsafe]');
    } catch (e) {
      logger.error('Errore durante la migrazione failsafe in esecuzione:', e);
    }
  }

  private async populateInitialExercises() {
    await this.exercises.bulkAdd(defaultExercisesData as Exercise[]);
  }

  private async populateInitialFoods() {
    await this.foods.bulkAdd(defaultFoodsData as Food[]);
  }
}

export const db = new FitSyncDatabase();
