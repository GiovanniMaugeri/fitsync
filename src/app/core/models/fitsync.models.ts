export interface Profile {
  id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Exercise {
  id: string;
  user_id?: string | null;
  name: string;
  category: string; // Petto, Schiena, Gambe, Bicipiti, Tricipiti, Spalle, Core
  equipment?: string; // Bilanciere, Manubri, Cavi, Macchina, Corpo Libero
  is_custom: boolean;
  is_public?: boolean; // true = Pubblico (visibile a tutti), false = Privato (visibile solo al creatore)
  created_at?: string;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_public?: boolean; // true = Pubblica (visibile a tutti), false = Privata (visibile solo al creatore)
  created_at?: string;
  updated_at?: string;
  exercises?: TemplateExerciseDetail[];
}

export interface TemplateExercise {
  id: string;
  template_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_reps: number;
  rest_time_seconds: number;
}

export interface TemplateExerciseDetail extends TemplateExercise {
  exercise?: Exercise;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  template_id?: string | null;
  name: string;
  start_time: string;
  end_time?: string | null;
  notes?: string;
  created_at?: string;
  sets?: WorkoutSetDetail[];
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe?: number;
  is_completed: boolean;
  created_at?: string;
}

export interface WorkoutSetDetail extends WorkoutSet {
  exercise?: Exercise;
}

export interface DietLog {
  id: string;
  user_id: string;
  date: string; // 'YYYY-MM-DD'
  target_calories?: number;
  created_at?: string;
  meals?: DietMealDetail[];
}

export interface DietMeal {
  id: string;
  user_id?: string;
  diet_log_id: string;
  name: string; // e.g. "Pasto 1", "Colazione", "Pranzo", "Cena", "Spuntino"
  order_index: number;
}

export interface DietLogItem {
  id: string;
  user_id?: string;
  meal_id: string;
  name: string; // e.g. "Petto di Pollo e Riso"
  calories: number; // kcal
  amount_note?: string; // e.g. "200g" or "1 porzione"
  created_at?: string;
}

export interface DietMealDetail extends DietMeal {
  items: DietLogItem[];
  total_calories: number;
}

export interface SyncQueueItem {
  id: string;
  table_name: 'profiles' | 'exercises' | 'workout_templates' | 'template_exercises' | 'workout_sessions' | 'workout_sets' | 'diet_logs' | 'diet_meals' | 'diet_log_items';
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  timestamp: number;
  status: 'PENDING' | 'SYNCING' | 'ERROR';
  error_message?: string;
  retry_count?: number;
  next_retry_at?: number;
}
