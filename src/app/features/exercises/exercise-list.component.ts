import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExerciseService } from '../../core/services/exercise.service';
import { Exercise } from '../../core/models/fitsync.models';
import { LucideAngularModule, Dumbbell, Settings, Plus, X } from 'lucide-angular';

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="exercises-container">
      <div class="header-row">
        <div>
          <h1 class="page-title">Libreria Esercizi</h1>
          <p class="page-subtitle">Visualizza gli esercizi di sistema o aggiungi le tue varianti custom.</p>
        </div>
        <button class="btn btn-accent" (click)="showCreateModal = true"><lucide-icon [img]="Plus" size="16"></lucide-icon> Nuovo Custom</button>
      </div>

      <!-- SEARCH & FILTER BAR -->
      <div class="glass-card filters-card">
        <input type="text" class="input-field" [(ngModel)]="searchQuery" placeholder="Cerca esercizio per nome (es. Panca, Curl, Squat)...">
        
        <div class="pills-row">
          <button 
            *ngFor="let cat of categories" 
            class="pill-btn"
            [class.active]="selectedCategory === cat"
            (click)="selectedCategory = cat">
            {{ cat }}
          </button>
        </div>
      </div>

      <!-- EXERCISES GRID -->
      <div class="exercises-grid">
        <div *ngFor="let ex of filteredExercises" class="ex-card glass-card">
          <div class="ex-top">
            <h3 class="ex-title">{{ ex.name }}</h3>
            <span *ngIf="ex.is_custom" class="custom-badge">CUSTOM</span>
          </div>
          <div class="ex-details">
            <span class="detail-tag"><lucide-icon [img]="Dumbbell" size="12"></lucide-icon> {{ ex.category }}</span>
            <span class="detail-tag"><lucide-icon [img]="Settings" size="12"></lucide-icon> {{ ex.equipment || 'Corpo Libero' }}</span>
          </div>
        </div>
      </div>

      <!-- CREATE CUSTOM EXERCISE MODAL -->
      <div *ngIf="showCreateModal" class="modal-backdrop">
        <div class="modal-card glass-card">
          <div class="modal-header">
            <h3>Nuovo Esercizio Personalizzato</h3>
            <button class="icon-btn" (click)="showCreateModal = false"><lucide-icon [img]="X" size="20"></lucide-icon></button>
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

          <div class="modal-actions">
            <button class="btn btn-outline" (click)="showCreateModal = false">Annulla</button>
            <button class="btn btn-accent" (click)="createExercise()" [disabled]="!newExName.trim()">Crea Esercizio</button>
          </div>
        </div>
      </div>
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
      justify-content: space-between;
      align-items: center;
    }

    .page-title { font-size: 1.4rem; font-weight: 800; color: var(--text-main); }
    .page-subtitle { font-size: 0.85rem; color: var(--text-muted); }

    .filters-card {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .pills-row {
      display: flex;
      gap: 0.4rem;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: 0.25rem;
      margin: 0 -0.5rem;
      padding-left: 0.5rem;
      padding-right: 0.5rem;
    }

    .pill-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 0.35rem 0.8rem;
      font-size: 0.8rem;
      border-radius: 14px;
      white-space: nowrap;
      cursor: pointer;
      &.active { background: rgba(255, 255, 255, 0.15); color: var(--text-main); border-color: #52525b; }
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
      justify-content: space-between;
      align-items: flex-start;
    }

    .ex-title { font-size: 1rem; font-weight: 700; color: var(--text-main); }

    .custom-badge {
      background: rgba(249, 115, 22, 0.2);
      color: var(--accent-orange);
      font-size: 0.65rem;
      font-weight: 800;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
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
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-card {
      width: 100%;
      max-width: 450px;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #151c28;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      h3 { color: var(--text-main); }
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

  constructor(private exerciseService: ExerciseService) {}

  async ngOnInit() {
    await this.loadExercises();
  }

  async loadExercises() {
    this.exercises = await this.exerciseService.getAllExercises();
  }

  get filteredExercises(): Exercise[] {
    return this.exercises.filter(ex => {
      const matchCat = this.selectedCategory === 'Tutti' || ex.category === this.selectedCategory;
      const matchSearch = !this.searchQuery || ex.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }

  async createExercise() {
    if (!this.newExName.trim()) return;

    await this.exerciseService.createCustomExercise(
      this.newExName,
      this.newExCategory,
      this.newExEquipment
    );

    this.newExName = '';
    this.showCreateModal = false;
    await this.loadExercises();
  }
}
