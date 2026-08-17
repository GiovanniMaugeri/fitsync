import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import { SyncService } from './core/services/sync.service';
import { WorkoutService, ActiveWorkoutState } from './core/services/workout.service';
import { SupabaseService } from './core/services/supabase.service';
import { 
  LucideAngularModule, 
  Dumbbell, 
  Settings, 
  Activity, 
  ClipboardList, 
  History, 
  BicepsFlexed, 
  Radio, 
  User, 
  Utensils, 
  ChevronRight,
  X,
  Calendar,
  Flame,
  TrendingUp
} from 'lucide-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  template: `
    <div class="app-shell">
      <!-- BACKDROP OVERLAY FOR SIDE DRAWER -->
      @if (isSettingsOpen) {
        <div class="settings-backdrop" (click)="closeSettingsMenu()"></div>
      }
    
      <!-- SIDE DRAWER NAVIGATION (MOBILE & DESKTOP) -->
      @if (isSettingsOpen) {
        <div class="settings-drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <div class="drawer-title">
              <lucide-icon [img]="Settings" size="20" class="title-icon"></lucide-icon>
              <span>Impostazioni</span>
            </div>
            <button class="drawer-close-btn" (click)="closeSettingsMenu()" title="Chiudi">
              <lucide-icon [img]="X" size="20"></lucide-icon>
            </button>
          </div>
          <!-- Current User Info Card -->
          @if (currentUser$ | async; as user) {
            <div class="drawer-user-card">
              <div class="user-avatar">
                <lucide-icon [img]="User" size="20"></lucide-icon>
              </div>
              <div class="user-details">
                <span class="user-name">{{ user.user_metadata?.['username'] || 'Utente FitSync' }}</span>
                <span class="user-email">{{ user.email }}</span>
              </div>
            </div>
          }
          <div class="drawer-section-label">NAVIGAZIONE PRINCIPALE</div>
          <div class="drawer-menu-list">
            <a routerLink="/auth" class="drawer-item" (click)="closeSettingsMenu()">
              <div class="item-icon icon-profile">
                <lucide-icon [img]="User" size="22"></lucide-icon>
              </div>
              <div class="item-content">
                <span class="item-title">Profilo</span>
                <span class="item-subtitle">Gestisci account e sincronizzazione</span>
              </div>
              <lucide-icon [img]="ChevronRight" size="18" class="arrow-icon"></lucide-icon>
            </a>
            <a routerLink="/" class="drawer-item" (click)="closeSettingsMenu()">
              <div class="item-icon icon-workout">
                <lucide-icon [img]="Dumbbell" size="22"></lucide-icon>
              </div>
              <div class="item-content">
                <span class="item-title">Allenamento</span>
                <span class="item-subtitle">Dashboard ed esercizi</span>
              </div>
              <lucide-icon [img]="ChevronRight" size="18" class="arrow-icon"></lucide-icon>
            </a>
            <a routerLink="/diet" class="drawer-item" (click)="closeSettingsMenu()">
              <div class="item-icon icon-diet">
                <lucide-icon [img]="Utensils" size="22"></lucide-icon>
              </div>
              <div class="item-content">
                <span class="item-title">Dieta</span>
                <span class="item-subtitle">Nutrizione e pasti</span>
              </div>
              <lucide-icon [img]="ChevronRight" size="18" class="arrow-icon"></lucide-icon>
            </a>
          </div>
        </div>
      }
    
      <!-- TOP NAVIGATION BAR -->
      <header class="app-header">
        <div class="header-content">
          <div class="brand" routerLink="/">
            <div class="logo-icon"><lucide-icon [img]="Dumbbell"></lucide-icon></div>
            <span class="brand-title">Fit<span class="highlight">Sync</span></span>
          </div>
    
          <div class="status-area">
            <!-- Syncing indicator -->
            @if (isSyncing()) {
              <div class="syncing-badge">
                <span class="spinner"><lucide-icon [img]="Settings" size="16"></lucide-icon></span> Sync...
              </div>
            }
    
            <!-- Pending Sync Items Count -->
            @if (pendingCount(); as count) {
              <div class="pending-badge" (click)="forceSync()">
                @if (count > 0) {
                  <span class="pending-tag">{{ count }} in coda</span>
                }
              </div>
            }
    
            <!-- Settings Gear Button -->
            <button class="settings-btn" [class.active]="isSettingsOpen" (click)="toggleSettingsMenu($event)" title="Apri Impostazioni">
              <lucide-icon [img]="Settings" size="20"></lucide-icon>
            </button>
          </div>
        </div>
    
        <!-- Active Workout Floating Bar banner -->
        @if (activeWorkout(); as activeState) {
          <div class="active-workout-banner" routerLink="/workout/active">
            <div class="banner-info">
              <span class="pulse-icon"><lucide-icon [img]="Radio" size="18"></lucide-icon></span>
              <span class="banner-text">ALLENAMENTO IN CORSO: <strong>{{ activeState.session.name }}</strong></span>
            </div>
            <button class="btn btn-sm btn-accent">Riprendi →</button>
          </div>
        }
      </header>
    
      <!-- MAIN ROUTER CONTAINER -->
      <main class="app-main">
        <router-outlet></router-outlet>
      </main>
    
      <!-- WORKOUT BOTTOM NAVIGATION BAR -->
      @if (!isDietMode) {
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
      }
    
      <!-- DIET CUSTOM BOTTOM NAVIGATION BAR -->
      @if (isDietMode) {
        <nav class="bottom-nav diet-bottom-nav">
          <a routerLink="/diet" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-item">
            <span class="nav-icon"><lucide-icon [img]="Utensils" size="24"></lucide-icon></span>
            <span class="nav-label">Diario</span>
          </a>
          <a routerLink="/diet/history" routerLinkActive="active" class="nav-item">
            <span class="nav-icon"><lucide-icon [img]="Calendar" size="24"></lucide-icon></span>
            <span class="nav-label">Storico</span>
          </a>
          <a routerLink="/diet/dashboard" routerLinkActive="active" class="nav-item">
            <span class="nav-icon"><lucide-icon [img]="TrendingUp" size="24"></lucide-icon></span>
            <span class="nav-label">Andamento</span>
          </a>
        </nav>
      }
    </div>
    `,
  styles: [`
    .app-shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background-color: var(--bg-dark);
      padding-bottom: 80px;
    }

    .app-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(11, 15, 23, 0.95);
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
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .settings-btn {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: var(--text-main, #ffffff);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover, &.active {
        background: rgba(6, 182, 212, 0.15);
        border-color: var(--primary-cyan, #06b6d4);
        color: var(--primary-cyan, #06b6d4);
      }
    }

    /* BACKDROP OVERLAY (NO BLUR, CRISP DARK DIM) */
    .settings-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1999;
      background: rgba(0, 0, 0, 0.65);
    }

    /* SIDE DRAWER NAVIGATION PANEL */
    .settings-drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 320px;
      max-width: 85vw;
      background: #14171f;
      border-left: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.85);
      z-index: 2000;
      display: flex;
      flex-direction: column;
      padding: 1.25rem;
      gap: 1.25rem;
      animation: slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      overflow-y: auto;
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .drawer-title {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 1.15rem;
      font-weight: 700;
      color: #ffffff;

      .title-icon {
        color: var(--primary-cyan, #06b6d4);
      }
    }

    .drawer-close-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #a1a1aa;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
      }
    }

    .drawer-user-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 0.75rem;
      border-radius: 12px;
    }

    .user-avatar {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: rgba(6, 182, 212, 0.15);
      color: var(--primary-cyan, #06b6d4);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-details {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-name {
      font-size: 0.875rem;
      font-weight: 700;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-email {
      font-size: 0.725rem;
      color: #a1a1aa;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .drawer-section-label {
      font-size: 0.675rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #71717a;
      margin-top: 0.25rem;
    }

    .drawer-menu-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .drawer-item {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.85rem;
      border-radius: 12px;
      text-decoration: none;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: #ffffff;
      transition: all 0.15s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.15);
        transform: translateX(-2px);
      }
    }

    .item-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .icon-profile {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
    }

    .icon-workout {
      background: rgba(6, 182, 212, 0.15);
      color: #38bdf8;
    }

    .icon-diet {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
    }

    .item-content {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .item-title {
      font-size: 0.95rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .item-subtitle {
      font-size: 0.725rem;
      color: #a1a1aa;
      margin-top: 0.15rem;
    }

    .arrow-icon {
      color: #71717a;
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

    .diet-bottom-nav {
      .nav-item.active {
        color: #10b981;
      }
      .switch-fab {
        background: #06b6d4;
        color: #ffffff;
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
  readonly User = User;
  readonly Utensils = Utensils;
  readonly ChevronRight = ChevronRight;
  readonly X = X;
  readonly Calendar = Calendar;
  readonly Flame = Flame;
  readonly TrendingUp = TrendingUp;

  isSettingsOpen = false;
  isDietMode = false;

  isOnline: Signal<boolean>;
  isSyncing: Signal<boolean>;
  pendingCount: Signal<number>;
  activeWorkout: Signal<ActiveWorkoutState | null>;
  currentUser$: Observable<any>;

  constructor(
    private syncService: SyncService,
    private workoutService: WorkoutService,
    private supabaseService: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.isOnline = this.syncService.isOnline;
    this.isSyncing = this.syncService.isSyncing;
    this.pendingCount = this.syncService.pendingCount;
    this.activeWorkout = this.workoutService.activeWorkout;
    this.currentUser$ = this.supabaseService.currentUser$;
  }

  ngOnInit() {
    this.syncService.syncNow();

    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.isDietMode = event.url.startsWith('/diet');
      this.cdr.markForCheck();
    });

    this.isDietMode = this.router.url.startsWith('/diet');
  }

  forceSync() {
    this.syncService.syncNow();
  }

  toggleSettingsMenu(event: MouseEvent) {
    event.stopPropagation();
    this.isSettingsOpen = !this.isSettingsOpen;
  }

  closeSettingsMenu() {
    this.isSettingsOpen = false;
  }
}
