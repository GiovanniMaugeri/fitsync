import Dexie, { Table } from 'dexie';
import { 
  Profile, 
  Exercise, 
  WorkoutTemplate, 
  TemplateExercise, 
  WorkoutSession, 
  WorkoutSet, 
  SyncQueueItem 
} from '../models/fitsync.models';

export class FitSyncDatabase extends Dexie {
  profiles!: Table<Profile, string>;
  exercises!: Table<Exercise, string>;
  workoutTemplates!: Table<WorkoutTemplate, string>;
  templateExercises!: Table<TemplateExercise, string>;
  workoutSessions!: Table<WorkoutSession, string>;
  workoutSets!: Table<WorkoutSet, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('FitSyncDB');

    this.version(1).stores({
      profiles: 'id, username',
      exercises: 'id, user_id, name, category, equipment, is_custom',
      workoutTemplates: 'id, user_id, name, created_at',
      templateExercises: 'id, template_id, exercise_id, order_index',
      workoutSessions: 'id, user_id, template_id, start_time',
      workoutSets: 'id, session_id, exercise_id, set_number',
      syncQueue: 'id, table_name, action, timestamp, status'
    });

    this.on('populate', () => this.populateInitialExercises());
  }

  private async populateInitialExercises() {
    const defaultExercises: Exercise[] = [
      // Petto
      { id: 'ex-001', name: 'Panca Piana con Bilanciere', category: 'Petto', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: 'ex-002', name: 'Panca Inclinata con Manubri', category: 'Petto', equipment: 'Manubri', is_custom: false, user_id: null },
      { id: 'ex-003', name: 'Dip alle Parallele', category: 'Petto', equipment: 'Corpo Libero', is_custom: false, user_id: null },
      { id: 'ex-004', name: 'Croci ai Cavi', category: 'Petto', equipment: 'Cavi', is_custom: false, user_id: null },

      // Schiena
      { id: 'ex-005', name: 'Stacco da Terra (Deadlift)', category: 'Schiena', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: 'ex-006', name: 'Trazioni alla Sbarra (Pull-up)', category: 'Schiena', equipment: 'Corpo Libero', is_custom: false, user_id: null },
      { id: 'ex-007', name: 'Lat Machine Avanti', category: 'Schiena', equipment: 'Macchina', is_custom: false, user_id: null },
      { id: 'ex-008', name: 'Pulley Basso', category: 'Schiena', equipment: 'Cavi', is_custom: false, user_id: null },
      { id: 'ex-009', name: 'Rematore con Bilanciere', category: 'Schiena', equipment: 'Bilanciere', is_custom: false, user_id: null },

      // Gambe
      { id: 'ex-010', name: 'Squat con Bilanciere', category: 'Gambe', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: 'ex-011', name: 'Leg Press 45°', category: 'Gambe', equipment: 'Macchina', is_custom: false, user_id: null },
      { id: 'ex-012', name: 'Affondi Camminati con Manubri', category: 'Gambe', equipment: 'Manubri', is_custom: false, user_id: null },
      { id: 'ex-013', name: 'Leg Extension', category: 'Gambe', equipment: 'Macchina', is_custom: false, user_id: null },
      { id: 'ex-014', name: 'Leg Curl Sdraiato', category: 'Gambe', equipment: 'Macchina', is_custom: false, user_id: null },
      { id: 'ex-015', name: 'Calf Raise In Piedi', category: 'Gambe', equipment: 'Macchina', is_custom: false, user_id: null },

      // Spalle
      { id: 'ex-016', name: 'Military Press', category: 'Spalle', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: 'ex-017', name: 'Lento Avanti con Manubri', category: 'Spalle', equipment: 'Manubri', is_custom: false, user_id: null },
      { id: 'ex-018', name: 'Alzate Laterali con Manubri', category: 'Spalle', equipment: 'Manubri', is_custom: false, user_id: null },
      { id: 'ex-019', name: 'Alzate Posteriori a 90°', category: 'Spalle', equipment: 'Manubri', is_custom: false, user_id: null },

      // Braccia
      { id: 'ex-020', name: 'Curl Alternato con Manubri', category: 'Braccia', equipment: 'Manubri', is_custom: false, user_id: null },
      { id: 'ex-021', name: 'Curl con Bilanciere EZ', category: 'Braccia', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: 'ex-022', name: 'French Press panca piana', category: 'Braccia', equipment: 'Bilanciere', is_custom: false, user_id: null },
      { id: 'ex-023', name: 'Pushdown Tricipiti al Cavo', category: 'Braccia', equipment: 'Cavi', is_custom: false, user_id: null },

      // Core
      { id: 'ex-024', name: 'Crunch su Tappetino', category: 'Core', equipment: 'Corpo Libero', is_custom: false, user_id: null },
      { id: 'ex-025', name: 'Plank Addominale', category: 'Core', equipment: 'Corpo Libero', is_custom: false, user_id: null },
      { id: 'ex-026', name: 'Leg Raise alla Sbarra', category: 'Core', equipment: 'Corpo Libero', is_custom: false, user_id: null }
    ];

    await this.exercises.bulkAdd(defaultExercises);
  }
}

export const db = new FitSyncDatabase();
