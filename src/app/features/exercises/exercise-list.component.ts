import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ExerciseService } from '../../core/services/exercise.service';
import { Exercise } from '../../core/models/fitsync.models';
import { LucideAngularModule, Dumbbell, Settings, Plus, X } from 'lucide-angular';

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="exercises-container">
      <div class="header-row">
        <div class="title-group">
          <h1 class="page-title">Libreria Esercizi</h1>
          <p class="page-subtitle">Visualizza gli esercizi di sistema o aggiungi le tue varianti custom.</p>
        </div>
      </div>
    
      <!-- SEARCH & FILTER BAR -->
      <div class="glass-card filters-card">
        <input type="text" class="input-field" [(ngModel)]="searchQuery" placeholder="Cerca esercizio per nome (es. Panca, Curl, Squat)...">
    
        <div class="pills-row">
          @for (cat of categories; track cat) {
            <button
              class="pill-btn"
              [class.active]="selectedCategory === cat"
              (click)="selectedCategory = cat">
              {{ cat }}
            </button>
          }
        </div>
      </div>
    
      <!-- EXERCISES GRID -->
      <div class="exercises-grid">
        @for (ex of filteredExercises; track ex) {
          <div class="ex-card glass-card">
            <div class="ex-top">
              <h3 class="ex-title">{{ ex.name }}</h3>
              @if (ex.is_custom) {
                <div class="badges-row">
                  <span class="custom-badge">CUSTOM</span>
                  <span class="vis-tag" [class.private]="ex.is_public === false">
                    {{ ex.is_public === false ? '🔒 PRIVATO' : '🌐 PUBBLICO' }}
                  </span>
                </div>
              }
            </div>
            <div class="ex-details">
              <span class="detail-tag"><lucide-icon [img]="Dumbbell" size="12"></lucide-icon> {{ ex.category }}</span>
              <span class="detail-tag"><lucide-icon [img]="Settings" size="12"></lucide-icon> {{ ex.equipment || 'Corpo Libero' }}</span>
            </div>
          </div>
        }
      </div>
    
      <!-- FLOATING ACTION BUTTON (FAB) IN BASSO A DESTRA -->
      <button class="fab-btn" (click)="showCreateModal = true" title="Nuovo Esercizio Custom" aria-label="Nuovo Esercizio Custom">
        <lucide-icon [img]="Plus" size="28"></lucide-icon>
      </button>
    
      <!-- CREATE CUSTOM EXERCISE MODAL -->
      @if (showCreateModal) {
        <div class="modal-backdrop" (click)="showCreateModal = false">
          <div class="modal-card glass-card" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h3>Nuovo Esercizio Personalizzato</h3>
              <button class="modal-close-btn" (click)="showCreateModal = false" title="Chiudi" aria-label="Chiudi">
                <lucide-icon [img]="X" size="20"></lucide-icon>
              </button>
            </div>
            <div class="form-group">
              <label>Nome Esercizio *</label>
              <input type="text" class="input-field" [(ngModel)]="newExName" placeholder="es. Panca Inclinata alla Smith Machine">
            </div>
            <div class="form-group">
              <label>Categoria Muscolare *</label>
              <select class="input-field" [(ngModel)]="newExCategory">
                <option value="Petto">Petto</option>
                <option value="Schiena">Schiena</option>
                <option value="Gambe">Gambe</option>
                <option value="Spalle">Spalle</option>
                <option value="Bicipiti">Bicipiti</option>
                <option value="Tricipiti">Tricipiti</option>
                <option value="Core">Core</option>
              </select>
            </div>
            <div class="form-group">
              <label>Attrezzo / Equipment</label>
              <select class="input-field" [(ngModel)]="newExEquipment">
                <option value="Bilanciere">Bilanciere</option>
                <option value="Manubri">Manubri</option>
                <option value="Cavi">Cavi</option>
                <option value="Macchina">Macchina</option>
                <option value="Corpo Libero">Corpo Libero</option>
              </select>
            </div>
            <div class="form-group">
              <label>Visibilità Esercizio *</label>
              <div class="visibility-toggle">
                <button
                  type="button"
                  class="vis-btn"
                  [class.active]="newExIsPublic === true"
                  (click)="newExIsPublic = true">
                  🌐 Pubblico
                  <small>Visibile a tutti nella creazione schede</small>
                </button>
                <button
                  type="button"
                  class="vis-btn"
                  [class.active]="newExIsPublic === false"
                  (click)="newExIsPublic = false">
                  🔒 Privato
                  <small>Visibile solo a te</small>
                </button>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn btn-outline" (click)="showCreateModal = false">Annulla</button>
              <button class="btn btn-accent" (click)="createExercise()" [disabled]="!newExName.trim() || isCreating">Crea Esercizio</button>
            </div>
          </div>
        </div>
      }
    </div>
    `,
  styles: [`
    .exercises-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .header-row {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .title-group {
      text-align: center;
    }

    .page-title { font-size: 1.4rem; font-weight: 800; color: var(--text-main); line-height: 1.2; }
    .page-subtitle { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; }

    .fab-btn {
      position: fixed;
      bottom: calc(64px + 1.25rem + env(safe-area-inset-bottom, 0px));
      right: max(1.25rem, calc(50vw - 400px + 1.25rem));
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #ffffff;
      color: #121212;
      border: none;
      box-shadow: 0 6px 20px rgba(255, 255, 255, 0.25), 0 4px 12px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 999;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, box-shadow 0.2s ease;

      &:hover, &:active {
        transform: scale(1.1);
        background: #f4f4f5;
        box-shadow: 0 8px 26px rgba(255, 255, 255, 0.35), 0 6px 16px rgba(0, 0, 0, 0.5);
      }
    }

    .filters-card {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .pill-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 0.3rem 0.65rem;
      font-size: 0.78rem;
      font-weight: 500;
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background: #ffffff;
        color: #121212;
        border-color: #ffffff;
        font-weight: 700;
      }
    }

    .exercises-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 0.85rem;
    }

    .ex-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .ex-top {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.3rem;
    }

    .ex-title { font-size: 1rem; font-weight: 700; color: var(--text-main); }

    .badges-row {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .custom-badge {
      display: inline-block;
      background: rgba(249, 115, 22, 0.2);
      color: var(--accent-orange);
      border: 1px solid rgba(249, 115, 22, 0.35);
      font-size: 0.65rem;
      font-weight: 800;
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }

    .vis-tag {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);

      &.private {
        background: rgba(168, 85, 247, 0.15);
        color: #c084fc;
        border-color: rgba(168, 85, 247, 0.3);
      }
    }

    .visibility-toggle {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.5rem;
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

    .ex-details {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .detail-tag {
      background: rgba(15, 23, 42, 0.6);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 3000;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 8vh 1rem 1rem;
    }

    .modal-card {
      width: 100%;
      max-width: 450px;
      max-height: 90vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #151c28;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      h3 { color: var(--text-main); font-weight: 700; }
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

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
  `]
})
export class ExerciseListComponent implements OnInit {
  readonly Dumbbell = Dumbbell;
  readonly Settings = Settings;
  readonly Plus = Plus;
  readonly X = X;

  exercises: Exercise[] = [];
  categories = ['Tutti', 'Petto', 'Schiena', 'Gambe', 'Spalle', 'Bicipiti', 'Tricipiti', 'Core'];
  selectedCategory = 'Tutti';
  searchQuery = '';

  showCreateModal = false;
  newExName = '';
  newExCategory = 'Petto';
  newExEquipment = 'Bilanciere';
  newExIsPublic = true;
  isCreating = false;

  constructor(private exerciseService: ExerciseService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    await this.loadExercises();
  }

  async loadExercises() {
    this.exercises = await this.exerciseService.getAllExercises();
    this.cdr.markForCheck();
  }

  get filteredExercises(): Exercise[] {
    return this.exercises.filter(ex => {
      const matchCat = this.selectedCategory === 'Tutti' || ex.category === this.selectedCategory;
      const matchSearch = !this.searchQuery || ex.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }

  async createExercise() {
    if (this.isCreating || !this.newExName.trim()) return;

    this.isCreating = true;
    try {
      await this.exerciseService.createCustomExercise(
        this.newExName,
        this.newExCategory,
        this.newExEquipment,
        this.newExIsPublic
      );

      this.newExName = '';
      this.newExIsPublic = true;
      this.showCreateModal = false;
      await this.loadExercises();
    } finally {
      this.isCreating = false;
      this.cdr.markForCheck();
    }
  }
}
