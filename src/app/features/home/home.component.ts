import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { WorkoutService } from '../../core/services/workout.service';
import { TemplateService } from '../../core/services/template.service';
import { SyncService } from '../../core/services/sync.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { WorkoutSession, WorkoutTemplate } from '../../core/models/fitsync.models';
import { LucideAngularModule, Zap, PlayCircle, FileText, Calendar, Clock, CheckCircle, User } from 'lucide-angular';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <div class="home-container">
      <div class="header-row">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Gestisci i tuoi allenamenti e traccia le tue schede.</p>
        </div>
        <button class="btn btn-primary" (click)="startFreeWorkout()">
          <lucide-icon [img]="Zap" size="16"></lucide-icon> Allenamento Rapido
        </button>
      </div>
    
      <!-- PROMPT DI LOGIN -->
      @if (!(currentUser$ | async)) {
        <div class="glass-card login-prompt-card">
          <div class="prompt-text">
            <h3>Sincronizza i tuoi Allenamenti</h3>
            <p>Accedi o crea un account per salvare i dati nel cloud su Supabase ed evitare di perderli.</p>
          </div>
          <button class="btn btn-primary btn-sm" routerLink="/auth">
            <lucide-icon [img]="User" size="14"></lucide-icon> Accedi / Registrati
          </button>
        </div>
      }
    
      <!-- TEMPLATES QUICK ACCESS -->
      <section class="section">
        <div class="section-header">
          <h2>Le tue Schede d'Allenamento</h2>
          <a routerLink="/templates" class="link-more">Vedi tutte ({{ templates.length }}) →</a>
        </div>
    
        @if (templates.length === 0) {
          <div class="empty-state glass-card">
            <p>Non hai ancora creato schede d'allenamento.</p>
            <button class="btn btn-primary btn-sm" routerLink="/templates/new">+ Crea Prima Scheda</button>
          </div>
        }
    
        <div class="template-grid">
          @for (t of templates.slice(0, 3); track t) {
            <div class="template-card glass-card glass-card-interactive" [class.is-disabled]="isStarting" (click)="startFromTemplate(t.id)">
              <div class="template-top">
                <h3 class="template-title">{{ t.name }}</h3>
                <span class="ex-count">{{ t.exercises?.length || 0 }} esercizi</span>
              </div>
              <p class="template-desc">{{ t.description || 'Nessuna descrizione.' }}</p>
              <div class="template-footer">
                <span class="start-link">
                  <lucide-icon [img]="PlayCircle" size="16"></lucide-icon> Avvia Ora
                </span>
              </div>
            </div>
          }
        </div>
      </section>
    
      <!-- RECENT SESSIONS -->
      <section class="section">
        <div class="section-header">
          <h2>Ultimi Allenamenti Completati</h2>
          <a routerLink="/history" class="link-more">Storico completo →</a>
        </div>
    
        @if (recentSessions.length === 0) {
          <div class="empty-state glass-card">
            <p>Nessun allenamento registrato di recente. Inizia il tuo primo workout!</p>
          </div>
        }
    
        <div class="sessions-list">
          @for (s of recentSessions; track s) {
            <div class="session-card glass-card">
              <div class="session-main">
                <div>
                  <h4 class="session-name">{{ s.name }}</h4>
                  <div class="session-meta">
                    <span><lucide-icon [img]="Calendar" size="14"></lucide-icon> {{ formatDate(s.start_time) }}</span>
                    @if (s.end_time) {
                      <span><lucide-icon [img]="Clock" size="14"></lucide-icon> {{ calculateDuration(s.start_time, s.end_time) }} min</span>
                    }
                  </div>
                </div>
                <div class="session-stats">
                  <span class="sets-badge">{{ s.sets?.length || 0 }} set completati</span>
                </div>
              </div>
            </div>
          }
        </div>
      </section>
    </div>
    `,
  styles: [`
    .home-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.5rem;
    }

    .page-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--text-main);
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.1rem;
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      h2 {
        font-size: 1.15rem;
        font-weight: 700;
      }

      .link-more {
        font-size: 0.85rem;
        color: var(--primary-cyan);
        text-decoration: none;
        &:hover { text-decoration: underline; }
      }
    }

    .empty-state {
      text-align: center;
      padding: 2rem 1rem;
      color: var(--text-muted);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.8rem;
    }

    .template-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1rem;
    }

    .template-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;

      &.is-disabled {
        pointer-events: none;
        opacity: 0.6;
      }

      .template-top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 0.4rem;
      }

      .template-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-main);
      }

      .ex-count {
        font-size: 0.75rem;
        color: var(--primary-cyan);
        background: rgba(6, 182, 212, 0.15);
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
      }

      .template-desc {
        font-size: 0.85rem;
        color: var(--text-muted);
        margin-bottom: 1rem;
      }

      .template-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;

        .start-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          background: transparent;
          border: none;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.85rem;
          line-height: 1;
          transition: opacity 0.15s ease;

          lucide-icon {
            display: inline-flex;
            align-items: center;
            line-height: 1;
          }

          &:hover {
            opacity: 0.85;
          }
        }
      }
    }

    .sessions-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .session-card {
      padding: 1rem;
    }

    .session-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .session-name {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-main);
    }

    .session-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }

    .sets-badge {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-color);
      padding: 0.3rem 0.6rem;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      font-weight: 600;
    }

    .login-prompt-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
      border: 1px dashed rgba(255, 255, 255, 0.15);

      @media (max-width: 600px) {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
      }
    }

    .prompt-text {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;

      h3 {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-main);
      }

      p {
        font-size: 0.85rem;
        color: var(--text-muted);
        line-height: 1.4;
      }
    }
  `]
})
export class HomeComponent implements OnInit {
  readonly Zap = Zap;
  readonly PlayCircle = PlayCircle;
  readonly FileText = FileText;
  readonly Calendar = Calendar;
  readonly Clock = Clock;
  readonly CheckCircle = CheckCircle;
  readonly User = User;
 
  private workoutService = inject(WorkoutService);
  private templateService = inject(TemplateService);
  private syncService = inject(SyncService);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  templates: WorkoutTemplate[] = [];
  recentSessions: WorkoutSession[] = [];
  isStarting = false;
  isOnline = this.syncService.isOnline;
  currentUser$ = this.supabaseService.currentUser$;

  constructor() {
    effect(() => {
      if (!this.syncService.isSyncing()) {
        this.loadData();
      }
    });
  }

  async ngOnInit() {
    await this.loadData();

    this.supabaseService.currentUser$.subscribe(() => {
      this.loadData();
    });
  }

  async loadData() {
    this.templates = await this.templateService.getTemplates();
    this.recentSessions = await this.workoutService.getRecentWorkoutSessions(5);
    this.cdr.markForCheck();
  }

  async startFreeWorkout() {
    await this.workoutService.startCustomWorkout('Allenamento Libero');
    this.router.navigate(['/workout/active']);
  }

  async startFromTemplate(templateId: string) {
    if (this.isStarting) return;
    this.isStarting = true;
    try {
      await this.workoutService.startWorkoutFromTemplate(templateId);
      this.router.navigate(['/workout/active']);
    } finally {
      this.isStarting = false;
      this.cdr.markForCheck();
    }
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  calculateDuration(start: string, end: string): number {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(1, Math.round((e - s) / 60000));
  }
}
