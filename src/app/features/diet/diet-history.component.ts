import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { LucideAngularModule, Calendar, Flame, ChevronRight, CheckCircle2, AlertCircle, Trash2 } from 'lucide-angular';
import { DietService } from '../../core/services/diet.service';

interface HistoryRecord {
  date: string;
  total_calories: number;
  target_calories: number;
  meal_count: number;
}

@Component({
  selector: 'app-diet-history',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <div class="diet-history-container">
      <div class="page-header">
        <h1 class="page-title">
          <lucide-icon [img]="Calendar" size="24" class="title-icon"></lucide-icon>
          Storico Giorni Passati
        </h1>
        <p class="page-subtitle">Consulta o elimina i pasti e il totale calorico dei giorni precedenti.</p>
      </div>

      <!-- HISTORY LIST -->
      <div class="history-list" *ngIf="historyRecords.length > 0">
        <div 
          class="history-card" 
          *ngFor="let item of historyRecords" 
          (click)="selectDate(item.date)"
        >
          <div class="card-left">
            <div class="date-badge">
              <span class="day-number">{{ getDayNumber(item.date) }}</span>
              <span class="month-name">{{ getMonthName(item.date) }}</span>
            </div>
            
            <div class="record-info">
              <span class="full-date">{{ formatFullDate(item.date) }}</span>
              <span class="meals-count">{{ item.meal_count }} pasti registrati</span>
            </div>
          </div>

          <div class="card-right">
            <div class="calorie-tag">
              <span class="flame-icon"><lucide-icon [img]="Flame" size="16"></lucide-icon></span>
              <span class="cal-val">{{ item.total_calories }}</span>
              <span class="cal-target">/ {{ item.target_calories }} kcal</span>
            </div>

            <div class="status-indicator" [class.success]="item.total_calories <= item.target_calories && item.total_calories > 0" [class.over]="item.total_calories > item.target_calories">
              <lucide-icon [img]="CheckCircle2" size="16" *ngIf="item.total_calories <= item.target_calories && item.total_calories > 0"></lucide-icon>
              <lucide-icon [img]="AlertCircle" size="16" *ngIf="item.total_calories > item.target_calories"></lucide-icon>
            </div>

            <button class="delete-history-btn" (click)="deleteRecord($event, item.date)" title="Elimina questo giorno dallo storico">
              <lucide-icon [img]="Trash2" size="16"></lucide-icon>
            </button>

            <lucide-icon [img]="ChevronRight" size="18" class="arrow-icon"></lucide-icon>
          </div>
        </div>
      </div>

      <div *ngIf="historyRecords.length === 0" class="empty-state">
        <lucide-icon [img]="Calendar" size="48" class="empty-icon"></lucide-icon>
        <p>Nessuna registrazione passata trovata.</p>
        <a routerLink="/diet" class="btn btn-primary btn-sm">Vai a Oggi</a>
      </div>
    </div>
  `,
  styles: [`
    .diet-history-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      max-width: 650px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .page-title {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 1.5rem;
      font-weight: 800;
      color: #ffffff;
      margin: 0;

      .title-icon {
        color: var(--primary-cyan, #06b6d4);
      }
    }

    .page-subtitle {
      font-size: 0.875rem;
      color: #a1a1aa;
      margin: 0;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .history-card {
      background: var(--bg-card, #18181b);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
      border-radius: 14px;
      padding: 0.85rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(6, 182, 212, 0.4);
        transform: translateX(2px);
      }
    }

    .card-left {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .date-badge {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.25);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .day-number {
      font-size: 1.1rem;
      font-weight: 800;
      color: var(--primary-cyan, #06b6d4);
      line-height: 1;
    }

    .month-name {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #a1a1aa;
      margin-top: 0.1rem;
    }

    .record-info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .full-date {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
    }

    .meals-count {
      font-size: 0.775rem;
      color: #a1a1aa;
    }

    .card-right {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .calorie-tag {
      display: flex;
      align-items: baseline;
      gap: 0.25rem;
      background: rgba(255, 255, 255, 0.04);
      padding: 0.35rem 0.65rem;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .flame-icon {
      color: #f97316;
      display: flex;
    }

    .cal-val {
      font-size: 0.95rem;
      font-weight: 800;
      color: #ffffff;
    }

    .cal-target {
      font-size: 0.725rem;
      color: #a1a1aa;
    }

    .status-indicator {
      display: flex;
      color: #71717a;

      &.success {
        color: #4ade80;
      }
      &.over {
        color: #f87171;
      }
    }

    .delete-history-btn {
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.35);
      color: #f43f5e;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(244, 63, 94, 0.25);
        color: #fb7185;
        border-color: rgba(244, 63, 94, 0.55);
      }
    }

    .arrow-icon {
      color: #71717a;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1rem;
      color: #a1a1aa;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .empty-icon {
      color: #71717a;
    }
  `]
})
export class DietHistoryComponent implements OnInit {
  readonly Calendar = Calendar;
  readonly Flame = Flame;
  readonly ChevronRight = ChevronRight;
  readonly CheckCircle2 = CheckCircle2;
  readonly AlertCircle = AlertCircle;
  readonly Trash2 = Trash2;

  historyRecords: HistoryRecord[] = [];

  constructor(
    private dietService: DietService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.loadHistory();
  }

  async loadHistory() {
    this.historyRecords = await this.dietService.getRecentHistory(30);
    this.cdr.markForCheck();
  }

  getDayNumber(dateStr: string): string {
    const parts = dateStr.split('-');
    return parts[2] || '';
  }

  getMonthName(dateStr: string): string {
    const parts = dateStr.split('-');
    const monthIndex = parseInt(parts[1] || '1', 10) - 1;
    const months = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
    return months[monthIndex] || '';
  }

  formatFullDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  }

  selectDate(dateStr: string) {
    this.dietService.setDate(dateStr);
    this.router.navigate(['/diet']);
  }

  async deleteRecord(event: Event, dateStr: string) {
    event.stopPropagation();
    if (confirm(`Sei sicuro di voler eliminare la registrazione dello storico per ${this.formatFullDate(dateStr)}?`)) {
      await this.dietService.deleteDietLogByDate(dateStr);
      await this.loadHistory();
    }
  }
}
