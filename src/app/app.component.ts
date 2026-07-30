import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { SyncService } from './core/services/sync.service';
import { WorkoutService, ActiveWorkoutState } from './core/services/workout.service';
import { LucideAngularModule, Dumbbell, Settings, Activity, ClipboardList, History, BicepsFlexed, Radio } from 'lucide-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <div class="app-shell">
      <!-- TOP NAVIGATION BAR -->
      <header class="app-header">
        <div class="header-content">
          <div class="brand" routerLink="/">
            <div class="logo-icon"><lucide-icon [img]="Dumbbell"></lucide-icon></div>
            <span class="brand-title">Fit<span class="highlight">Sync</span></span>
          </div>

          <div class="status-area">
            <!-- Syncing indicator -->
            <div *ngIf="isSyncing$ | async" class="syncing-badge">
              <span class="spinner"><lucide-icon [img]="Settings" size="16"></lucide-icon></span> Sync...
            </div>

            <!-- Pending Sync Items Count -->
            <div *ngIf="(pendingCount$ | async) as count" class="pending-badge" (click)="forceSync()">
              <span *ngIf="count > 0" class="pending-tag">{{ count }} in coda</span>
            </div>



            <!-- Account Link -->
            <button class="icon-btn" routerLink="/auth" title="Account & Sync Settings">
              <lucide-icon [img]="Settings" size="20"></lucide-icon>
            </button>
          </div>
        </div>

        <!-- Active Workout Floating Bar banner -->
        <div *ngIf="activeWorkout$ | async as activeState" class="active-workout-banner" routerLink="/workout/active">
          <div class="banner-info">
            <span class="pulse-icon"><lucide-icon [img]="Radio" size="18"></lucide-icon></span>
            <span class="banner-text">ALLENAMENTO IN CORSO: <strong>{{ activeState.session.name }}</strong></span>
          </div>
          <button class="btn btn-sm btn-accent">Riprendi →</button>
        </div>
      </header>

      <!-- MAIN ROUTER CONTAINER -->
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>

      <!-- MOBILE BOTTOM NAVIGATION BAR -->
      <nav class="bottom-nav">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item">
          <span class="nav-icon"><lucide-icon [img]="Activity" size="24"></lucide-icon></span>
          <span class="nav-label">Home</span>
        </a>
        <a routerLink="/templates" routerLinkActive="active" class="nav-item">
          <span class="nav-icon"><lucide-icon [img]="ClipboardList" size="24"></lucide-icon></span>
          <span class="nav-label">Schede</span>
        </a>
        <a routerLink="/workout/active" routerLinkActive="active" class="nav-item nav-item-workout">
          <div class="workout-fab">
            <span class="nav-icon"><lucide-icon [img]="Dumbbell" size="24"></lucide-icon></span>
          </div>
          <span class="nav-label">Allenati</span>
        </a>
        <a routerLink="/history" routerLinkActive="active" class="nav-item">
          <span class="nav-icon"><lucide-icon [img]="History" size="24"></lucide-icon></span>
          <span class="nav-label">Storico</span>
        </a>
        <a routerLink="/exercises" routerLinkActive="active" class="nav-item">
          <span class="nav-icon"><lucide-icon [img]="BicepsFlexed" size="24"></lucide-icon></span>
          <span class="nav-label">Esercizi</span>
        </a>
      </nav>
    </div>
  `,
  styles: [`
    .app-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background-color: var(--bg-dark);
      padding-bottom: 80px; /* Space for bottom nav */
    }

    .app-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(11, 15, 23, 0.9);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border-color);
    }

    .header-content {
      max-width: 800px;
      margin: 0 auto;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      text-decoration: none;
    }

    .logo-icon {
      font-size: 1.5rem;
    }

    .brand-title {
      font-size: 1.3rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text-main);
      .highlight {
        color: var(--primary-cyan);
      }
    }

    .status-area {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }

    .syncing-badge {
      font-size: 0.75rem;
      color: var(--primary-cyan);
      display: flex;
      align-items: center;
      gap: 0.3rem;

      .spinner {
        animation: spin 1.5s linear infinite;
        display: inline-block;
      }
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    .pending-tag {
      background: rgba(249, 115, 22, 0.2);
      color: var(--accent-orange);
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
    }

    .icon-btn {
      background: transparent;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      padding: 0.3rem;
      border-radius: 6px;
      &:hover { background: rgba(255, 255, 255, 0.1); }
    }

    .active-workout-banner {
      background: linear-gradient(90deg, rgba(6, 182, 212, 0.2) 0%, rgba(132, 204, 22, 0.2) 100%);
      border-top: 1px solid rgba(6, 182, 212, 0.4);
      border-bottom: 1px solid rgba(6, 182, 212, 0.4);
      padding: 0.5rem 1rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }

    .banner-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .pulse-icon {
      animation: pulse 1.2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.2); }
    }

    .app-main {
      flex: 1;
      max-width: 800px;
      width: 100%;
      margin: 0 auto;
      padding: 1.25rem 1rem 95px 1rem;
    }

    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 64px;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      background: #18181b;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-around;
      align-items: center;
      z-index: 1000;
      max-width: 800px;
      margin: 0 auto;
    }

    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-decoration: none;
      color: var(--text-dim);
      font-size: 0.75rem;
      font-weight: 500;
      gap: 0.2rem;
      transition: all 0.2s ease;

      .nav-icon {
        font-size: 1.3rem;
      }

      &.active {
        color: var(--primary-cyan);
        font-weight: 700;
      }
    }

    .nav-item-workout {
      position: relative;
      top: -14px;

      .workout-fab {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #ffffff;
        color: #121212;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(255, 255, 255, 0.2);
        transition: transform 0.2s ease;

        .nav-icon {
          font-size: 1.5rem;
          display: flex;
        }
      }

      &.active .workout-fab {
        background: #e4e4e7;
        color: #000000;
        box-shadow: 0 6px 18px rgba(255, 255, 255, 0.3);
      }
    }
  `]
})
export class AppComponent implements OnInit {
  readonly Dumbbell = Dumbbell;
  readonly Settings = Settings;
  readonly Activity = Activity;
  readonly ClipboardList = ClipboardList;
  readonly History = History;
  readonly BicepsFlexed = BicepsFlexed;
  readonly Radio = Radio;

  isOnline$: Observable<boolean>;
  isSyncing$: Observable<boolean>;
  pendingCount$: Observable<number>;
  activeWorkout$: Observable<ActiveWorkoutState | null>;

  constructor(
    private syncService: SyncService,
    private workoutService: WorkoutService
  ) {
    this.isOnline$ = this.syncService.isOnline$;
    this.isSyncing$ = this.syncService.isSyncing$;
    this.pendingCount$ = this.syncService.pendingCount$;
    this.activeWorkout$ = this.workoutService.activeWorkout$;
  }

  ngOnInit() {}

  forceSync() {
    this.syncService.syncNow();
  }
}
