import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { LucideAngularModule, TrendingUp, ChevronLeft, ChevronRight, Weight } from 'lucide-angular';
import { WeightService } from '../../core/services/weight.service';

type Granularity = 'day' | 'week' | 'month';

interface DailyWeight {
  date: string;
  weight_kg: number;
}

interface ChartPoint {
  label: string;
  hasData: boolean;
  weight: number | null;
}

interface LineChart {
  path: string;
  dots: { x: number; y: number }[];
  minLabel: string;
  maxLabel: string;
}

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

@Component({
  selector: 'app-weight-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="weight-dashboard-container">
      <div class="page-header">
        <h1 class="page-title">
          <lucide-icon [img]="TrendingUp" size="24" class="title-icon"></lucide-icon>
          Andamento
        </h1>
        <p class="page-subtitle">Trend del peso corporeo nel tempo.</p>
      </div>

      <!-- GRANULARITY SELECTOR -->
      <div class="granularity-selector">
        <button class="granularity-btn" [class.active]="granularity === 'day'" (click)="setGranularity('day')">Giorno</button>
        <button class="granularity-btn" [class.active]="granularity === 'week'" (click)="setGranularity('week')">Settimana</button>
        <button class="granularity-btn" [class.active]="granularity === 'month'" (click)="setGranularity('month')">Mese</button>
      </div>

      <!-- WINDOW NAV -->
      <div class="window-nav-card">
        <button class="nav-arrow-btn" (click)="changeWindow(-1)" title="Finestra precedente">
          <lucide-icon [img]="ChevronLeft" size="20"></lucide-icon>
        </button>
        <div class="window-label" (click)="resetWindow()">
          <span class="window-text">{{ windowLabel }}</span>
          @if (windowOffset !== 0) {
            <span class="today-badge">Torna a oggi</span>
          }
        </div>
        <button class="nav-arrow-btn" [disabled]="!canGoForward" (click)="changeWindow(1)" title="Finestra successiva">
          <lucide-icon [img]="ChevronRight" size="20"></lucide-icon>
        </button>
      </div>

      @if (hasAnyData) {
        <!-- WEIGHT LINE CHART -->
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-title">
              <span class="weight-icon"><lucide-icon [img]="Weight" size="18"></lucide-icon></span>
              <span>Peso</span>
            </div>
            @if (avgWeight !== null) {
              <span class="chart-avg">Media: <strong>{{ avgWeight }} kg</strong></span>
            }
          </div>
          <svg class="line-chart" [attr.viewBox]="'0 0 ' + chartWidth + ' ' + chartHeight" preserveAspectRatio="none" role="img" aria-label="Andamento del peso nel tempo">
            <path class="weight-path" [attr.d]="lineChart.path"></path>
            @for (dot of lineChart.dots; track $index) {
              <circle class="weight-dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="3"></circle>
            }
          </svg>
          <div class="chart-range-row">
            <span>{{ lineChart.minLabel }} kg</span>
            <span>{{ lineChart.maxLabel }} kg</span>
          </div>
          <div class="chart-labels-row">
            @for (point of chartPoints; track $index) {
              <span class="chart-label" [class.dim]="!point.hasData">{{ point.label }}</span>
            }
          </div>
        </div>
      }

      @if (!hasAnyData) {
        <div class="empty-state">
          <lucide-icon [img]="Weight" size="48" class="empty-icon"></lucide-icon>
          <p>Nessun dato registrato in questa finestra.</p>
        </div>
      }
    </div>
    `,
  styles: [`
    .weight-dashboard-container {
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

    .granularity-selector {
      display: flex;
      background: var(--bg-card, #18181b);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
      border-radius: 12px;
      padding: 0.25rem;
      gap: 0.25rem;
    }

    .granularity-btn {
      flex: 1;
      background: transparent;
      border: none;
      color: #a1a1aa;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.5rem;
      border-radius: 9px;
      cursor: pointer;
      transition: all 0.15s ease;

      &.active {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }

      &:hover:not(.active) {
        color: #ffffff;
      }
    }

    .window-nav-card {
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

      &:hover:not(:disabled) {
        background: rgba(245, 158, 11, 0.15);
        border-color: rgba(245, 158, 11, 0.4);
      }

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
      }
    }

    .window-label {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
      cursor: pointer;
    }

    .window-text {
      font-size: 1.05rem;
      font-weight: 700;
      color: #ffffff;
    }

    .today-badge {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
      border: 1px solid rgba(245, 158, 11, 0.3);
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 10px;
    }

    .chart-card {
      background: linear-gradient(145deg, #18181b 0%, #0f172a 100%);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 16px;
      padding: 1rem 1.1rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .chart-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .chart-title {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
    }

    .weight-icon {
      color: #f59e0b;
      display: flex;
    }

    .chart-avg {
      font-size: 0.775rem;
      color: #a1a1aa;

      strong {
        color: #ffffff;
      }
    }

    .line-chart {
      width: 100%;
      height: 120px;
      display: block;
    }

    .weight-path {
      fill: none;
      stroke: #f59e0b;
      stroke-width: 2;
    }

    .weight-dot {
      fill: #f59e0b;
    }

    .chart-range-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.7rem;
      color: #a1a1aa;
    }

    .chart-labels-row {
      display: flex;
      justify-content: space-between;
    }

    .chart-label {
      font-size: 0.65rem;
      color: #a1a1aa;
      text-align: center;
      flex: 1;

      &.dim {
        color: #52525b;
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
export class WeightDashboardComponent implements OnInit {
  readonly TrendingUp = TrendingUp;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Weight = Weight;

  readonly chartWidth = 300;
  readonly chartHeight = 120;

  granularity: Granularity = 'day';
  windowOffset = 0;

  chartPoints: ChartPoint[] = [];
  private buckets: Date[] = [];

  constructor(
    private weightService: WeightService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  setGranularity(g: Granularity) {
    if (this.granularity === g) return;
    this.granularity = g;
    this.windowOffset = 0;
    this.loadData();
  }

  changeWindow(delta: number) {
    const next = this.windowOffset + delta;
    if (next > 0) return; // non si può navigare nel futuro
    this.windowOffset = next;
    this.loadData();
  }

  resetWindow() {
    if (this.windowOffset === 0) return;
    this.windowOffset = 0;
    this.loadData();
  }

  get canGoForward(): boolean {
    return this.windowOffset < 0;
  }

  get hasAnyData(): boolean {
    return this.chartPoints.some(p => p.hasData);
  }

  get windowLabel(): string {
    if (this.buckets.length === 0) return '';
    const first = this.buckets[0];
    const last = this.buckets[this.buckets.length - 1];

    if (this.granularity === 'month') {
      const sameYear = first.getFullYear() === last.getFullYear();
      return sameYear
        ? `${MONTH_NAMES[first.getMonth()]} – ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`
        : `${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()} – ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
    }

    const lastEnd = this.granularity === 'week' ? this.addDays(last, 6) : last;
    return `${first.getDate()}/${first.getMonth() + 1} – ${lastEnd.getDate()}/${lastEnd.getMonth() + 1}`;
  }

  get avgWeight(): number | null {
    const valid = this.chartPoints.filter(p => p.hasData).map(p => p.weight as number);
    if (valid.length === 0) return null;
    return Math.round((valid.reduce((s, v) => s + v, 0) / valid.length) * 10) / 10;
  }

  get lineChart(): LineChart {
    const withData = this.chartPoints
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.hasData);

    if (withData.length === 0) return { path: '', dots: [], minLabel: '', maxLabel: '' };

    const n = this.chartPoints.length;
    const stepX = n > 1 ? this.chartWidth / (n - 1) : 0;
    const values = withData.map(({ p }) => p.weight as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1; // evita divisione per zero se tutti i valori sono uguali

    const dots = withData.map(({ p, i }) => ({
      x: n > 1 ? i * stepX : this.chartWidth / 2,
      y: this.chartHeight - ((p.weight as number - min) / range) * this.chartHeight
    }));

    const path = dots.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');
    return { path, dots, minLabel: min.toFixed(1), maxLabel: max.toFixed(1) };
  }

  private async loadData(): Promise<void> {
    const { from, to, buckets } = this.computeWindow();
    this.buckets = buckets;

    const weights = await this.weightService.getWeightsInRange(from, to);
    this.chartPoints = this.buildChartPoints(weights, buckets);
    this.cdr.markForCheck();
  }

  private computeWindow(): { from: string; to: string; buckets: Date[] } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (this.granularity === 'day') {
      const windowSize = 7;
      const endDate = this.addDays(today, this.windowOffset * windowSize);
      const buckets: Date[] = [];
      for (let i = windowSize - 1; i >= 0; i--) {
        buckets.push(this.addDays(endDate, -i));
      }
      return { from: this.weightService.formatDate(buckets[0]), to: this.weightService.formatDate(buckets[buckets.length - 1]), buckets };
    }

    if (this.granularity === 'week') {
      const windowSize = 8;
      const currentWeekStart = this.startOfWeek(today);
      const endWeekStart = this.addDays(currentWeekStart, this.windowOffset * windowSize * 7);
      const buckets: Date[] = [];
      for (let i = windowSize - 1; i >= 0; i--) {
        buckets.push(this.addDays(endWeekStart, -i * 7));
      }
      const from = this.weightService.formatDate(buckets[0]);
      const to = this.weightService.formatDate(this.addDays(buckets[buckets.length - 1], 6));
      return { from, to, buckets };
    }

    // month
    const windowSize = 6;
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonthStart = new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + this.windowOffset * windowSize, 1);
    const buckets: Date[] = [];
    for (let i = windowSize - 1; i >= 0; i--) {
      buckets.push(new Date(endMonthStart.getFullYear(), endMonthStart.getMonth() - i, 1));
    }
    const from = this.weightService.formatDate(buckets[0]);
    const lastBucketEnd = new Date(buckets[buckets.length - 1].getFullYear(), buckets[buckets.length - 1].getMonth() + 1, 0);
    const to = this.weightService.formatDate(lastBucketEnd);
    return { from, to, buckets };
  }

  private buildChartPoints(weights: DailyWeight[], buckets: Date[]): ChartPoint[] {
    const byDate = new Map(weights.map(w => [w.date, w.weight_kg]));

    if (this.granularity === 'day') {
      return buckets.map(b => {
        const rec = byDate.get(this.weightService.formatDate(b));
        return {
          label: `${DAY_NAMES[b.getDay()]} ${b.getDate()}`,
          hasData: rec !== undefined,
          weight: rec ?? null
        };
      });
    }

    return buckets.map(bucketStart => {
      const bucketEnd = this.granularity === 'week'
        ? this.addDays(bucketStart, 6)
        : new Date(bucketStart.getFullYear(), bucketStart.getMonth() + 1, 0);

      const fromStr = this.weightService.formatDate(bucketStart);
      const toStr = this.weightService.formatDate(bucketEnd);
      const daysInBucket = weights.filter(w => w.date >= fromStr && w.date <= toStr);

      const label = this.granularity === 'week'
        ? `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`
        : `${MONTH_NAMES[bucketStart.getMonth()]}`;

      if (daysInBucket.length === 0) {
        return { label, hasData: false, weight: null };
      }

      const avg = Math.round((daysInBucket.reduce((s, d) => s + d.weight_kg, 0) / daysInBucket.length) * 10) / 10;
      return { label, hasData: true, weight: avg };
    });
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
