import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TemplateService } from '../../core/services/template.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { Exercise, WorkoutTemplate } from '../../core/models/fitsync.models';
import { LucideAngularModule, Save, ArrowUp, ArrowDown, Trash2, X, ArrowLeft } from 'lucide-angular';

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
      </div>

      <!-- SELECTED EXERCISES LIST -->
      <div class="exercises-section">
        <div class="section-top">
          <h2>Esercizi in Scheda ({{ selectedExercises.length }})</h2>
          <button class="btn btn-accent btn-sm" (click)="showExerciseModal = true">+ Aggiungi Esercizio</button>
        </div>

        <div *ngIf="selectedExercises.length === 0" class="empty-list glass-card">
          <p>Nessun esercizio aggiunto. Clicca su "+ Aggiungi Esercizio" per selezionare dalla libreria.</p>
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
                <button class="icon-btn" (click)="moveUp(idx)" [disabled]="idx === 0"><lucide-icon [img]="ArrowUp" size="16"></lucide-icon></button>
                <button class="icon-btn" (click)="moveDown(idx)" [disabled]="idx === selectedExercises.length - 1"><lucide-icon [img]="ArrowDown" size="16"></lucide-icon></button>
                <button class="icon-btn danger" (click)="removeExercise(idx)"><lucide-icon [img]="Trash2" size="16"></lucide-icon></button>
              </div>
            </div>

            <!-- TARGET SETTINGS -->
            <div class="item-settings">
              <div class="setting-col">
                <label>Serie (Set)</label>
                <input type="number" class="input-field num-input" [(ngModel)]="item.target_sets" min="1" max="20">
              </div>
              <div class="setting-col">
                <label>Reps Target</label>
                <input type="number" class="input-field num-input" [(ngModel)]="item.target_reps" min="1" max="100">
              </div>
              <div class="setting-col">
                <label>Recupero (sec)</label>
                <input type="number" class="input-field num-input" [(ngModel)]="item.rest_time_seconds" min="10" step="10">
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- EXERCISE SEARCH MODAL -->
      <div *ngIf="showExerciseModal" class="modal-backdrop">
        <div class="modal-card glass-card">
          <div class="modal-header">
            <h3>Libreria Esercizi</h3>
            <button class="icon-btn" (click)="showExerciseModal = false"><lucide-icon [img]="X" size="20"></lucide-icon></button>
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
      gap: 0.2rem;
    }

    .icon-btn {
      background: transparent;
      border: none;
      font-size: 0.9rem;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 4px;
      &:hover { background: rgba(255, 255, 255, 0.1); }
      &.danger:hover { background: rgba(244, 63, 94, 0.2); }
      &:disabled { opacity: 0.3; }
    }

    .item-settings {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(85px, 1fr));
      gap: 0.5rem;
      background: rgba(0, 0, 0, 0.2);
      padding: 0.6rem 0.8rem;
      border-radius: var(--radius-sm);
    }

    .setting-col {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;

      label { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
    }

    .num-input {
      padding: 0.4rem 0.2rem;
      font-family: var(--font-mono);
      font-weight: 700;
      text-align: center;
      width: 100%;
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
      max-width: 450px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #18181b;
      border: 1px solid var(--border-color);
      overflow-y: auto;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      h3 { color: var(--text-main); }
    }

    .modal-search {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .categories-pills {
      display: flex;
      gap: 0.4rem;
      overflow-x: auto;
      padding-bottom: 0.3rem;
    }

    .pill-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 0.25rem 0.6rem;
      font-size: 0.75rem;
      border-radius: 12px;
      white-space: nowrap;
      cursor: pointer;

      &.active {
        background: var(--primary-cyan-glow);
        color: var(--primary-cyan);
        border-color: var(--primary-cyan);
      }
    }

    .modal-list {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 50vh;
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
        background: rgba(6, 182, 212, 0.15);
      }

      .ex-name { font-weight: 600; color: var(--text-main); }
      .ex-sub { font-size: 0.75rem; color: var(--text-muted); }
      .add-icon { color: var(--accent-lime); font-weight: 700; font-size: 0.85rem; }
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

  @Input() id?: string;
  isEdit = false;
  name = '';
  description = '';
  selectedExercises: SelectedExerciseItem[] = [];

  allExercises: Exercise[] = [];
  categories = ['Tutti', 'Petto', 'Schiena', 'Gambe', 'Spalle', 'Braccia', 'Core'];
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
      list
    );

    this.router.navigate(['/templates']);
  }
}
