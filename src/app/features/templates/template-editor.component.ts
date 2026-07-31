import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TemplateService } from '../../core/services/template.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { Exercise, WorkoutTemplate } from '../../core/models/fitsync.models';
import { LucideAngularModule, Save, ArrowUp, ArrowDown, Trash2, X, ArrowLeft, Plus } from 'lucide-angular';

interface SelectedExerciseItem {
  exercise: Exercise;
  target_sets: number;
  target_reps: number;
  rest_time_seconds: number;
}

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, LucideAngularModule],
  template: `
    <div class="editor-container">
      <div class="editor-header">
        <button class="btn btn-outline btn-sm" routerLink="/templates"><lucide-icon [img]="ArrowLeft" size="16"></lucide-icon> Annulla</button>
        <h1 class="page-title">{{ isEdit ? 'Modifica Scheda' : 'Nuova Scheda' }}</h1>
        <button class="btn btn-primary btn-sm" (click)="saveTemplate()" [disabled]="!name.trim() || selectedExercises.length === 0">
          <lucide-icon [img]="Save" size="16"></lucide-icon> Salva Scheda
        </button>
      </div>

      <!-- TEMPLATE DETAILS FORM -->
      <div class="glass-card">
        <div class="form-group">
          <label>Nome Scheda *</label>
          <input type="text" class="input-field" [(ngModel)]="name" placeholder="es. Scheda Push A (Petto, Spalle, Tricipiti)">
        </div>
        <div class="form-group">
          <label>Descrizione (opzionale)</label>
          <input type="text" class="input-field" [(ngModel)]="description" placeholder="es. Focus ipertrofia con recuperi da 90 sec">
        </div>
        <div class="form-group">
          <label>Visibilità Scheda *</label>
          <div class="visibility-toggle">
            <button 
              type="button" 
              class="vis-btn" 
              [class.active]="isPublic === true" 
              (click)="isPublic = true">
              🌐 Pubblica
              <small>Tutti gli utenti possono vederla ed usarla</small>
            </button>
            <button 
              type="button" 
              class="vis-btn" 
              [class.active]="isPublic === false" 
              (click)="isPublic = false">
              🔒 Privata
              <small>Visibile solo a te</small>
            </button>
          </div>
        </div>
      </div>

      <!-- SELECTED EXERCISES LIST -->
      <div class="exercises-section">
        <div class="section-top">
          <h2>Esercizi in Scheda ({{ selectedExercises.length }})</h2>
        </div>

        <div *ngIf="selectedExercises.length === 0" class="empty-list glass-card">
          <p>Nessun esercizio aggiunto. Clicca sul pulsante in basso per selezionare dalla libreria.</p>
        </div>

        <div class="exercises-list">
          <div *ngFor="let item of selectedExercises; let idx = index" class="exercise-item-card glass-card">
            <div class="item-header">
              <div class="item-title">
                <span class="index-badge">#{{ idx + 1 }}</span>
                <div>
                  <h4>{{ item.exercise.name }}</h4>
                  <span class="cat-tag">{{ item.exercise.category }} • {{ item.exercise.equipment }}</span>
                </div>
              </div>
              <div class="reorder-btns">
                <button class="action-btn" (click)="moveUp(idx)" [disabled]="idx === 0" title="Sposta in alto" aria-label="Sposta in alto">
                  <lucide-icon [img]="ArrowUp" size="15"></lucide-icon>
                </button>
                <button class="action-btn" (click)="moveDown(idx)" [disabled]="idx === selectedExercises.length - 1" title="Sposta in basso" aria-label="Sposta in basso">
                  <lucide-icon [img]="ArrowDown" size="15"></lucide-icon>
                </button>
                <button class="action-btn danger" (click)="removeExercise(idx)" title="Elimina esercizio" aria-label="Elimina esercizio">
                  <lucide-icon [img]="Trash2" size="15"></lucide-icon>
                </button>
              </div>
            </div>

            <!-- TARGET SETTINGS WITH STEPPERS -->
            <div class="item-settings">
              <div class="setting-col">
                <label>Serie (Set)</label>
                <div class="stepper-input">
                  <button class="step-btn" (click)="adjustSets(item, -1)" [disabled]="item.target_sets <= 1">-</button>
                  <input type="number" class="num-input" [(ngModel)]="item.target_sets" min="1" max="20">
                  <button class="step-btn" (click)="adjustSets(item, 1)" [disabled]="item.target_sets >= 20">+</button>
                </div>
              </div>

              <div class="setting-col">
                <label>Reps Target</label>
                <div class="stepper-input">
                  <button class="step-btn" (click)="adjustReps(item, -1)" [disabled]="item.target_reps <= 1">-</button>
                  <input type="number" class="num-input" [(ngModel)]="item.target_reps" min="1" max="100">
                  <button class="step-btn" (click)="adjustReps(item, 1)" [disabled]="item.target_reps >= 100">+</button>
                </div>
              </div>

              <div class="setting-col">
                <label>Recupero (s)</label>
                <div class="stepper-input">
                  <button class="step-btn" (click)="adjustRest(item, -10)" [disabled]="item.rest_time_seconds <= 10">-</button>
                  <input type="number" class="num-input" [(ngModel)]="item.rest_time_seconds" min="10" step="5">
                  <button class="step-btn" (click)="adjustRest(item, 10)">+</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TASTO + AGGIUNGI ESERCIZIO COME ULTIMO ELEMENTO -->
        <button class="btn btn-primary btn-block add-exercise-btn" (click)="showExerciseModal = true">
          <lucide-icon [img]="Plus" size="18"></lucide-icon> Aggiungi Esercizio
        </button>
      </div>

      <!-- EXERCISE SEARCH MODAL -->
      <div *ngIf="showExerciseModal" class="modal-backdrop" (click)="showExerciseModal = false">
        <div class="modal-card glass-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>Libreria Esercizi</h3>
            <button class="modal-close-btn" (click)="showExerciseModal = false" title="Chiudi" aria-label="Chiudi libreria esercizi">
              <lucide-icon [img]="X" size="20"></lucide-icon>
            </button>
          </div>

          <div class="modal-search">
            <input type="text" class="input-field" [(ngModel)]="searchQuery" placeholder="Cerca per nome (es. Panca, Squat)...">
            <div class="categories-pills">
              <button 
                *ngFor="let cat of categories" 
                class="pill-btn" 
                [class.active]="selectedCategory === cat"
                (click)="selectedCategory = cat">
                {{ cat }}
              </button>
            </div>
          </div>

          <div class="modal-list">
            <div 
              *ngFor="let ex of filteredExercises" 
              class="ex-select-row"
              (click)="selectExercise(ex)">
              <div>
                <div class="ex-name">{{ ex.name }}</div>
                <div class="ex-sub">{{ ex.category }} • {{ ex.equipment }}</div>
              </div>
              <span class="add-icon">+ Aggiungi</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .editor-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    .page-title {
      font-size: 1.25rem;
      font-weight: 800;
      color: var(--text-main);
      text-align: center;
    }

    .section-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      h2 { font-size: 1.1rem; font-weight: 700; }
    }

    @media (max-width: 480px) {
      .editor-header {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 0.35rem;
      }

      .page-title {
        font-size: 1rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .exercises-section {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }

    .section-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      h2 { font-size: 1.1rem; font-weight: 700; }
    }

    .empty-list {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-muted);
    }

    .exercises-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .add-exercise-btn {
      padding: 0.85rem;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 0.25rem;
      border: 1px dashed rgba(255, 255, 255, 0.25);
    }

    .exercise-item-card {
      padding: 1rem;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 0.8rem;
    }

    .item-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      h4 { color: var(--text-main); font-size: 1rem; }
    }

    .index-badge {
      background: var(--primary-cyan-glow);
      color: var(--primary-cyan);
      font-weight: 800;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      font-size: 0.85rem;
    }

    .cat-tag {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .reorder-btns {
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    .action-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.35);
      }

      &.danger {
        color: #fb7185;
        background: rgba(244, 63, 94, 0.15);
        border-color: rgba(244, 63, 94, 0.35);

        &:hover:not(:disabled) {
          background: #f43f5e;
          color: #ffffff;
          border-color: #f43f5e;
        }
      }

      &:disabled {
        opacity: 0.25;
        cursor: not-allowed;
      }
    }

    .item-settings {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
      gap: 0.6rem;
      background: rgba(0, 0, 0, 0.25);
      padding: 0.75rem 0.85rem;
      border-radius: var(--radius-sm);
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .setting-col {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;

      label {
        font-size: 0.7rem;
        color: var(--text-muted);
        font-weight: 600;
        white-space: nowrap;
      }
    }

    .stepper-input {
      display: flex;
      align-items: center;
      background: #18181b;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      overflow: hidden;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
    }

    .step-btn {
      background: rgba(255, 255, 255, 0.08);
      border: none;
      color: var(--text-main);
      font-size: 1.1rem;
      font-weight: 700;
      width: 32px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s ease;

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
      }

      &:active:not(:disabled) {
        background: rgba(255, 255, 255, 0.3);
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
    }

    .num-input {
      flex: 1;
      min-width: 32px;
      background: transparent;
      border: none;
      color: var(--text-main);
      padding: 0.3rem 0.1rem;
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 0.95rem;
      text-align: center;
      -moz-appearance: textfield;

      &::-webkit-inner-spin-button,
      &::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      &:focus {
        outline: none;
      }
    }

    @media (max-width: 600px) {
      .item-settings {
        grid-template-columns: 1fr;
        gap: 0.65rem;
        padding: 0.85rem;
      }

      .setting-col {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;

        label {
          font-size: 0.85rem;
          color: var(--text-main);
          font-weight: 600;
          min-width: 95px;
        }

        .stepper-input {
          flex: 1;
          max-width: 170px;
          height: 38px;
        }

        .step-btn {
          width: 44px;
          height: 38px;
          font-size: 1.25rem;
        }

        .num-input {
          font-size: 1rem;
        }
      }
    }

    /* Modal Styling */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-card {
      width: 100%;
      max-width: 480px;
      height: 80vh;
      max-height: 600px;
      display: flex;
      flex-direction: column;
      background: #18181b;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
      padding: 1rem 1rem 0.75rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
      h3 { color: var(--text-main); font-size: 1.1rem; font-weight: 700; }
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

    .modal-search {
      padding: 0.85rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.02);
      flex-shrink: 0;
    }

    .categories-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .pill-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 0.3rem 0.65rem;
      font-size: 0.78rem;
      font-weight: 500;
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background: #ffffff;
        color: #121212;
        border-color: #ffffff;
        font-weight: 700;
      }
    }

    .modal-list {
      flex: 1;
      overflow-y: auto;
      padding: 0.75rem 1rem 1rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .ex-select-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      background: rgba(15, 23, 42, 0.6);
      border-radius: var(--radius-sm);
      cursor: pointer;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .ex-name { font-weight: 600; color: var(--text-main); }
      .ex-sub { font-size: 0.75rem; color: var(--text-muted); }
      .add-icon { color: var(--text-main); font-weight: 700; font-size: 0.85rem; }
    }

    .visibility-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
      margin-top: 0.4rem;
    }

    .vis-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 0.6rem;
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 600;
      transition: all 0.15s ease;

      small {
        font-size: 0.7rem;
        font-weight: 400;
        opacity: 0.8;
      }

      &.active {
        background: rgba(255, 255, 255, 0.15);
        color: var(--text-main);
        border-color: #52525b;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
    }
  `]
})
export class TemplateEditorComponent implements OnInit {
  readonly Save = Save;
  readonly ArrowUp = ArrowUp;
  readonly ArrowDown = ArrowDown;
  readonly Trash2 = Trash2;
  readonly X = X;
  readonly ArrowLeft = ArrowLeft;
  readonly Plus = Plus;

