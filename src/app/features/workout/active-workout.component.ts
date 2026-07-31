import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { WorkoutService, ActiveWorkoutState } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { Exercise } from '../../core/models/fitsync.models';
import { LucideAngularModule, Dumbbell, Zap, ClipboardList, Radio, Flag, Timer, Check, Trash2, Trophy, Save, X } from 'lucide-angular';

@Component({
  selector: 'app-active-workout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule],
  template: `
    <div class="active-workout-container">
      <!-- NO ACTIVE WORKOUT STATE -->
      <div *ngIf="!(activeState$ | async)" class="empty-state glass-card">
        <div class="empty-icon"><lucide-icon [img]="Dumbbell" size="48"></lucide-icon></div>
        <h2>Nessun allenamento attivo</h2>
        <p>Inizia una sessione libera o seleziona una scheda per partire!</p>
        <div class="actions-row">
          <button class="btn btn-accent free-workout-btn" (click)="startFree()"><lucide-icon [img]="Zap" size="16"></lucide-icon> Allenamento Libero</button>
          <button class="btn btn-primary" routerLink="/templates"><lucide-icon [img]="ClipboardList" size="16"></lucide-icon> Scegli da Scheda</button>
        </div>
      </div>

      <!-- ACTIVE WORKOUT INTERFACE -->
      <div *ngIf="activeState$ | async as state" class="workout-content">
        <!-- TOP WORKOUT BAR -->
        <div class="workout-top-bar glass-card">
          <div>
            <span class="live-pill"><lucide-icon [img]="Radio" size="12"></lucide-icon> IN CORSO</span>
            <h1 class="workout-title">{{ state.session.name }}</h1>
          </div>

          <div class="top-controls">
            <button class="btn btn-danger btn-sm" (click)="cancelWorkout()">Annulla</button>
            <button class="btn btn-accent btn-sm" (click)="showFinishModal = true"><lucide-icon [img]="Flag" size="14"></lucide-icon> Termina</button>
          </div>
        </div>

        <!-- REST TIMER OVERLAY / BANNER -->
        <div *ngIf="isTimerRunning$ | async" class="timer-banner glass-card">
          <div class="timer-info">
            <span class="timer-icon"><lucide-icon [img]="Timer" size="28"></lucide-icon></span>
            <div>
              <span class="timer-label">RECUPERO IN CORSO</span>
              <span class="timer-countdown">{{ formatTimer(restTimerSeconds$ | async) }}</span>
            </div>
          </div>
          <button class="btn btn-stop-timer" (click)="stopTimer()">Salta / Stop</button>
        </div>

        <!-- EXERCISES TABS / NAVIGATOR -->
        <div class="exercise-tabs">
          <button 
            *ngFor="let ex of state.exercises; let idx = index" 
            class="tab-btn"
            [class.active]="state.activeExerciseIndex === idx"
            (click)="selectExerciseTab(idx)">
            <span>{{ idx + 1 }}. {{ ex.name }}</span>
            <span class="completed-count">({{ getCompletedSetsCount(ex) }}/{{ ex.sets.length }})</span>
          </button>
          <button class="tab-btn add-tab" (click)="showAddExerciseModal = true">+ Esercizio</button>
        </div>

        <!-- CURRENT EXERCISE WORKOUT AREA -->
        <div *ngIf="state.exercises[state.activeExerciseIndex] as currentEx" class="exercise-card glass-card">
          <div class="ex-card-header">
            <div>
              <h2 class="ex-name">{{ currentEx.name }}</h2>
              <span class="ex-meta">{{ currentEx.category }} • {{ currentEx.equipment }} | Target: {{ currentEx.target_sets }}x{{ currentEx.target_reps }} ({{ currentEx.rest_time_seconds }}s rec)</span>
            </div>
            <button class="btn timer-start-btn" (click)="startTimer(currentEx.rest_time_seconds)">
              <lucide-icon [img]="Timer" size="16"></lucide-icon> Avvia Timer {{ currentEx.rest_time_seconds }}s
            </button>
          </div>

          <!-- SETS TABLE -->
          <div class="sets-table-wrapper">
            <table class="sets-table">
              <thead>
                <tr>
                  <th class="col-set">SET</th>
                  <th class="col-input">PESO (KG)</th>
                  <th class="col-input">REPS</th>
                  <th class="col-input">RPE (1-10)</th>
                  <th class="col-check">FATTO</th>
                  <th class="col-action"></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of currentEx.sets; let setIdx = index" [class.completed-row]="s.is_completed">
                  <td class="col-set">
                    <span class="set-number">#{{ s.set_number }}</span>
                  </td>
                  <td class="col-input">
                    <input type="number" class="set-input" [(ngModel)]="s.weight" (ngModelChange)="onInputChange()" step="0.5" min="0">
                  </td>
                  <td class="col-input">
                    <input type="number" class="set-input" [(ngModel)]="s.reps" (ngModelChange)="onInputChange()" step="1" min="1">
                  </td>
                  <td class="col-input">
                    <input type="number" class="set-input rpe-input" [(ngModel)]="s.rpe" (ngModelChange)="onInputChange()" step="0.5" min="1" max="10">
                  </td>
                  <td class="col-check">
                    <button 
                      class="check-btn" 
                      [class.checked]="s.is_completed" 
                      (click)="toggleSet(state.activeExerciseIndex, setIdx)">
                      <lucide-icon *ngIf="s.is_completed" [img]="Check" size="18"></lucide-icon>
                    </button>
                  </td>
                  <td class="col-action">
                    <button class="icon-btn danger" (click)="removeSet(state.activeExerciseIndex, setIdx)"><lucide-icon [img]="Trash2" size="18"></lucide-icon></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="table-actions">
            <button class="btn btn-outline btn-sm" (click)="addSet(state.activeExerciseIndex)">
              + Aggiungi Serie (Set)
            </button>
          </div>
        </div>
      </div>

      <!-- FINISH WORKOUT MODAL -->
      <div *ngIf="showFinishModal" class="modal-backdrop">
        <div class="modal-card glass-card">
          <h3>Termina e Salva Allenamento <lucide-icon [img]="Trophy" size="20"></lucide-icon></h3>
          <p>Ottimo lavoro! Inserisci note o sensazioni (opzionale):</p>
          <textarea class="input-field" [(ngModel)]="sessionNotes" rows="3" placeholder="es. Ottime sensazioni sulla panca piana, aumentato carico..."></textarea>
          <div class="modal-actions">
            <button class="btn btn-outline" (click)="showFinishModal = false">Torna all'Allenamento</button>
            <button class="btn btn-accent" (click)="finishWorkout()"><lucide-icon [img]="Save" size="16"></lucide-icon> Salva e Concludi</button>
          </div>
        </div>
      </div>

      <!-- ADD EXERCISE MODAL -->
      <div *ngIf="showAddExerciseModal" class="modal-backdrop" (click)="showAddExerciseModal = false">
        <div class="modal-card glass-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Aggiungi Esercizio all'Allenamento</h3>
            <button class="modal-close-btn" (click)="showAddExerciseModal = false" title="Chiudi" aria-label="Chiudi">
              <lucide-icon [img]="X" size="20"></lucide-icon>
            </button>
          </div>
          <input type="text" class="input-field search-ex-input" [(ngModel)]="searchQuery" placeholder="🔍 Cerca esercizio per nome...">
          <div class="modal-ex-list">
            <div *ngFor="let ex of filteredExercises" class="modal-ex-item" (click)="addExerciseToWorkout(ex.id)">
              <div>
                <div class="ex-title">{{ ex.name }}</div>
                <div class="ex-sub">{{ ex.category }} • {{ ex.equipment || 'Corpo Libero' }}</div>
              </div>
              <span class="add-txt">+ Aggiungi</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .active-workout-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      .empty-icon { font-size: 3.5rem; }
      .actions-row {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        justify-content: center;
        width: 100%;
      }

      .free-workout-btn {
        border: 2px solid rgba(255, 255, 255, 0.45) !important;
        background: rgba(39, 39, 42, 0.9);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4), 0 0 10px rgba(255, 255, 255, 0.08);

        &:hover, &:active {
          border-color: #ffffff !important;
          background: #3f3f46;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5), 0 0 14px rgba(255, 255, 255, 0.2);
        }
      }
    }

    .workout-content {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .workout-top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
    }

    .live-pill {
      font-size: 0.7rem;
      font-weight: 800;
      color: var(--accent-rose);
      letter-spacing: 0.05em;
    }

    .workout-title {
      font-size: 1.2rem;
      font-weight: 800;
      color: var(--text-main);
    }

    .top-controls {
      display: flex;
      gap: 0.5rem;
    }

    .timer-banner {
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.35) 0%, rgba(132, 204, 22, 0.35) 100%);
      border: 2px solid var(--primary-cyan);
      box-shadow: 0 0 16px rgba(6, 182, 212, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.9rem 1.25rem;
      border-radius: var(--radius-md);
    }

    .timer-info {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      .timer-icon { color: #38bdf8; display: flex; align-items: center; }
    }

    .timer-label {
      font-size: 0.75rem;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.06em;
      display: block;
    }

    .timer-countdown {
      font-family: var(--font-mono);
      font-size: 2rem;
      font-weight: 900;
      color: #a3e635;
      text-shadow: 0 0 12px rgba(163, 230, 53, 0.6);
      line-height: 1.1;
    }

    .btn-stop-timer {
      background: rgba(255, 255, 255, 0.12);
      border: 1.5px solid rgba(255, 255, 255, 0.4);
      color: #ffffff;
      font-weight: 700;
      font-size: 0.85rem;
      padding: 0.5rem 0.9rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.25);
        border-color: #ffffff;
        color: #ffffff;
      }
    }

    .timer-start-btn {
      background: rgba(6, 182, 212, 0.18);
      border: 1.5px solid var(--primary-cyan);
      color: #ffffff;
      font-weight: 700;
      font-size: 0.85rem;
      padding: 0.45rem 0.85rem;
      border-radius: var(--radius-sm);
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      cursor: pointer;
      transition: all 0.15s ease;
      box-shadow: 0 0 10px rgba(6, 182, 212, 0.2);

      &:hover {
        background: rgba(6, 182, 212, 0.35);
        border-color: #38bdf8;
        color: #ffffff;
        box-shadow: 0 0 14px rgba(6, 182, 212, 0.4);
      }
    }

    .exercise-tabs {
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      padding-bottom: 0.4rem;
    }

    .tab-btn {
      background: rgba(21, 28, 40, 0.85);
      border: 1px solid var(--border-color);
      color: #cbd5e1;
      padding: 0.6rem 0.9rem;
      border-radius: var(--radius-md);
      font-family: var(--font-main);
      font-size: 0.85rem;
      font-weight: 600;
      white-space: nowrap;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;

      &.active {
        background: var(--primary-cyan-glow);
        color: #ffffff;
        border-color: var(--primary-cyan);
        font-weight: 700;
      }

      .completed-count { font-size: 0.75rem; color: #a3e635; font-family: var(--font-mono); font-weight: 800; }
    }

    .add-tab {
      background: rgba(132, 204, 22, 0.22);
      color: #ffffff;
      font-size: 0.9rem;
      font-weight: 800;
      border: 1.5px solid #84cc16;
      box-shadow: 0 0 10px rgba(132, 204, 22, 0.2);

      &:hover {
        background: rgba(132, 204, 22, 0.4);
        border-color: #a3e635;
        color: #ffffff;
        box-shadow: 0 0 14px rgba(163, 230, 53, 0.35);
      }
    }

    .exercise-card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .ex-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0.75rem;

      .ex-name { font-size: 1.15rem; font-weight: 800; color: var(--text-main); }
      .ex-meta { font-size: 0.8rem; color: var(--text-muted); display: block; }
    }

    .sets-table-wrapper {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin: 0 -0.5rem;
      padding: 0 0.5rem;
    }

    .sets-table {
      width: 100%;
      min-width: 320px;
      border-collapse: collapse;

      th {
        text-align: center;
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--text-muted);
        padding: 0.4rem 0.2rem;
      }

      td {
        padding: 0.4rem 0.2rem;
        text-align: center;
      }

      tr.completed-row {
        background: rgba(34, 197, 94, 0.08);
      }
    }

    .col-set { width: 36px; }
    .col-input { min-width: 65px; }
    .col-check { width: 44px; }
    .col-action { width: 36px; }

    .set-number {
      font-family: var(--font-mono);
      font-weight: 800;
      color: var(--primary-cyan);
    }

    .set-input {
      width: 100%;
      background: #18181b;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 0.4rem 0.2rem;
      color: var(--text-main);
      font-family: var(--font-mono);
      font-weight: 700;
      text-align: center;
      font-size: 0.95rem;

      &:focus {
        border-color: #52525b;
        outline: none;
      }
    }

    .rpe-input { color: var(--accent-orange); }

    .check-btn {
      width: 38px;
      height: 38px;
      border-radius: var(--radius-sm);
      border: 2px solid var(--border-color);
      background: transparent;
      color: #0b0f17;
      font-size: 1.2rem;
      font-weight: 900;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      transition: all 0.2s ease;

      &.checked {
        background: var(--accent-lime);
        border-color: var(--accent-lime);
      }
    }

    .table-actions {
      display: flex;
      justify-content: center;
      width: 100%;
      margin-top: 0.75rem;
    }

    /* Modal Backdrop */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 3000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-card {
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #151c28;
    }

    .modal-actions {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.75rem;
      width: 100%;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-close-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;
      flex-shrink: 0;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.35);
        color: #ffffff;
      }

      &:active {
        transform: scale(0.95);
      }
    }

    .modal-ex-list {
      max-height: 50vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .search-ex-input {
      font-size: 0.95rem;
      padding: 0.75rem 1rem;
      border: 1.5px solid var(--border-color);
      border-radius: var(--radius-md);
      margin-bottom: 0.5rem;

      &:focus {
        border-color: var(--primary-cyan);
        box-shadow: 0 0 10px rgba(6, 182, 212, 0.25);
      }
    }

    .modal-ex-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.85rem 1rem;
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: #334155;
        border-color: var(--primary-cyan);
        transform: translateY(-1px);
      }

      .ex-title { font-weight: 700; color: #ffffff; font-size: 0.95rem; }
      .ex-sub { font-size: 0.8rem; color: #94a3b8; margin-top: 0.15rem; }
      .add-txt {
        background: var(--accent-lime);
        color: #0b0f17;
        font-weight: 900;
        font-size: 0.85rem;
        padding: 0.35rem 0.75rem;
        border-radius: var(--radius-sm);
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        box-shadow: 0 2px 6px rgba(132, 204, 22, 0.3);
      }
    }

    @media (max-width: 600px) {
      .workout-top-bar {
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.75rem;
      }

      .top-controls {
        justify-content: center;
        width: 100%;
      }

      .ex-card-header {
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.75rem;

        button {
          align-self: center;
        }
      }

      .timer-banner {
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.75rem;
      }

      .empty-state {
        .actions-row {
          flex-direction: column;
          align-items: center;
          width: 100%;

          .btn {
            width: 100%;
            justify-content: center;
          }
        }
      }
    }
  `]
})
export class ActiveWorkoutComponent implements OnInit, OnDestroy {
  readonly Dumbbell = Dumbbell;
  readonly Zap = Zap;
  readonly ClipboardList = ClipboardList;
  readonly Radio = Radio;
  readonly Flag = Flag;
  readonly Timer = Timer;
  readonly Check = Check;
  readonly Trash2 = Trash2;
  readonly Trophy = Trophy;
  readonly Save = Save;
  readonly X = X;

