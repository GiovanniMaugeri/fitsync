import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { db } from '../db/app-db';
import { WorkoutSession, WorkoutSet, WorkoutSetDetail, TemplateExerciseDetail } from '../models/fitsync.models';
import { SupabaseService } from './supabase.service';
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

@Injectable({
  providedIn: 'root'
})
export class WorkoutService {
  private activeWorkoutSubject = new BehaviorSubject<ActiveWorkoutState | null>(null);
  public activeWorkout$: Observable<ActiveWorkoutState | null> = this.activeWorkoutSubject.asObservable();

  // Rest Timer State
  private restTimerSecondsSubject = new BehaviorSubject<number>(0);
  public restTimerSeconds$: Observable<number> = this.restTimerSecondsSubject.asObservable();
  
  private isTimerRunningSubject = new BehaviorSubject<boolean>(false);
  public isTimerRunning$: Observable<boolean> = this.isTimerRunningSubject.asObservable();
  
  private timerInterval: any = null;

  constructor(
    private supabaseService: SupabaseService,
    private syncService: SyncService
  ) {}

  public get currentActiveWorkout(): ActiveWorkoutState | null {
    return this.activeWorkoutSubject.value;
  }

  async startWorkoutFromTemplate(templateId: string): Promise<ActiveWorkoutState> {
    const template = await db.workoutTemplates.get(templateId);
    const templateExercises = await db.templateExercises.where('template_id').equals(templateId).sortBy('order_index');

    const userId = this.supabaseService.currentUserId;
    const now = new Date().toISOString();
    const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

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
      const ex = await db.exercises.get(te.exercise_id);
      const sets: WorkoutSet[] = [];
      
      // Lookup last weight used for this exercise
      const lastSets = await this.getLastPerformanceForExercise(te.exercise_id);
      const defaultWeight = lastSets.length > 0 ? lastSets[0].weight : 20;

      for (let i = 1; i <= te.target_sets; i++) {
        const lastWeightForSet = lastSets.find(s => s.set_number === i)?.weight || defaultWeight;
        const lastRepsForSet = lastSets.find(s => s.set_number === i)?.reps || te.target_reps;

        sets.push({
          id: 'set-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
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

    this.activeWorkoutSubject.next(state);
    return state;
  }

  async startCustomWorkout(name: string = 'Allenamento Libero'): Promise<ActiveWorkoutState> {
    const userId = this.supabaseService.currentUserId;
    const now = new Date().toISOString();
    const sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);

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

    this.activeWorkoutSubject.next(state);
    return state;
  }

  async addExerciseToActiveWorkout(exerciseId: string) {
    const currentState = this.activeWorkoutSubject.value;
    if (!currentState) return;

    const ex = await db.exercises.get(exerciseId);
    if (!ex) return;

    const lastSets = await this.getLastPerformanceForExercise(exerciseId);
    const defaultWeight = lastSets.length > 0 ? lastSets[0].weight : 20;

    const sets: WorkoutSet[] = [1, 2, 3].map(i => ({
      id: 'set-' + Date.now() + '-' + i + '-' + Math.random().toString(36).substring(2, 5),
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

    this.activeWorkoutSubject.next({ ...currentState });
  }

  async toggleSetCompleted(exerciseIndex: number, setIndex: number, completed?: boolean) {
    const state = this.activeWorkoutSubject.value;
    if (!state) return;

    const setItem = state.exercises[exerciseIndex].sets[setIndex];
    setItem.is_completed = completed !== undefined ? completed : !setItem.is_completed;

    this.activeWorkoutSubject.next({ ...state });

    // Start rest timer if set was completed
    if (setItem.is_completed) {
      const restSeconds = state.exercises[exerciseIndex].rest_time_seconds || 90;
      this.startRestTimer(restSeconds);
    }
  }

  addSetToExercise(exerciseIndex: number) {
    const state = this.activeWorkoutSubject.value;
    if (!state) return;

    const exItem = state.exercises[exerciseIndex];
    const newSetNumber = exItem.sets.length + 1;
    const lastSet = exItem.sets[exItem.sets.length - 1];

    exItem.sets.push({
      id: 'set-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      session_id: state.session.id,
      exercise_id: exItem.exercise_id,
      set_number: newSetNumber,
      reps: lastSet ? lastSet.reps : 10,
      weight: lastSet ? lastSet.weight : 20,
      rpe: 8,
      is_completed: false,
      created_at: new Date().toISOString()
    });

    this.activeWorkoutSubject.next({ ...state });
  }

  removeSetFromExercise(exerciseIndex: number, setIndex: number) {
    const state = this.activeWorkoutSubject.value;
    if (!state) return;

    state.exercises[exerciseIndex].sets.splice(setIndex, 1);
    // Re-index set numbers
    state.exercises[exerciseIndex].sets.forEach((s, idx) => s.set_number = idx + 1);

    this.activeWorkoutSubject.next({ ...state });
  }

  // Rest Timer Controls
  startRestTimer(seconds: number) {
    this.stopRestTimer();
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
      console.log('Timer finished beep!');
    }
  }

  async finishWorkout(notes?: string): Promise<WorkoutSession | null> {
    const state = this.activeWorkoutSubject.value;
    if (!state) return null;

    const endTime = new Date().toISOString();
    const finalSession: WorkoutSession = {
      ...state.session,
      end_time: endTime,
      notes: notes || ''
    };

    // Save session locally in Dexie
    await db.workoutSessions.add(finalSession);
    await this.syncService.enqueue('workout_sessions', 'INSERT', finalSession);

    // Save completed sets
    for (const ex of state.exercises) {
      for (const setItem of ex.sets) {
        if (setItem.is_completed) {
          await db.workoutSets.add(setItem);
          await this.syncService.enqueue('workout_sets', 'INSERT', setItem);
        }
      }
    }

    this.activeWorkoutSubject.next(null);
    this.stopRestTimer();
    return finalSession;
  }

  cancelWorkout() {
    this.activeWorkoutSubject.next(null);
    this.stopRestTimer();
  }

  async getLastPerformanceForExercise(exerciseId: string): Promise<WorkoutSet[]> {
    const sets = await db.workoutSets.where('exercise_id').equals(exerciseId).reverse().toArray();
    if (sets.length === 0) return [];
    
    const lastSessionId = sets[0].session_id;
    return sets.filter(s => s.session_id === lastSessionId);
  }

  async getRecentWorkoutSessions(limit: number = 10): Promise<WorkoutSession[]> {
    const sessions = await db.workoutSessions.orderBy('start_time').reverse().limit(limit).toArray();
    for (const s of sessions) {
      s.sets = await this.getSessionSetsWithExercises(s.id);
    }
    return sessions;
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
    await db.workoutSessions.delete(sessionId);
    await this.syncService.enqueue('workout_sessions', 'DELETE', { id: sessionId });

    const sets = await db.workoutSets.where('session_id').equals(sessionId).toArray();
    for (const setItem of sets) {
      await db.workoutSets.delete(setItem.id);
      await this.syncService.enqueue('workout_sets', 'DELETE', { id: setItem.id });
    }
  }
}
