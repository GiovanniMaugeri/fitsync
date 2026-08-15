import { Component } from '@angular/core';

import { RouterModule } from '@angular/router';
import { LucideAngularModule, Utensils, Apple, Flame, CheckCircle2, Dumbbell, Sparkles, ArrowLeft } from 'lucide-angular';

@Component({
  selector: 'app-diet',
  standalone: true,
  imports: [RouterModule, LucideAngularModule],
  template: `
    <div class="diet-container">
      <!-- HEADER CARD -->
      <div class="diet-card hero-card">
        <div class="badge-status">
          <lucide-icon [img]="CheckCircle2" size="14"></lucide-icon>
          <span>Modulo Dieta Attivo</span>
        </div>
        
        <div class="hero-icon">
          <lucide-icon [img]="Utensils" size="40"></lucide-icon>
        </div>

        <h1 class="hero-title">Dieta & Nutrizione</h1>
        <p class="hero-description">
          La scheda funziona correttamente! Questa sezione ospiterà il tracciamento dei macronutrienti, il piano alimentare personalizzato e il diario dei pasti.
        </p>

        <div class="test-banner">
          <lucide-icon [img]="Sparkles" size="18" class="sparkle-icon"></lucide-icon>
          <span><strong>Test Superato:</strong> Navigazione e routing per la sezione Dieta configurati con successo.</span>
        </div>
      </div>

      <!-- PREVIEW METRICS (PLACEHOLDER CARDS) -->
      <div class="metrics-grid">
        <div class="diet-card metric-card">
          <div class="metric-header">
            <span class="metric-icon calorie-icon">
              <lucide-icon [img]="Flame" size="20"></lucide-icon>
            </span>
            <span class="metric-title">Calorie Giornaliere</span>
          </div>
          <div class="metric-value">2,450 <span class="unit">kcal</span></div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill calories-fill" style="width: 70%"></div>
          </div>
        </div>

        <div class="diet-card metric-card">
          <div class="metric-header">
            <span class="metric-icon protein-icon">
              <lucide-icon [img]="Apple" size="20"></lucide-icon>
            </span>
            <span class="metric-title">Proteine</span>
          </div>
          <div class="metric-value">160g <span class="unit">/ 180g</span></div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill protein-fill" style="width: 88%"></div>
          </div>
        </div>
      </div>

      <!-- QUICK ACTION BACK -->
      <div class="action-footer">
        <a routerLink="/" class="btn btn-outline btn-block">
          <lucide-icon [img]="Dumbbell" size="16"></lucide-icon> Torna all'Allenamento
        </a>
      </div>
    </div>
  `,
  styles: [`
    .diet-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      max-width: 600px;
      margin: 0 auto;
      padding-top: 0.5rem;
    }

    .diet-card {
      background: var(--bg-card, #18181b);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
      border-radius: 16px;
      padding: 1.5rem;
      position: relative;
      overflow: hidden;
    }

    .hero-card {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      background: linear-gradient(145deg, rgba(24, 24, 27, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 0.35rem 0.75rem;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .hero-icon {
      width: 72px;
      height: 72px;
      border-radius: 20px;
      background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
      color: var(--primary-cyan, #06b6d4);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1rem;
      border: 1px solid rgba(6, 182, 212, 0.3);
    }

    .hero-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: var(--text-main, #ffffff);
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
    }

    .hero-description {
      color: var(--text-dim, #a1a1aa);
      font-size: 0.925rem;
      line-height: 1.5;
      margin: 0 0 1.25rem 0;
      max-width: 440px;
    }

    .test-banner {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(6, 182, 212, 0.1);
      border: 1px dashed rgba(6, 182, 212, 0.4);
      padding: 0.75rem 1rem;
      border-radius: 12px;
      color: #38bdf8;
      font-size: 0.825rem;
      text-align: left;
    }

    .sparkle-icon {
      flex-shrink: 0;
      color: #38bdf8;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    @media (max-width: 480px) {
      .metrics-grid {
        grid-template-columns: 1fr;
      }
    }

    .metric-card {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .metric-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .metric-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .calorie-icon {
      background: rgba(249, 115, 22, 0.15);
      color: #fb923c;
    }

    .protein-icon {
      background: rgba(168, 85, 247, 0.15);
      color: #c084fc;
    }

    .metric-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-dim, #a1a1aa);
    }

    .metric-value {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--text-main, #ffffff);
      .unit {
        font-size: 0.85rem;
        font-weight: 500;
        color: var(--text-dim, #a1a1aa);
      }
    }

    .progress-bar-bg {
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: 3px;
    }

    .calories-fill {
      background: linear-gradient(90deg, #f97316, #fb923c);
    }

    .protein-fill {
      background: linear-gradient(90deg, #a855f7, #c084fc);
    }

    .action-footer {
      margin-top: 0.5rem;
    }

    .btn-block {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 12px;
    }
  `]
})
export class DietComponent {
  readonly Utensils = Utensils;
  readonly Apple = Apple;
  readonly Flame = Flame;
  readonly CheckCircle2 = CheckCircle2;
  readonly Dumbbell = Dumbbell;
  readonly Sparkles = Sparkles;
  readonly ArrowLeft = ArrowLeft;
}
