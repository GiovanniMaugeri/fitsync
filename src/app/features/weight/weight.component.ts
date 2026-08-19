import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LucideAngularModule, Weight, ChevronLeft, ChevronRight, Calendar, Trash2, CheckCircle2 } from 'lucide-angular';
import { WeightService } from '../../core/services/weight.service';
import { BodyWeightLog } from '../../core/models/fitsync.models';

@Component({
  selector: 'app-weight',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  template: `
    <div class="weight-container">
      <div class="page-header">
        <h1 class="page-title">
          <lucide-icon [img]="Weight" size="24" class="title-icon"></lucide-icon>
          Peso
        </h1>
        <p class="page-subtitle">Registra e monitora il tuo peso corporeo.</p>
      </div>

      <!-- DATE NAV HEADER -->
      <div class="date-nav-card">
        <button class="nav-arrow-btn" (click)="changeDate(-1)" title="Giorno precedente">
          <lucide-icon [img]="ChevronLeft" size="20"></lucide-icon>
        </button>

        <div class="date-display" (click)="setToday()">
          <lucide-icon [img]="Calendar" size="18" class="calendar-icon"></lucide-icon>
          <span class="date-text">{{ formattedDisplayDate }}</span>
          @if (isToday) {
            <span class="today-badge">Oggi</span>
          }
        </div>

        <button class="nav-arrow-btn" (click)="changeDate(1)" title="Giorno successivo">
          <lucide-icon [img]="ChevronRight" size="20"></lucide-icon>
        </button>
      </div>

      <!-- ENTRY INPUT CARD -->
      <div class="entry-card">
        <div class="entry-card-header">
          <span class="entry-label">Peso</span>
          @if (selectedEntry) {
            <span class="entry-badge"><lucide-icon [img]="CheckCircle2" size="14"></lucide-icon> Registrato</span>
          }
        </div>
        <div class="entry-input-row">
          <input
            type="text"
            inputmode="decimal"
            placeholder="0.0"
            class="weight-input"
            [(ngModel)]="weightInput"
            (keyup.enter)="save()"
            />
          <span class="unit-label">kg</span>
          <button class="btn btn-primary save-btn" [disabled]="!parsedWeight" (click)="save()">Salva</button>
        </div>
      </div>

      <!-- HISTORY LIST -->
      @if (history.length > 0) {
        <div class="history-list">
          @for (item of history; track item.id) {
            <div class="history-card">
              <div class="card-left">
                <div class="date-badge">
                  <span class="day-number">{{ getDayNumber(item.date) }}</span>
                  <span class="month-name">{{ getMonthName(item.date) }}</span>
                </div>
                <div class="record-info">
                  <span class="full-date">{{ formatFullDate(item.date) }}</span>
                </div>
              </div>
              <div class="card-right">
                <span class="weight-value">{{ item.weight_kg }} kg</span>
                <button class="delete-btn" (click)="deleteEntry($event, item.id)" title="Elimina questa registrazione">
                  <lucide-icon [img]="Trash2" size="16"></lucide-icon>
                </button>
              </div>
            </div>
          }
        </div>
      }

      @if (history.length === 0) {
        <div class="empty-state">
          <lucide-icon [img]="Weight" size="48" class="empty-icon"></lucide-icon>
          <p>Nessun peso registrato ancora.</p>
        </div>
      }
    </div>
    `,
  styles: [`
    .weight-container {
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
        color: #f59e0b;
      }
    }

    .page-subtitle {
      font-size: 0.875rem;
      color: #a1a1aa;
      margin: 0;
    }

    .date-nav-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-card, #18181b);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
      border-radius: 14px;
      padding: 0.6rem 1rem;
    }

    .nav-arrow-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #ffffff;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }
    }

    .date-display {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }

    .calendar-icon {
      color: #f59e0b;
    }

    .date-text {
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffffff;
    }

    .today-badge {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.15rem 0.5rem;
      border-radius: 10px;
    }

    .entry-card {
      background: linear-gradient(145deg, #18181b 0%, #0f172a 100%);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 16px;
      padding: 1rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .entry-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .entry-label {
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
    }

    .entry-badge {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      background: rgba(74, 222, 128, 0.12);
      color: #4ade80;
      border: 1px solid rgba(74, 222, 128, 0.3);
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 10px;
    }

    .entry-input-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .weight-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      color: #ffffff;
      font-size: 1.15rem;
      font-weight: 700;
      padding: 0.6rem 0.8rem;
      min-width: 0;

      &:focus {
        outline: none;
        border-color: #f59e0b;
      }
    }

    .unit-label {
      font-size: 0.9rem;
      font-weight: 600;
      color: #a1a1aa;
    }

    .save-btn {
      background: #f59e0b;
      border: none;
      color: #18181b;
      font-weight: 700;
      padding: 0.6rem 1.1rem;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;

      &:hover:not(:disabled) {
        background: #fbbf24;
      }

      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
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
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.25);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .day-number {
      font-size: 1.1rem;
      font-weight: 800;
      color: #f59e0b;
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

    .card-right {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .weight-value {
      font-size: 1rem;
      font-weight: 800;
      color: #ffffff;
    }

    .delete-btn {
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
export class WeightComponent implements OnInit {
  readonly Weight = Weight;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Calendar = Calendar;
  readonly Trash2 = Trash2;
  readonly CheckCircle2 = CheckCircle2;

  currentDateObj = new Date();
  weightInput = '';
  selectedEntry: BodyWeightLog | null = null;
  history: BodyWeightLog[] = [];

  constructor(
    private weightService: WeightService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.weightService.selectedEntry$.subscribe(entry => {
      this.selectedEntry = entry;
      this.weightInput = entry ? String(entry.weight_kg) : '';
      this.cdr.markForCheck();
    });
    this.weightService.history$.subscribe(logs => {
      this.history = logs;
      this.cdr.markForCheck();
    });
    await this.weightService.loadAll();
  }

  get parsedWeight(): number | null {
    const normalized = (this.weightInput || '').trim().replace(',', '.');
    if (!normalized) return null;
    const val = parseFloat(normalized);
    return isNaN(val) ? null : val;
  }

  async save() {
    const val = this.parsedWeight;
    if (!val) return;
    await this.weightService.saveWeight(val);
  }

  async deleteEntry(event: Event, id: string) {
    event.stopPropagation();
    if (confirm('Sei sicuro di voler eliminare questa registrazione del peso?')) {
      await this.weightService.deleteEntry(id);
    }
  }

  get formattedDisplayDate(): string {
    const d = this.currentDateObj;
    const days = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giug', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  }

  get isToday(): boolean {
    const todayStr = this.weightService.getTodayDateString();
    return this.weightService.formatDate(this.currentDateObj) === todayStr;
  }

  changeDate(daysDelta: number) {
    this.currentDateObj.setDate(this.currentDateObj.getDate() + daysDelta);
    const dateStr = this.weightService.formatDate(this.currentDateObj);
    this.weightService.setDate(dateStr);
  }

  setToday() {
    this.currentDateObj = new Date();
    this.weightService.setDate(this.weightService.getTodayDateString());
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
}
