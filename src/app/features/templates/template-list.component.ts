import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TemplateService } from '../../core/services/template.service';
import { WorkoutService } from '../../core/services/workout.service';
import { SupabaseService, LOCAL_USER_ID } from '../../core/services/supabase.service';
import { WorkoutTemplate } from '../../core/models/fitsync.models';
import { LucideAngularModule, ClipboardList, Pencil, Trash2, Zap, Plus } from 'lucide-angular';

@Component({
  selector: 'app-template-list',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <div class="templates-container">
      <div class="header-row">
        <div class="title-group">
          <h1 class="page-title">Schede d'Allenamento</h1>
          <p class="page-subtitle">Crea e gestisci le tue routine personalizzate per la palestra.</p>
        </div>
      </div>

      <!-- VISIBILITY FILTER BAR -->
      <div class="filter-bar">
        <div class="pills-row">
          <button 
            class="pill-btn" 
            [class.active]="filterVisibility === 'Tutte'" 
            (click)="filterVisibility = 'Tutte'">
            Tutte
          </button>
          <button 
            class="pill-btn" 
            [class.active]="filterVisibility === 'Pubbliche'" 
            (click)="filterVisibility = 'Pubbliche'">
            🌐 Pubbliche
          </button>
          <button 
            class="pill-btn" 
            [class.active]="filterVisibility === 'Private'" 
            (click)="filterVisibility = 'Private'">
            🔒 Private
          </button>
        </div>
      </div>

      <div *ngIf="filteredTemplates.length === 0" class="empty-card glass-card">
        <div class="empty-icon"><lucide-icon [img]="ClipboardList" size="48"></lucide-icon></div>
        <h3>Nessuna scheda trovata</h3>
        <p *ngIf="filterVisibility === 'Private'">Non hai nessuna scheda privata salvata.</p>
        <p *ngIf="filterVisibility !== 'Private'">Crea la tua prima scheda (es. "Push A", "Leg Day") per tracciare le tue serie con carichi target e recuperi.</p>
        <button class="btn btn-primary" routerLink="/templates/new"><lucide-icon [img]="Plus" size="16"></lucide-icon> Crea Scheda</button>
      </div>

      <div class="templates-grid">
        <div *ngFor="let t of filteredTemplates" class="template-card glass-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">{{ t.name }}</h3>
              <p class="card-desc">{{ t.description || 'Nessuna descrizione' }}</p>
              <div class="badge-row">
                <span class="vis-badge" [class.private]="t.is_public === false">
                  {{ t.is_public === false ? '🔒 PRIVATA' : '🌐 PUBBLICA' }}
                </span>
                <span *ngIf="isOtherAuthor(t)" class="author-tag">CREATA DA ALTRI</span>
              </div>
            </div>
            <div class="card-actions" *ngIf="canEdit(t)">
              <button class="icon-btn" [routerLink]="['/templates/edit', t.id]" title="Modifica"><lucide-icon [img]="Pencil" size="16"></lucide-icon></button>
              <button class="icon-btn danger" (click)="deleteTemplate(t.id)" title="Elimina"><lucide-icon [img]="Trash2" size="16"></lucide-icon></button>
            </div>
          </div>

          <div class="exercises-preview">
            <div *ngFor="let item of t.exercises" class="ex-preview-tag">
              <span class="ex-name">{{ item.exercise?.name || 'Esercizio' }}</span>
              <span class="ex-detail">{{ item.target_sets }}x{{ item.target_reps }} ({{ item.rest_time_seconds }}s)</span>
            </div>
          </div>

          <div class="card-footer">
            <button class="btn btn-accent btn-block" (click)="startWorkout(t.id)">
              <lucide-icon [img]="Zap" size="16"></lucide-icon> Avvia Allenamento
            </button>
          </div>
        </div>
      </div>

      <!-- FLOATING ACTION BUTTON (FAB) IN BASSO A DESTRA -->
      <button class="fab-btn" routerLink="/templates/new" title="Nuova Scheda" aria-label="Crea Nuova Scheda">
        <lucide-icon [img]="Plus" size="28"></lucide-icon>
      </button>
    </div>
  `,
  styles: [`
    .templates-container {
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

    .page-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.2;
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

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

    .empty-card {
      text-align: center;
      padding: 3rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;

      .empty-icon { font-size: 3rem; }
    }

    .templates-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }

    .template-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .card-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text-main);
    }

    .card-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }

    .badge-row {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin-top: 0.4rem;
      flex-wrap: wrap;
    }

    .vis-badge {
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

    .author-tag {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-muted);
      border: 1px solid var(--border-color);
    }

    .filter-bar {
      display: flex;
      justify-content: center;
      margin-bottom: 0.25rem;
    }

    .pills-row {
      display: flex;
      gap: 0.4rem;
      background: rgba(15, 23, 42, 0.4);
      padding: 0.3rem;
      border-radius: 20px;
      border: 1px solid var(--border-color);
    }

    .pill-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 0.35rem 0.85rem;
      font-size: 0.82rem;
      font-weight: 500;
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background: #ffffff;
        color: #121212;
        font-weight: 700;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      }
    }

    .card-actions {
      display: flex;
      gap: 0.4rem;
      align-items: center;
    }

    .icon-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      font-size: 1rem;
      cursor: pointer;
      padding: 0.45rem;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
      }

      &.danger {
        color: #f43f5e;
        border-color: rgba(244, 63, 94, 0.35);
        background: rgba(244, 63, 94, 0.12);
      }

      &.danger:hover {
        background: rgba(244, 63, 94, 0.25);
        color: #fb7185;
        border-color: rgba(244, 63, 94, 0.55);
      }
    }

    .exercises-preview {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      background: rgba(15, 23, 42, 0.5);
      border-radius: var(--radius-sm);
      padding: 0.75rem;
    }

    .ex-preview-tag {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      
      .ex-name { color: var(--text-main); font-weight: 500; }
      .ex-detail { color: var(--primary-cyan); font-family: var(--font-mono); font-size: 0.8rem; }
    }

    .btn-block {
      width: 100%;
    }
  `]
})
export class TemplateListComponent implements OnInit {
  readonly ClipboardList = ClipboardList;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly Zap = Zap;
  readonly Plus = Plus;

  templates: WorkoutTemplate[] = [];
  filterVisibility: 'Tutte' | 'Pubbliche' | 'Private' = 'Tutte';

  constructor(
    private templateService: TemplateService,
    private workoutService: WorkoutService,
    private supabaseService: SupabaseService,
    private router: Router
  ) {}

  get currentUserId(): string | undefined {
    return this.supabaseService.currentUserId;
  }

  canEdit(t: WorkoutTemplate): boolean {
    if (!t.user_id) return true;
    if (t.user_id === LOCAL_USER_ID) return true;
    if (!this.currentUserId || this.currentUserId === LOCAL_USER_ID) return true;
    return t.user_id === this.currentUserId;
  }

  isOtherAuthor(t: WorkoutTemplate): boolean {
    if (!t.user_id || t.user_id === LOCAL_USER_ID) return false;
    if (!this.currentUserId || this.currentUserId === LOCAL_USER_ID) return false;
    return t.user_id !== this.currentUserId;
  }

  get filteredTemplates(): WorkoutTemplate[] {
    return this.templates.filter(t => {
      if (this.filterVisibility === 'Pubbliche') {
        return t.is_public !== false;
      }
      if (this.filterVisibility === 'Private') {
        return t.is_public === false;
      }
      return true;
    });
  }

  async ngOnInit() {
    await this.loadTemplates();
  }

  async loadTemplates() {
    this.templates = await this.templateService.getTemplates();
  }

  async startWorkout(templateId: string) {
    await this.workoutService.startWorkoutFromTemplate(templateId);
    this.router.navigate(['/workout/active']);
  }

  async deleteTemplate(id: string) {
    if (confirm('Sei sicuro di voler eliminare questa scheda?')) {
      await this.templateService.deleteTemplate(id);
      await this.loadTemplates();
    }
  }
}