  activeState$: Observable<ActiveWorkoutState | null>;
  restTimerSeconds$: Observable<number>;
  isTimerRunning$: Observable<boolean>;

  showFinishModal = false;
  showAddExerciseModal = false;
  sessionNotes = '';
  searchQuery = '';

  allExercises: Exercise[] = [];

  constructor(
    private workoutService: WorkoutService,
    private exerciseService: ExerciseService,
    private router: Router
  ) {
    this.activeState$ = this.workoutService.activeWorkout$;
    this.restTimerSeconds$ = this.workoutService.restTimerSeconds$;
    this.isTimerRunning$ = this.workoutService.isTimerRunning$;
  }

  async ngOnInit() {
    this.allExercises = await this.exerciseService.getAllExercises();
  }

  ngOnDestroy() {}

  async startFree() {
    await this.workoutService.startCustomWorkout('Allenamento Libero');
  }

  selectExerciseTab(idx: number) {
    const currentState = this.workoutService.currentActiveWorkout;
    if (currentState) {
      currentState.activeExerciseIndex = idx;
      this.workoutService.saveCurrentState();
    }
  }

  onInputChange() {
    this.workoutService.saveCurrentState();
  }

  getCompletedSetsCount(ex: ActiveWorkoutState['exercises'][0]): number {
    return ex.sets.filter(s => s.is_completed).length;
  }

