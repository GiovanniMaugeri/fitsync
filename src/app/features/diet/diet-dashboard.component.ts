import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';

import { LucideAngularModule, TrendingUp, ChevronLeft, ChevronRight, Flame } from 'lucide-angular';
import { DietService } from '../../core/services/diet.service';

type Granularity = 'day' | 'week' | 'month';

interface DailyDietTotal {
  date: string;
  calories: number;
  target_calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface ChartPoint {
  label: string;
  hasData: boolean;
  calories: number | null;
  target_calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
  hasData: boolean;
}

interface Sparkline {
  path: string;
  dots: { x: number; y: number }[];
}

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

@Component({
  selector: 'app-diet-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="diet-dashboard-container">
      <div class="page-header">
        <h1 class="page-title">
          <lucide-icon [img]="TrendingUp" size="24" class="title-icon"></lucide-icon>
          Andamento
        </h1>
        <p class="page-subtitle">Trend di calorie e macro nel tempo.</p>
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
        <!-- CALORIE CHART -->
        <div class="chart-card">
          <div class="chart-card-header">
            <div class="chart-title">
              <span class="flame-icon"><lucide-icon [img]="Flame" size="18"></lucide-icon></span>
              <span>Calorie</span>
            </div>
            @if (avgCalories !== null) {
              <span class="chart-avg">Media: <strong>{{ avgCalories }} kcal</strong></span>
            }
          </div>
          <svg class="bar-chart" [attr.viewBox]="'0 0 ' + barChartWidth + ' ' + barChartHeight" preserveAspectRatio="none" role="img" aria-label="Andamento calorie nel tempo">
            @if (targetLineY !== null) {
              <line class="target-line" [attr.x1]="0" [attr.y1]="targetLineY" [attr.x2]="barChartWidth" [attr.y2]="targetLineY"></line>
            }
            @for (bar of barRects; track $index) {
              @if (bar.hasData) {
                <rect class="calorie-bar" [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.width" [attr.height]="bar.height" rx="3"></rect>
              }
            }
          </svg>
          <div class="chart-labels-row">
            @for (point of chartPoints; track $index) {
              <span class="chart-label" [class.dim]="!point.hasData">{{ point.label }}</span>
            }
          </div>
          @if (avgTargetCalories !== null) {
            <div class="chart-legend">
              <span class="legend-dash"></span> Target medio: {{ avgTargetCalories }} kcal
            </div>
          }
        </div>

        <!-- MACRO SPARKLINES -->
        <div class="macro-sparklines-row">
          <div class="sparkline-card protein">
            <div class="sparkline-header">
              <span class="sparkline-title">Proteine</span>
              <span class="sparkline-value">{{ avgProtein !== null ? avgProtein + 'g' : '—' }}</span>
            </div>
            <svg class="sparkline-svg" [attr.viewBox]="'0 0 ' + sparkWidth + ' ' + sparkHeight" preserveAspectRatio="none">
              <path class="sparkline-path" [attr.d]="proteinSparkline.path"></path>
              @for (dot of proteinSparkline.dots; track $index) {
                <circle class="sparkline-dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="2.5"></circle>
              }
            </svg>
          </div>
          <div class="sparkline-card carbs">
            <div class="sparkline-header">
              <span class="sparkline-title">Carboidrati</span>
              <span class="sparkline-value">{{ avgCarbs !== null ? avgCarbs + 'g' : '—' }}</span>
            </div>
            <svg class="sparkline-svg" [attr.viewBox]="'0 0 ' + sparkWidth + ' ' + sparkHeight" preserveAspectRatio="none">
              <path class="sparkline-path" [attr.d]="carbsSparkline.path"></path>
              @for (dot of carbsSparkline.dots; track $index) {
                <circle class="sparkline-dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="2.5"></circle>
              }
            </svg>
          </div>
          <div class="sparkline-card fat">
            <div class="sparkline-header">
              <span class="sparkline-title">Grassi</span>
              <span class="sparkline-value">{{ avgFat !== null ? avgFat + 'g' : '—' }}</span>
            </div>
            <svg class="sparkline-svg" [attr.viewBox]="'0 0 ' + sparkWidth + ' ' + sparkHeight" preserveAspectRatio="none">
              <path class="sparkline-path" [attr.d]="fatSparkline.path"></path>
              @for (dot of fatSparkline.dots; track $index) {
                <circle class="sparkline-dot" [attr.cx]="dot.x" [attr.cy]="dot.y" r="2.5"></circle>
              }
            </svg>
          </div>
        </div>
      }

      @if (!hasAnyData) {
        <div class="empty-state">
          <lucide-icon [img]="TrendingUp" size="48" class="empty-icon"></lucide-icon>
          <p>Nessun dato registrato in questa finestra.</p>
        </div>
      }
    </div>
    `,
  styles: [`
    .diet-dashboard-container {
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
        background: rgba(6, 182, 212, 0.15);
        color: var(--primary-cyan, #06b6d4);
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
        background: rgba(6, 182, 212, 0.15);
        border-color: rgba(6, 182, 212, 0.4);
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
      background: rgba(6, 182, 212, 0.15);
      color: var(--primary-cyan, #06b6d4);
      border: 1px solid rgba(6, 182, 212, 0.3);
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.1rem 0.45rem;
      border-radius: 10px;
    }

    .chart-card {
      background: linear-gradient(145deg, #18181b 0%, #0f172a 100%);
      border: 1px solid rgba(6, 182, 212, 0.3);
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

    .flame-icon {
      color: #f97316;
      display: flex;
    }

    .chart-avg {
      font-size: 0.775rem;
      color: #a1a1aa;

      strong {
        color: #ffffff;
      }
    }

    .bar-chart {
      width: 100%;
      height: 120px;
      display: block;
    }

    .calorie-bar {
      fill: var(--primary-cyan, #06b6d4);
    }

    .target-line {
      stroke: #f97316;
      stroke-width: 1.5;
      stroke-dasharray: 4 4;
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

    .chart-legend {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.7rem;
      color: #a1a1aa;
    }

    .legend-dash {
      display: inline-block;
      width: 14px;
      height: 0;
      border-top: 1.5px dashed #f97316;
    }

    .macro-sparklines-row {
      display: flex;
      gap: 0.75rem;
    }

    .sparkline-card {
      flex: 1;
      background: var(--bg-card, #18181b);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 0.65rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;

      &.protein { border-color: rgba(168, 85, 247, 0.3); }
      &.carbs { border-color: rgba(249, 115, 22, 0.3); }
      &.fat { border-color: rgba(234, 179, 8, 0.3); }
    }

    .sparkline-header {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .sparkline-title {
      font-size: 0.7rem;
      color: #a1a1aa;
    }

    .sparkline-value {
      font-size: 0.9rem;
      font-weight: 700;
      color: #ffffff;
    }

    .sparkline-svg {
      width: 100%;
      height: 32px;
      display: block;
    }

    .sparkline-path {
      fill: none;
      stroke-width: 2;
    }

    .protein .sparkline-path { stroke: #a855f7; }
    .carbs .sparkline-path { stroke: #f97316; }
    .fat .sparkline-path { stroke: #eab308; }

    .protein .sparkline-dot { fill: #a855f7; }
    .carbs .sparkline-dot { fill: #f97316; }
    .fat .sparkline-dot { fill: #eab308; }

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
export class DietDashboardComponent implements OnInit {
  readonly TrendingUp = TrendingUp;
  readonly ChevronLeft = ChevronLeft;
  readonly ChevronRight = ChevronRight;
  readonly Flame = Flame;

  readonly barChartWidth = 300;
  readonly barChartHeight = 120;
  readonly sparkWidth = 260;
  readonly sparkHeight = 32;

  granularity: Granularity = 'day';
  windowOffset = 0;

  chartPoints: ChartPoint[] = [];
  private buckets: Date[] = [];

  constructor(
    private dietService: DietService,
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

  get avgCalories(): number | null { return this.avgOf('calories'); }
  get avgProtein(): number | null { return this.avgOf('protein'); }
  get avgCarbs(): number | null { return this.avgOf('carbs'); }
  get avgFat(): number | null { return this.avgOf('fat'); }

  get avgTargetCalories(): number | null {
    const valid = this.chartPoints.filter(p => p.hasData && p.target_calories !== null).map(p => p.target_calories as number);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
  }

  get barRects(): BarRect[] {
    const n = this.chartPoints.length;
    if (n === 0) return [];
    const gap = 6;
    const barWidth = (this.barChartWidth - gap * (n - 1)) / n;
    const max = Math.max(1, ...this.chartPoints.filter(p => p.hasData).flatMap(p => [p.calories || 0, p.target_calories || 0]));

    return this.chartPoints.map((p, i) => {
      const x = i * (barWidth + gap);
      if (!p.hasData) {
        return { x, width: barWidth, height: 0, y: this.barChartHeight, hasData: false };
      }
      const height = ((p.calories || 0) / max) * this.barChartHeight;
      return { x, width: barWidth, height, y: this.barChartHeight - height, hasData: true };
    });
  }

  get targetLineY(): number | null {
    const avgTarget = this.avgTargetCalories;
    if (avgTarget === null) return null;
    const max = Math.max(1, ...this.chartPoints.filter(p => p.hasData).flatMap(p => [p.calories || 0, p.target_calories || 0]));
    return this.barChartHeight - (avgTarget / max) * this.barChartHeight;
  }

  get proteinSparkline(): Sparkline { return this.buildSparkline('protein'); }
  get carbsSparkline(): Sparkline { return this.buildSparkline('carbs'); }
  get fatSparkline(): Sparkline { return this.buildSparkline('fat'); }

  private avgOf(key: 'calories' | 'protein' | 'carbs' | 'fat'): number | null {
    const valid = this.chartPoints.filter(p => p.hasData).map(p => p[key] as number);
    if (valid.length === 0) return null;
    return Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
  }

  private buildSparkline(key: 'protein' | 'carbs' | 'fat'): Sparkline {
    const n = this.chartPoints.length;
    if (n === 0) return { path: '', dots: [] };

    const stepX = n > 1 ? this.sparkWidth / (n - 1) : 0;
    const max = Math.max(1, ...this.chartPoints.filter(p => p.hasData).map(p => p[key] as number));

    const dots = this.chartPoints
      .map((p, i) => ({ p, x: i * stepX }))
      .filter(({ p }) => p.hasData)
      .map(({ p, x }) => ({ x, y: this.sparkHeight - ((p[key] as number) / max) * this.sparkHeight }));

    const path = dots.map((d, i) => `${i === 0 ? 'M' : 'L'} ${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ');
    return { path, dots };
  }

  private async loadData(): Promise<void> {
    const { from, to, buckets } = this.computeWindow();
    this.buckets = buckets;

    const dailyTotals = await this.dietService.getDailyTotals(from, to);
    this.chartPoints = this.buildChartPoints(dailyTotals, buckets);
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
      return { from: this.dietService.formatDate(buckets[0]), to: this.dietService.formatDate(buckets[buckets.length - 1]), buckets };
    }

    if (this.granularity === 'week') {
      const windowSize = 8;
      const currentWeekStart = this.startOfWeek(today);
      const endWeekStart = this.addDays(currentWeekStart, this.windowOffset * windowSize * 7);
      const buckets: Date[] = [];
      for (let i = windowSize - 1; i >= 0; i--) {
        buckets.push(this.addDays(endWeekStart, -i * 7));
      }
      const from = this.dietService.formatDate(buckets[0]);
      const to = this.dietService.formatDate(this.addDays(buckets[buckets.length - 1], 6));
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
    const from = this.dietService.formatDate(buckets[0]);
    const lastBucketEnd = new Date(buckets[buckets.length - 1].getFullYear(), buckets[buckets.length - 1].getMonth() + 1, 0);
    const to = this.dietService.formatDate(lastBucketEnd);
    return { from, to, buckets };
  }

  private buildChartPoints(dailyTotals: DailyDietTotal[], buckets: Date[]): ChartPoint[] {
    const byDate = new Map(dailyTotals.map(d => [d.date, d]));

    if (this.granularity === 'day') {
      return buckets.map(b => {
        const rec = byDate.get(this.dietService.formatDate(b));
        return {
          label: `${DAY_NAMES[b.getDay()]} ${b.getDate()}`,
          hasData: !!rec,
          calories: rec?.calories ?? null,
          target_calories: rec?.target_calories ?? null,
          protein: rec?.protein ?? null,
          carbs: rec?.carbs ?? null,
          fat: rec?.fat ?? null
        };
      });
    }

    return buckets.map(bucketStart => {
      const bucketEnd = this.granularity === 'week'
        ? this.addDays(bucketStart, 6)
        : new Date(bucketStart.getFullYear(), bucketStart.getMonth() + 1, 0);

      const fromStr = this.dietService.formatDate(bucketStart);
      const toStr = this.dietService.formatDate(bucketEnd);
      const daysInBucket = dailyTotals.filter(d => d.date >= fromStr && d.date <= toStr);

      const label = this.granularity === 'week'
        ? `${bucketStart.getDate()}/${bucketStart.getMonth() + 1}`
        : `${MONTH_NAMES[bucketStart.getMonth()]}`;

      if (daysInBucket.length === 0) {
        return { label, hasData: false, calories: null, target_calories: null, protein: null, carbs: null, fat: null };
      }

      const avg = (key: 'calories' | 'target_calories' | 'protein' | 'carbs' | 'fat') =>
        Math.round(daysInBucket.reduce((s, d) => s + d[key], 0) / daysInBucket.length);

      return {
        label,
        hasData: true,
        calories: avg('calories'),
        target_calories: avg('target_calories'),
        protein: avg('protein'),
        carbs: avg('carbs'),
        fat: avg('fat')
      };
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
