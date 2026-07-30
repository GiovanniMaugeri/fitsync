import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TemplateService } from '../../core/services/template.service';
import { WorkoutService } from '../../core/services/workout.service';
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
        <button class="btn btn-primary new-btn" routerLink="/templates/new">
          <lucide-icon [img]="Plus" size="16"></lucide-icon> Nuova Scheda
        </button>
      </div>

      <div *ngIf="templates.length === 0" class="empty-card glass-card">
        <div class="empty-icon"><lucide-icon [img]="ClipboardList" size="48"></lucide-icon></div>
        <h3>Nessuna scheda trovata</h3>
        <p>Crea la tua prima scheda (es. "Push A", "Leg Day") per tracciare le tue serie con carichi target e recuperi.</p>
        <button class="btn btn-primary" routerLink="/templates/new"><lucide-icon [img]="Plus" size="16"></lucide-icon> Crea Scheda</button>
      </div>

      <div class="templates-grid">
        <div *ngFor="let t of templates" class="template-card glass-card">
          <div class="card-header">
            <div>
              <h3 class="card-title">{{ t.name }}</h3>
              <p class="card-desc">{{ t.description || 'Nessuna descrizione' }}</p>
            </div>
            <div class="card-actions">
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
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .title-group {
      flex: 1;
      text-align: center;
    }

    .page-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--text-main);
      line-height: 1.2;
      text-align: center;
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
      text-align: center;
    }

    @media (max-width: 500px) {
      .header-row {
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
      }

      .new-btn {
        width: 100%;
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

    .card-actions {
      display: flex;
      gap: 0.3rem;
    }

    .icon-btn {
      background: transparent;
      border: none;
      font-size: 1rem;
      cursor: pointer;
      padding: 0.35rem;
      border-radius: var(--radius-sm);
      &:hover { background: rgba(255, 255, 255, 0.1); }
      &.danger:hover { background: rgba(244, 63, 94, 0.2); }
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

  constructor(
    private templateService: TemplateService,
    private workoutService: WorkoutService,
    private router: Router
  ) {}

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