  toggleSet(exIdx: number, setIdx: number) {
    this.workoutService.toggleSetCompleted(exIdx, setIdx);
  }

  addSet(exIdx: number) {
    this.workoutService.addSetToExercise(exIdx);
  }

  removeSet(exIdx: number, setIdx: number) {
    this.workoutService.removeSetFromExercise(exIdx, setIdx);
  }

  startTimer(sec: number) {
    this.workoutService.startRestTimer(sec);
  }

  stopTimer() {
    this.workoutService.stopRestTimer();
  }

  formatTimer(sec: number | null): string {
    if (!sec) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }

  get filteredExercises(): Exercise[] {
    if (!this.searchQuery) return this.allExercises;
    return this.allExercises.filter(ex => ex.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
  }

  async addExerciseToWorkout(exerciseId: string) {
    await this.workoutService.addExerciseToActiveWorkout(exerciseId);
    this.showAddExerciseModal = false;
  }

  async finishWorkout() {
    await this.workoutService.finishWorkout(this.sessionNotes);
    this.showFinishModal = false;
    this.router.navigate(['/history']);
  }

  cancelWorkout() {
    if (confirm('Sei sicuro di voler annullare questo allenamento? I dati non salvati andranno persi.')) {
      this.workoutService.cancelWorkout();
      this.router.navigate(['/']);
    }
  }
}
