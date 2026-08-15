import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkoutService } from '../../core/services/workout.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { SyncService } from '../../core/services/sync.service';
import { WorkoutSession } from '../../core/models/fitsync.models';
import { LucideAngularModule, History, Calendar, Clock, Dumbbell, ChevronUp, ChevronDown, Trash2, MessageSquare } from 'lucide-angular';

@Component({
  selector: 'app-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="history-container">
      <div class="header-row">
        <div class="title-group">
          <h1 class="page-title">Storico Allenamenti</h1>
          <p class="page-subtitle">Rivedi le sessioni completate e controlla i tuoi progressi.</p>
        </div>
      </div>

      <div *ngIf="sessions.length === 0" class="empty-card glass-card">
        <div class="empty-icon"><lucide-icon [img]="HistoryIcon" size="48"></lucide-icon></div>
        <h3>Nessuna sessione nello storico</h3>
        <p>Completa il tuo primo allenamento per vedere l'elenco dei tuoi set e volumi qui.</p>
      </div>

      <div class="sessions-list">
        <div *ngFor="let s of sessions" class="session-card glass-card">
          <div class="session-header" (click)="toggleExpand(s.id)">
            <div>
              <h3 class="session-title">{{ s.name }}</h3>
              <div class="session-meta">
                <span><lucide-icon [img]="Calendar" size="14"></lucide-icon> {{ formatDate(s.start_time) }}</span>
                <span *ngIf="s.end_time"><lucide-icon [img]="Clock" size="14"></lucide-icon> {{ calculateDuration(s.start_time, s.end_time) }} min</span>
                <span><lucide-icon [img]="Dumbbell" size="14"></lucide-icon> {{ s.sets?.length || 0 }} set</span>
              </div>
            </div>
            <div class="header-right">
              <button class="expand-btn" (click)="toggleExpand(s.id)" [title]="expandedSessionId === s.id ? 'Comprimi' : 'Espandi Dettagli'" aria-label="Dettagli sessione">
                <lucide-icon *ngIf="expandedSessionId === s.id" [img]="ChevronUp" size="18"></lucide-icon>
                <lucide-icon *ngIf="expandedSessionId !== s.id" [img]="ChevronDown" size="18"></lucide-icon>
              </button>
              <button class="icon-btn danger" (click)="deleteSession($event, s.id)" title="Elimina Sessione" aria-label="Elimina Sessione">
                <lucide-icon [img]="Trash2" size="18"></lucide-icon>
              </button>
            </div>
          </div>

          <!-- EXPANDED SET DETAILS -->
          <div *ngIf="expandedSessionId === s.id" class="session-details">
            <p *ngIf="s.notes" class="notes-quote"><lucide-icon [img]="MessageSquare" size="14"></lucide-icon> "{{ s.notes }}"</p>

            <div class="sets-by-exercise">
              <div *ngFor="let group of groupSetsByExercise(s.sets)" class="ex-group">
                <h4 class="group-ex-name">{{ group.exerciseName }}</h4>
                <div class="sets-chips">
                  <span *ngFor="let setItem of group.sets" class="set-chip">
                    Set {{ setItem.set_number }}: <strong>{{ setItem.weight }} kg</strong> × {{ setItem.reps }} reps <small *ngIf="setItem.rpe">(RPE {{ setItem.rpe }})</small>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .history-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .header-row {
      display: flex;
      justify-content: center;
      text-align: center;
    }

    .title-group {
      text-align: center;
    }

    .page-title { font-size: 1.4rem; font-weight: 800; color: var(--text-main); text-align: center; }
    .page-subtitle { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem; text-align: center; }

    .empty-card {
      text-align: center;
      padding: 3rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      .empty-icon { font-size: 3rem; }
    }

    .sessions-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .session-card {
      padding: 1rem 1.25rem;
    }

    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    }

    .session-title { font-size: 1.1rem; font-weight: 700; color: var(--text-main); }

    .session-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.6rem;
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .expand-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
        border-color: rgba(255, 255, 255, 0.3);
      }

      &:active {
        transform: scale(0.95);
      }
    }

    .icon-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      width: 36px;
      height: 36px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
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

      &:active {
        transform: scale(0.95);
      }
    }

    .session-details {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .notes-quote {
      font-style: italic;
      color: var(--primary-cyan);
      font-size: 0.85rem;
      background: rgba(6, 182, 212, 0.08);
      padding: 0.5rem 0.8rem;
      border-radius: var(--radius-sm);
    }

    .sets-by-exercise {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .ex-group {
      background: rgba(15, 23, 42, 0.6);
      padding: 0.6rem 0.85rem;
      border-radius: var(--radius-sm);
    }

    .group-ex-name { font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.4rem; }

    .sets-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .set-chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border-color);
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.8rem;
      color: var(--text-main);
      strong { color: var(--accent-lime); }
      small { color: var(--accent-orange); margin-left: 0.2rem; }
    }
  `]
})
export class HistoryComponent implements OnInit {
  readonly HistoryIcon = History;
  readonly Calendar = Calendar;
  readonly Clock = Clock;
  readonly Dumbbell = Dumbbell;
  readonly ChevronUp = ChevronUp;
  readonly ChevronDown = ChevronDown;
  readonly Trash2 = Trash2;
  readonly MessageSquare = MessageSquare;

  sessions: WorkoutSession[] = [];
  expandedSessionId: string | null = null;

  constructor(
    private workoutService: WorkoutService,
    private supabaseService: SupabaseService,
    private syncService: SyncService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.loadSessions();

    this.supabaseService.currentUser$.subscribe(() => {
      this.loadSessions();
    });

    this.syncService.isSyncing$.subscribe(isSyncing => {
      if (!isSyncing) {
        this.loadSessions();
      }
    });
  }

  async loadSessions() {
    this.sessions = await this.workoutService.getRecentWorkoutSessions(30);
    this.cdr.markForCheck();
  }

  toggleExpand(id: string) {
    this.expandedSessionId = this.expandedSessionId === id ? null : id;
    this.cdr.markForCheck();
  }

  groupSetsByExercise(sets?: any[]) {
    if (!sets) return [];
    const groupsMap = new Map<string, { exerciseName: string; sets: any[] }>();

    for (const setItem of sets) {
      const exName = setItem.exercise?.name || 'Esercizio';
      if (!groupsMap.has(exName)) {
        groupsMap.set(exName, { exerciseName: exName, sets: [] });
      }
      groupsMap.get(exName)!.sets.push(setItem);
    }

    return Array.from(groupsMap.values());
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  calculateDuration(start: string, end: string): number {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(1, Math.round((e - s) / 60000));
  }

  async deleteSession(event: Event, sessionId: string) {
    event.stopPropagation();
    if (confirm('Sei sicuro di voler eliminare questa sessione dallo storico?')) {
      await this.workoutService.deleteSession(sessionId);
      await this.loadSessions();
    }
  }
}
