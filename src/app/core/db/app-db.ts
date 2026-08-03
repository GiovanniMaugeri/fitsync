import Dexie, { Table } from 'dexie';
import { 
  Profile, 
  Exercise, 
  WorkoutTemplate, 
  TemplateExercise, 
  WorkoutSession, 
  WorkoutSet, 
  SyncQueueItem,
  DietLog,
  DietMeal,
  DietLogItem
} from '../models/fitsync.models';

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

    this.version(1).stores(schemaV1);
    this.version(5).stores(schemaV5);

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
      console.log('FitSyncDB: Avvio migrazione schema Versione 4 (migrazione ID testuali -> UUID)...');
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = (id: any) => typeof id === 'string' && uuidRegex.test(id);

      const exerciseMap: Record<string, string> = {};
      const templateMap: Record<string, string> = {};
      const sessionMap: Record<string, string> = {};

      // 1. Migra gli esercizi personalizzati (is_custom === true) non-UUID
      const exercises = await tx.table('exercises').toArray();
      let migratedExercisesCount = 0;
      for (const ex of exercises) {
        if (ex.is_custom && !isUuid(ex.id)) {
          const newId = generateUUID();
          exerciseMap[ex.id] = newId;

          const migratedEx = { ...ex, id: newId };
          await tx.table('exercises').add(migratedEx);

          await tx.table('syncQueue').add({
            id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            table_name: 'exercises',
            action: 'INSERT',
            payload: migratedEx,
            timestamp: Date.now(),
            status: 'PENDING'
          });

          await tx.table('exercises').delete(ex.id);
          migratedExercisesCount++;
          console.log(`FitSyncDB: Migrato esercizio personalizzato "${ex.name}" (${ex.id} -> ${newId})`);
        }
      }
      if (migratedExercisesCount > 0) {
        console.log(`FitSyncDB: Migrati con successo ${migratedExercisesCount} esercizi personalizzati.`);
      }

      // 2. Migra le schede (workoutTemplates) non-UUID
      const templates = await tx.table('workoutTemplates').toArray();
      let migratedTemplatesCount = 0;
      for (const t of templates) {
        if (!isUuid(t.id)) {
          const newId = generateUUID();
          templateMap[t.id] = newId;

          const migratedTpl = { ...t, id: newId };
          await tx.table('workoutTemplates').add(migratedTpl);

          await tx.table('syncQueue').add({
            id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            table_name: 'workout_templates',
            action: 'INSERT',
            payload: migratedTpl,
            timestamp: Date.now(),
            status: 'PENDING'
          });

          await tx.table('workoutTemplates').delete(t.id);
          migratedTemplatesCount++;
          console.log(`FitSyncDB: Migrata scheda "${t.name}" (${t.id} -> ${newId})`);
        }
      }
      if (migratedTemplatesCount > 0) {
        console.log(`FitSyncDB: Migrate con successo ${migratedTemplatesCount} schede.`);
      }

      // 3. Migra i template exercises associati
      const tempExs = await tx.table('templateExercises').toArray();
      let migratedTempExsCount = 0;
      for (const te of tempExs) {
        const needsMigrate = !isUuid(te.id) || exerciseMap[te.exercise_id] || templateMap[te.template_id];
        if (needsMigrate) {
          const newId = isUuid(te.id) ? te.id : generateUUID();
          const newExId = exerciseMap[te.exercise_id] || te.exercise_id;
          const newTplId = templateMap[te.template_id] || te.template_id;

          const migratedTe = {
            ...te,
            id: newId,
            exercise_id: newExId,
            template_id: newTplId
          };

          if (newId !== te.id) {
            await tx.table('templateExercises').add(migratedTe);
            await tx.table('templateExercises').delete(te.id);
          } else {
            await tx.table('templateExercises').put(migratedTe);
          }

          await tx.table('syncQueue').add({
            id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            table_name: 'template_exercises',
            action: 'INSERT',
            payload: migratedTe,
            timestamp: Date.now(),
            status: 'PENDING'
          });
          migratedTempExsCount++;
        }
      }
      if (migratedTempExsCount > 0) {
        console.log(`FitSyncDB: Aggiornati con successo ${migratedTempExsCount} collegamenti scheda-esercizio.`);
      }

      // 4. Migra le sessioni di allenamento non-UUID
      const sessions = await tx.table('workoutSessions').toArray();
      let migratedSessionsCount = 0;
      for (const s of sessions) {
        const needsMigrate = !isUuid(s.id) || (s.template_id && templateMap[s.template_id]);
        if (needsMigrate) {
          const newId = isUuid(s.id) ? s.id : generateUUID();
          if (!isUuid(s.id)) {
            sessionMap[s.id] = newId;
          }
          const newTplId = s.template_id ? (templateMap[s.template_id] || s.template_id) : s.template_id;

          const migratedSession = {
            ...s,
            id: newId,
            template_id: newTplId
          };

          if (newId !== s.id) {
            await tx.table('workoutSessions').add(migratedSession);
            await tx.table('workoutSessions').delete(s.id);
          } else {
            await tx.table('workoutSessions').put(migratedSession);
          }

          await tx.table('syncQueue').add({
            id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            table_name: 'workout_sessions',
            action: 'INSERT',
            payload: migratedSession,
            timestamp: Date.now(),
            status: 'PENDING'
          });
          migratedSessionsCount++;
          console.log(`FitSyncDB: Migrata sessione di allenamento "${s.name}" (${s.id} -> ${newId})`);
        }
      }
      if (migratedSessionsCount > 0) {
        console.log(`FitSyncDB: Migrate con successo ${migratedSessionsCount} sessioni di allenamento.`);
      }

      // 5. Migra i set completati non-UUID
      const sets = await tx.table('workoutSets').toArray();
      let migratedSetsCount = 0;
      for (const set of sets) {
        const needsMigrate = !isUuid(set.id) || sessionMap[set.session_id] || exerciseMap[set.exercise_id];
        if (needsMigrate) {
          const newId = isUuid(set.id) ? set.id : generateUUID();
          const newSessionId = sessionMap[set.session_id] || set.session_id;
          const newExId = exerciseMap[set.exercise_id] || set.exercise_id;

          const migratedSet = {
            ...set,
            id: newId,
            session_id: newSessionId,
            exercise_id: newExId
          };

          if (newId !== set.id) {
            await tx.table('workoutSets').add(migratedSet);
            await tx.table('workoutSets').delete(set.id);
          } else {
            await tx.table('workoutSets').put(migratedSet);
          }

          await tx.table('syncQueue').add({
            id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            table_name: 'workout_sets',
            action: 'INSERT',
            payload: migratedSet,
            timestamp: Date.now(),
            status: 'PENDING'
          });
          migratedSetsCount++;
        }
      }
      if (migratedSetsCount > 0) {
        console.log(`FitSyncDB: Aggiornati con successo ${migratedSetsCount} set di allenamento.`);
      }
      console.log('FitSyncDB: Migrazione schema Versione 4 completata con successo!');
    });

    this.on('populate', () => this.populateInitialExercises());

    // Failsafe: se il database esiste già ma mancano gli esercizi di default UUID, li popoliamo all'avvio.
    this.on('ready', async () => {
      try {
        const hasDefault = await this.exercises.get('d8970cee-e3d6-4dd0-ab09-c569f3f750f2');
        if (!hasDefault) {
          console.log('FitSyncDB exercises table is missing default UUID exercises. Seeding...');
          await this.populateInitialExercises();
        }

        // Esegue sempre un controllo e migrazione dei dati vecchi rimasti con ID non-UUID
        await this.performLegacyMigrationCheck();

        // Rimuove eventuali elementi di sync bloccati con ID non-UUID (pre-migrazione)
        const syncItems = await this.syncQueue.toArray();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const item of syncItems) {
          const payloadId = item.payload?.id || item.payload;
          if (item.table_name !== 'profiles' && typeof payloadId === 'string' && !uuidRegex.test(payloadId)) {
            console.warn(`Rimozione elemento di sync non valido ${item.id} (ID non-UUID: ${payloadId})`);
            await this.syncQueue.delete(item.id);
          }
        }
      } catch (err) {
        console.error('Errore durante il controllo o la pulizia del database:', err);
      }
    });
  }

  private async performLegacyMigrationCheck() {
    try {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = (id: any) => typeof id === 'string' && uuidRegex.test(id);

      const exerciseMap: Record<string, string> = {};
      const templateMap: Record<string, string> = {};
      const sessionMap: Record<string, string> = {};

      // 1. Esercizi personalizzati
      const exercises = await this.exercises.toArray();
      for (const ex of exercises) {
        if (ex.is_custom && !isUuid(ex.id)) {
          const newId = generateUUID();
          exerciseMap[ex.id] = newId;

          const migratedEx = { ...ex, id: newId };
          await this.exercises.add(migratedEx);
          await this.syncQueue.add({
            id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            table_name: 'exercises',
            action: 'INSERT',
            payload: migratedEx,
            timestamp: Date.now(),
            status: 'PENDING'
          });
          await this.exercises.delete(ex.id);
          console.log(`FitSyncDB [Runtime Failsafe]: Migrato esercizio personalizzato "${ex.name}" (${ex.id} -> ${newId})`);
        }
      }

      // 2. Schede (Templates)
      const templates = await this.workoutTemplates.toArray();
      for (const t of templates) {
        if (!isUuid(t.id)) {
          const newId = generateUUID();
          templateMap[t.id] = newId;

          const migratedTpl = { ...t, id: newId };
          await this.workoutTemplates.add(migratedTpl);
          await this.syncQueue.add({
            id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            table_name: 'workout_templates',
            action: 'INSERT',
            payload: migratedTpl,
            timestamp: Date.now(),
            status: 'PENDING'
          });
          await this.workoutTemplates.delete(t.id);
          console.log(`FitSyncDB [Runtime Failsafe]: Migrata scheda "${t.name}" (${t.id} -> ${newId})`);
        }
      }

      // 3. Template Exercises
      const tempExs = await this.templateExercises.toArray();
      for (const te of tempExs) {
        const needsMigrate = !isUuid(te.id) || exerciseMap[te.exercise_id] || templateMap[te.template_id];
        if (needsMigrate) {
          const newId = isUuid(te.id) ? te.id : generateUUID();
          const newExId = exerciseMap[te.exercise_id] || te.exercise_id;
          const newTplId = templateMap[te.template_id] || te.template_id;

          const migratedTe = {
            ...te,
            id: newId,
            exercise_id: newExId,
            template_id: newTplId
          };

          if (newId !== te.id) {
            await this.templateExercises.add(migratedTe);
            await this.templateExercises.delete(te.id);
          } else {
            await this.templateExercises.put(migratedTe);
          }

          await this.syncQueue.add({
            id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            table_name: 'template_exercises',
            action: 'INSERT',
            payload: migratedTe,
            timestamp: Date.now(),
            status: 'PENDING'
          });
        }
      }

      // 4. Sessioni di allenamento
      const sessions = await this.workoutSessions.toArray();
      for (const s of sessions) {
        const needsMigrate = !isUuid(s.id) || (s.template_id && templateMap[s.template_id]);
        if (needsMigrate) {
          const newId = isUuid(s.id) ? s.id : generateUUID();
          if (!isUuid(s.id)) {
            sessionMap[s.id] = newId;
          }
          const newTplId = s.template_id ? (templateMap[s.template_id] || s.template_id) : s.template_id;

          const migratedSession = {
            ...s,
            id: newId,
            template_id: newTplId
          };

          if (newId !== s.id) {
            await this.workoutSessions.add(migratedSession);
            await this.workoutSessions.delete(s.id);
          } else {
            await this.workoutSessions.put(migratedSession);
          }

          await this.syncQueue.add({
            id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            table_name: 'workout_sessions',
            action: 'INSERT',
            payload: migratedSession,
            timestamp: Date.now(),
            status: 'PENDING'
          });
          console.log(`FitSyncDB [Runtime Failsafe]: Migrata sessione di allenamento "${s.name}" (${s.id} -> ${newId})`);
        }
      }

      // 5. Set completati
      const sets = await this.workoutSets.toArray();
      for (const set of sets) {
        const needsMigrate = !isUuid(set.id) || sessionMap[set.session_id] || exerciseMap[set.exercise_id];
        if (needsMigrate) {
          const newId = isUuid(set.id) ? set.id : generateUUID();
          const newSessionId = sessionMap[set.session_id] || set.session_id;
          const newExId = exerciseMap[set.exercise_id] || set.exercise_id;

          const migratedSet = {
            ...set,
            id: newId,
            session_id: newSessionId,
            exercise_id: newExId
          };

          if (newId !== set.id) {
            await this.workoutSets.add(migratedSet);
            await this.workoutSets.delete(set.id);
          } else {
            await this.workoutSets.put(migratedSet);
          }

          await this.syncQueue.add({
            id: 'sync-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            table_name: 'workout_sets',
            action: 'INSERT',
            payload: migratedSet,
            timestamp: Date.now(),
            status: 'PENDING'
          });
        }
      }
    } catch (e) {
      console.error('Errore durante la migrazione failsafe in esecuzione:', e);
    }
  }

  private async populateInitialExercises() {
    const defaultExercises: Exercise[] = [
      // Petto
      { id: 'd8970cee-e3d6-4dd0-ab09-c569f3f750f2', name: 'Panca Piana con Bilanciere', category: 'Petto', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: 'd9a5c5c4-fe5b-44c2-b380-adc5aacda21f', name: 'Panca Inclinata con Manubri', category: 'Petto', equipment: 'Manubri', is_custom: false, user_id: null },
      { id: 'ebc33cb9-539d-41f9-bdae-e163dfa09762', name: 'Dip alle Parallele', category: 'Petto', equipment: 'Corpo Libero', is_custom: false, user_id: null },
      { id: 'c8714d09-e448-4a60-baec-6e82092d27a4', name: 'Croci ai Cavi', category: 'Petto', equipment: 'Cavi', is_custom: false, user_id: null },

      // Schiena
      { id: '73c1430b-8c79-490c-bd37-8174fe0beee8', name: 'Stacco da Terra (Deadlift)', category: 'Schiena', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: 'd95f12cc-c0fa-4e29-b172-1ce437fb03f9', name: 'Trazioni alla Sbarra (Pull-up)', category: 'Schiena', equipment: 'Corpo Libero', is_custom: false, user_id: null },
      { id: '8cc14caa-ee32-4042-ac72-f059125d4d03', name: 'Lat Machine Avanti', category: 'Schiena', equipment: 'Macchina', is_custom: false, user_id: null },
      { id: '085593f7-7472-43f6-85f5-a672f7e93719', name: 'Pulley Basso', category: 'Schiena', equipment: 'Cavi', is_custom: false, user_id: null },
      { id: '36e581ac-1306-4b76-87ad-410a6aef3ab0', name: 'Rematore con Bilanciere', category: 'Schiena', equipment: 'Bilanciere', is_custom: false, user_id: null },

      // Gambe
      { id: '9db7902f-dd5f-4ea8-8617-71dfc66f0fcb', name: 'Squat con Bilanciere', category: 'Gambe', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: '95ebce18-a76a-440e-84be-3a07bf0d37a0', name: 'Leg Press 45°', category: 'Gambe', equipment: 'Macchina', is_custom: false, user_id: null },
      { id: 'f35fd411-5022-4e1b-884a-7eb3438ec20c', name: 'Affondi Camminati con Manubri', category: 'Gambe', equipment: 'Manubri', is_custom: false, user_id: null },
      { id: '781e167f-d8ee-45b7-8c5f-9a7828395674', name: 'Leg Extension', category: 'Gambe', equipment: 'Macchina', is_custom: false, user_id: null },
      { id: '461c4269-f5bd-4440-85e1-24fd7c8820dc', name: 'Leg Curl Sdraiato', category: 'Gambe', equipment: 'Macchina', is_custom: false, user_id: null },
      { id: '7752da0c-aa55-4dae-8a64-84a461febd4e', name: 'Calf Raise In Piedi', category: 'Gambe', equipment: 'Macchina', is_custom: false, user_id: null },

      // Spalle
      { id: '9759a35a-c2a2-4096-9422-cffcc25b0a38', name: 'Military Press', category: 'Spalle', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: 'a4bc39b7-8d68-47fc-94f3-f619f19b13bb', name: 'Lento Avanti con Manubri', category: 'Spalle', equipment: 'Manubri', is_custom: false, user_id: null },
      { id: '9f6634fb-ae52-4055-bacc-236082644880', name: 'Alzate Laterali con Manubri', category: 'Spalle', equipment: 'Manubri', is_custom: false, user_id: null },
      { id: '661d2322-266d-4ffa-992f-62dd6fa0d3db', name: 'Alzate Posteriori a 90°', category: 'Spalle', equipment: 'Manubri', is_custom: false, user_id: null },

      // Bicipiti
      { id: '11c3fe8e-7b82-4791-b862-4f0152dcdb6e', name: 'Curl Alternato con Manubri', category: 'Bicipiti', equipment: 'Manubri', is_custom: false, user_id: null },
      { id: '8fab3d46-ba8d-4866-a7d1-7864b127ada0', name: 'Curl con Bilanciere EZ', category: 'Bicipiti', equipment: 'Bilanciere', is_custom: false, user_id: null },

      // Tricipiti
      { id: '63fa0bc9-0773-4d09-8843-b44df47a1946', name: 'French Press panca piana', category: 'Tricipiti', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: '1f77326a-0fc1-4a02-b646-1df719087f03', name: 'Pushdown Tricipiti al Cavo', category: 'Tricipiti', equipment: 'Cavi', is_custom: false, user_id: null },

      // Core
      { id: '098506fa-10b5-4e23-a9ae-cdee10375a11', name: 'Crunch su Tappetino', category: 'Core', equipment: 'Corpo Libero', is_custom: false, user_id: null },
      { id: '00dd5fdd-76cf-4823-bfd3-0d88cff2fbc0', name: 'Plank Addominale', category: 'Core', equipment: 'Corpo Libero', is_custom: false, user_id: null },
      { id: '8391ec26-3a48-422a-899a-1710cb72f18a', name: 'Leg Raise alla Sbarra', category: 'Core', equipment: 'Corpo Libero', is_custom: false, user_id: null }
    ];

    await this.exercises.bulkAdd(defaultExercises);
  }
}

export const db = new FitSyncDatabase();
