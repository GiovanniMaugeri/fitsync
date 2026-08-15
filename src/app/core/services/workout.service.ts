import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { db, generateUUID, fetchRemoteRow, fetchRemoteRows } from '../db/app-db';
import { WorkoutSession, WorkoutSet, WorkoutSetDetail, TemplateExerciseDetail } from '../models/fitsync.models';
import { SupabaseService, LOCAL_USER_ID } from './supabase.service';
import { logger } from '../utils/logger';
import { SyncService } from './sync.service';

export interface ActiveWorkoutState {
  session: WorkoutSession;
  activeExerciseIndex: number;
  exercises: {
    exercise_id: string;
    name: string;
    category: string;
    equipment?: string;
    sets: WorkoutSet[];
    target_sets: number;
    target_reps: number;
    rest_time_seconds: number;
  }[];
}

// Stato effimero, locale al device (non sync-ato su Supabase né su Dexie): a differenza
// dei dati di dominio, deve sopravvivere a un refresh e il rest timer va ricalcolato subito
// da questo timestamp senza attendere una query async a IndexedDB. Vedi ADR nel vault:
// "Persistenza stato allenamento attivo in localStorage".
const ACTIVE_WORKOUT_STORAGE_KEY = 'fitsync_active_workout_state';
const REST_TIMER_END_STORAGE_KEY = 'fitsync_rest_timer_end_timestamp';

@Injectable({
  providedIn: 'root'
})
export class WorkoutService {
  public activeWorkout = signal<ActiveWorkoutState | null>(null);

  // Rest Timer State
  private restTimerSecondsSubject = new BehaviorSubject<number>(0);
  public restTimerSeconds$: Observable<number> = this.restTimerSecondsSubject.asObservable();
  