  @Input() id?: string;
  isEdit = false;
  name = '';
  description = '';
  isPublic = true;
  selectedExercises: SelectedExerciseItem[] = [];

  allExercises: Exercise[] = [];
  categories = ['Tutti', 'Petto', 'Schiena', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core'];
  selectedCategory = 'Tutti';
  searchQuery = '';
  showExerciseModal = false;

  constructor(
    private templateService: TemplateService,
    private exerciseService: ExerciseService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.allExercises = await this.exerciseService.getAllExercises();

    if (this.id) {
      this.isEdit = true;
      const t = await this.templateService.getTemplateById(this.id);
      if (t) {
        this.name = t.name;
        this.description = t.description || '';
        this.isPublic = t.is_public !== false;
        if (t.exercises) {
          this.selectedExercises = t.exercises.map(te => ({
            exercise: te.exercise || { id: te.exercise_id, name: 'Esercizio', category: 'Generale', is_custom: false },
            target_sets: te.target_sets,
            target_reps: te.target_reps,
            rest_time_seconds: te.rest_time_seconds
          }));
        }
      }
    }
  }

  get filteredExercises(): Exercise[] {
    return this.allExercises.filter(ex => {
      const matchCat = this.selectedCategory === 'Tutti' || ex.category === this.selectedCategory;
      const matchSearch = !this.searchQuery || ex.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }

  selectExercise(ex: Exercise) {
    this.selectedExercises.push({
      exercise: ex,
      target_sets: 3,
      target_reps: 10,
      rest_time_seconds: 90
    });
    this.showExerciseModal = false;
  }

  removeExercise(index: number) {
    this.selectedExercises.splice(index, 1);
  }

  moveUp(index: number) {
    if (index > 0) {
      const temp = this.selectedExercises[index];
      this.selectedExercises[index] = this.selectedExercises[index - 1];
      this.selectedExercises[index - 1] = temp;
    }
  }

  moveDown(index: number) {
    if (index < this.selectedExercises.length - 1) {
      const temp = this.selectedExercises[index];
      this.selectedExercises[index] = this.selectedExercises[index + 1];
      this.selectedExercises[index + 1] = temp;
    }
  }

  adjustSets(item: SelectedExerciseItem, delta: number) {
    item.target_sets = Math.max(1, Math.min(20, (Number(item.target_sets) || 1) + delta));
  }

  adjustReps(item: SelectedExerciseItem, delta: number) {
    item.target_reps = Math.max(1, Math.min(100, (Number(item.target_reps) || 1) + delta));
  }

  adjustRest(item: SelectedExerciseItem, delta: number) {
    item.rest_time_seconds = Math.max(10, Math.min(600, (Number(item.rest_time_seconds) || 60) + delta));
  }

  async saveTemplate() {
    if (!this.name.trim() || this.selectedExercises.length === 0) return;

    const list = this.selectedExercises.map(item => ({
      exercise_id: item.exercise.id,
      target_sets: item.target_sets,
      target_reps: item.target_reps,
      rest_time_seconds: item.rest_time_seconds
    }));

    await this.templateService.saveTemplate(
      this.id || null,
      this.name,
      this.description,
      list,
      this.isPublic
    );

    this.router.navigate(['/templates']);
  }
}