  private isTimerRunningSubject = new BehaviorSubject<boolean>(false);
  public isTimerRunning$: Observable<boolean> = this.isTimerRunningSubject.asObservable();
  
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private supabaseService: SupabaseService,
    private syncService: SyncService
  ) {
    this.restoreActiveWorkoutFromStorage();
  }

  public updateActiveWorkoutState(state: ActiveWorkoutState | null) {
    this.activeWorkout.set(state);
    this.saveActiveWorkoutToStorage(state);
  }

  public saveCurrentState() {
    const currentState = this.activeWorkout();
    this.saveActiveWorkoutToStorage(currentState);
  }

  private saveActiveWorkoutToStorage(state: ActiveWorkoutState | null) {
    try {
      if (state) {
        localStorage.setItem(ACTIVE_WORKOUT_STORAGE_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
        localStorage.removeItem(REST_TIMER_END_STORAGE_KEY);
      }
    } catch (e) {
      logger.warn('FitSync: Errore durante il salvataggio dello stato allenamento:', e);
    }
  }

  private restoreActiveWorkoutFromStorage() {
    try {
      const saved = localStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY);
      if (saved) {
        const state: ActiveWorkoutState = JSON.parse(saved);
        if (state && state.session && state.exercises) {
          this.activeWorkout.set(state);

          const timerEnd = localStorage.getItem(REST_TIMER_END_STORAGE_KEY);
          if (timerEnd) {
            const endTs = parseInt(timerEnd, 10);
            const remaining = Math.ceil((endTs - Date.now()) / 1000);
            if (remaining > 0) {
              this.startRestTimer(remaining);
            } else {
              localStorage.removeItem(REST_TIMER_END_STORAGE_KEY);
            }
          }
        }
      }
    } catch (e) {
      logger.warn('FitSync: Errore ripristino allenamento attivo da localStorage:', e);
    }
  }

  public get currentActiveWorkout(): ActiveWorkoutState | null {
    return this.activeWorkout();
  }

  async startWorkoutFromTemplate(templateId: string): Promise<ActiveWorkoutState> {
    const client = this.supabaseService.supabase;

    let template = await db.workoutTemplates.get(templateId);
    if (!template && client && this.supabaseService.currentUserId && this.supabaseService.currentUserId !== LOCAL_USER_ID) {
      template = await fetchRemoteRow(client, 'workout_templates', 'id', templateId, db.workoutTemplates);
    }

    let templateExercises = await db.templateExercises.where('template_id').equals(templateId).sortBy('order_index');
    if (templateExercises.length === 0 && client && this.supabaseService.currentUserId && this.supabaseService.currentUserId !== LOCAL_USER_ID) {
      templateExercises = await fetchRemoteRows(client, 'template_exercises', 'template_id', templateId, db.templateExercises, 'order_index');
    }

    const userId = this.supabaseService.currentUserId;
    const now = new Date().toISOString();
    const sessionId = generateUUID();

    const session: WorkoutSession = {
      id: sessionId,
      user_id: userId,
      template_id: templateId,
      name: template?.name || 'Allenamento Personalizzato',
      start_time: now,
      created_at: now
    };

    const exercisesState: ActiveWorkoutState['exercises'] = [];

    for (const te of templateExercises) {
      let ex = await db.exercises.get(te.exercise_id);
      if (!ex && client && this.supabaseService.currentUserId && this.supabaseService.currentUserId !== LOCAL_USER_ID) {
        ex = await fetchRemoteRow(client, 'exercises', 'id', te.exercise_id, db.exercises);
      }

      const sets: WorkoutSet[] = [];
      
      // Lookup last weight used for this exercise
      const lastSets = await this.getLastPerformanceForExercise(te.exercise_id);
      const defaultWeight = lastSets.length > 0 ? lastSets[0].weight : 20;

      for (let i = 1; i <= te.target_sets; i++) {
        const lastWeightForSet = lastSets.find(s => s.set_number === i)?.weight || defaultWeight;
        const lastRepsForSet = lastSets.find(s => s.set_number === i)?.reps || te.target_reps;

        sets.push({
          id: generateUUID(),
          session_id: sessionId,
          exercise_id: te.exercise_id,
          set_number: i,
          reps: lastRepsForSet,
          weight: lastWeightForSet,
          rpe: 8,
          is_completed: false,
          created_at: now
        });
      }

      exercisesState.push({
        exercise_id: te.exercise_id,
        name: ex?.name || 'Esercizio',
        category: ex?.category || 'Generale',
        equipment: ex?.equipment,
        sets,
        target_sets: te.target_sets,
        target_reps: te.target_reps,
        rest_time_seconds: te.rest_time_seconds
      });
    }

    const state: ActiveWorkoutState = {
      session,
      activeExerciseIndex: 0,
      exercises: exercisesState
    };

    this.updateActiveWorkoutState(state);
    return state;
  }

  async startCustomWorkout(name: string = 'Allenamento Libero'): Promise<ActiveWorkoutState> {
    const userId = this.supabaseService.currentUserId;
    const now = new Date().toISOString();
    const sessionId = generateUUID();

    const session: WorkoutSession = {
      id: sessionId,
      user_id: userId,
      template_id: null,
      name,
      start_time: now,
      created_at: now
    };

    const state: ActiveWorkoutState = {
      session,
      activeExerciseIndex: 0,
      exercises: []
    };

    this.updateActiveWorkoutState(state);
    return state;
  }

  async addExerciseToActiveWorkout(exerciseId: string) {
    const currentState = this.activeWorkout();
    if (!currentState) return;

    const ex = await db.exercises.get(exerciseId);
    if (!ex) return;

    const lastSets = await this.getLastPerformanceForExercise(exerciseId);
    const defaultWeight = lastSets.length > 0 ? lastSets[0].weight : 20;

    const sets: WorkoutSet[] = [1, 2, 3].map(i => ({
      id: generateUUID(),
      session_id: currentState.session.id,
      exercise_id: exerciseId,
      set_number: i,
      reps: 10,
      weight: defaultWeight,
      rpe: 8,
      is_completed: false,
      created_at: new Date().toISOString()
    }));

    currentState.exercises.push({
      exercise_id: exerciseId,
      name: ex.name,
      category: ex.category,
      equipment: ex.equipment,
      sets,
      target_sets: 3,
      target_reps: 10,
      rest_time_seconds: 90
    });

    this.updateActiveWorkoutState({ ...currentState });
  }

  async toggleSetCompleted(exerciseIndex: number, setIndex: number, completed?: boolean) {
    const state = this.activeWorkout();
    if (!state) return;

    const setItem = state.exercises[exerciseIndex].sets[setIndex];
    setItem.is_completed = completed !== undefined ? completed : !setItem.is_completed;

    this.updateActiveWorkoutState({ ...state });

    // Start rest timer if set was completed
    if (setItem.is_completed) {
      const restSeconds = state.exercises[exerciseIndex].rest_time_seconds || 90;
      this.startRestTimer(restSeconds);
    }
  }

  addSetToExercise(exerciseIndex: number) {
    const state = this.activeWorkout();
    if (!state) return;

    const exItem = state.exercises[exerciseIndex];
    const newSetNumber = exItem.sets.length + 1;
    const lastSet = exItem.sets[exItem.sets.length - 1];

    exItem.sets.push({
      id: generateUUID(),
      session_id: state.session.id,
      exercise_id: exItem.exercise_id,
      set_number: newSetNumber,
      reps: lastSet ? lastSet.reps : 10,
      weight: lastSet ? lastSet.weight : 20,
      rpe: 8,
      is_completed: false,
      created_at: new Date().toISOString()
    });

    this.updateActiveWorkoutState({ ...state });
  }

  removeSetFromExercise(exerciseIndex: number, setIndex: number) {
    const state = this.activeWorkout();
    if (!state) return;

    state.exercises[exerciseIndex].sets.splice(setIndex, 1);
    // Re-index set numbers
    state.exercises[exerciseIndex].sets.forEach((s, idx) => s.set_number = idx + 1);

    this.updateActiveWorkoutState({ ...state });
  }

  // Rest Timer Controls
  startRestTimer(seconds: number) {
    this.stopRestTimer();

    const endTimestamp = Date.now() + seconds * 1000;
    try {
      localStorage.setItem(REST_TIMER_END_STORAGE_KEY, endTimestamp.toString());
    } catch (e) {}

    this.restTimerSecondsSubject.next(seconds);
    this.isTimerRunningSubject.next(true);

    this.timerInterval = setInterval(() => {
      const current = this.restTimerSecondsSubject.value;
      if (current <= 1) {
        this.stopRestTimer();
        this.playBeepSound();
      } else {
        this.restTimerSecondsSubject.next(current - 1);
      }
    }, 1000);
  }

  stopRestTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    try {
      localStorage.removeItem(REST_TIMER_END_STORAGE_KEY);
    } catch (e) {}
    this.isTimerRunningSubject.next(false);
    this.restTimerSecondsSubject.next(0);
  }

  private playBeepSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      logger.log('Timer finished beep!');
    }
  }

  async finishWorkout(notes?: string): Promise<WorkoutSession | null> {
    const state = this.activeWorkout();
    if (!state) return null;

    const endTime = new Date().toISOString();
    const finalSession: WorkoutSession = {
      ...state.session,
      end_time: endTime,
      notes: notes || ''
    };

    // Save session locally in Dexie
    await db.workoutSessions.add(finalSession);
    await this.syncService.enqueue('workout_sessions', 'INSERT', { ...finalSession });

    // Save completed sets
    for (const ex of state.exercises) {
      for (const setItem of ex.sets) {
        if (setItem.is_completed) {
          await db.workoutSets.add(setItem);
          await this.syncService.enqueue('workout_sets', 'INSERT', { ...setItem });
        }
      }
    }

    this.updateActiveWorkoutState(null);
    this.stopRestTimer();
    return finalSession;
  }

  cancelWorkout() {
    this.updateActiveWorkoutState(null);
    this.stopRestTimer();
  }

  async getLastPerformanceForExercise(exerciseId: string): Promise<WorkoutSet[]> {
    const currentUserId = this.supabaseService.currentUserId;
    const sets = await db.workoutSets.where('exercise_id').equals(exerciseId).reverse().toArray();
    if (sets.length === 0) return [];

    for (const setItem of sets) {
      const session = await db.workoutSessions.get(setItem.session_id);
      if (session) {
        const isUserSession = (currentUserId && currentUserId !== LOCAL_USER_ID)
          ? session.user_id === currentUserId
          : (!session.user_id || session.user_id === LOCAL_USER_ID);

        if (isUserSession) {
          return sets.filter(s => s.session_id === setItem.session_id);
        }
      }
    }

    return [];
  }

  async getRecentWorkoutSessions(limit: number = 10): Promise<WorkoutSession[]> {
    const currentUserId = this.supabaseService.currentUserId;
    const client = this.supabaseService.supabase;

    // Se l'utente è autenticato su Supabase, allineiamo le sue sessioni personali da remoto
    if (client && currentUserId && currentUserId !== LOCAL_USER_ID) {
      try {
        const { data: remoteSessions, error } = await client
          .from('workout_sessions')
          .select('*')
          .eq('user_id', currentUserId)
          .order('start_time', { ascending: false })
          .limit(limit);

        if (!error && remoteSessions && remoteSessions.length > 0) {
          await db.workoutSessions.bulkPut(remoteSessions);

          const sessionIds = remoteSessions.map(s => s.id);
          const { data: remoteSets } = await client
            .from('workout_sets')
            .select('*')
            .in('session_id', sessionIds);

          if (remoteSets && remoteSets.length > 0) {
            await db.workoutSets.bulkPut(remoteSets);
          }
        }
      } catch (err) {
        logger.warn('FitSync: Errore allineamento remoto sessioni:', err);
      }
    }

    const allSessions = await db.workoutSessions.orderBy('start_time').reverse().toArray();

    // Filtriamo le sessioni garantendo la privacy (mostriamo solo le sessioni dell'utente loggato)
    const userSessions = allSessions.filter(s => {
      if (currentUserId && currentUserId !== LOCAL_USER_ID) {
        return s.user_id === currentUserId;
      }
      return !s.user_id || s.user_id === LOCAL_USER_ID;
    }).slice(0, limit);

    for (const s of userSessions) {
      s.sets = await this.getSessionSetsWithExercises(s.id);
    }
    return userSessions;
  }

  async getSessionSetsWithExercises(sessionId: string): Promise<WorkoutSetDetail[]> {
    const sets = await db.workoutSets.where('session_id').equals(sessionId).sortBy('set_number');
    const result: WorkoutSetDetail[] = [];
    for (const setItem of sets) {
      const exercise = await db.exercises.get(setItem.exercise_id);
      result.push({
        ...setItem,
        exercise
      });
    }
    return result;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await db.workoutSessions.get(sessionId);
    if (!session) return;

    const currentUserId = this.supabaseService.currentUserId;
    if (session.user_id && session.user_id !== LOCAL_USER_ID && session.user_id !== currentUserId) {
      logger.warn('Non puoi eliminare sessioni di altri utenti.');
      return;
    }

    await db.workoutSessions.delete(sessionId);
    await this.syncService.enqueue('workout_sessions', 'DELETE', { id: sessionId });

    const sets = await db.workoutSets.where('session_id').equals(sessionId).toArray();
    for (const setItem of sets) {
      await db.workoutSets.delete(setItem.id);
      await this.syncService.enqueue('workout_sets', 'DELETE', { id: setItem.id });
    }
  }
}
