import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { SyncService } from '../../core/services/sync.service';
import { LucideAngularModule, User, Globe, WifiOff, AlertTriangle, CheckCircle, Zap } from 'lucide-angular';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="auth-container">
      <div class="header-row">
        <div>
          <h1 class="page-title">Account & Sincronizzazione</h1>
          <p class="page-subtitle">Gestisci l'autenticazione Supabase ed il motore Offline-First.</p>
        </div>
      </div>

      <!-- LOGGED IN USER PROFILE CARD -->
      <div *ngIf="currentUser$ | async as user" class="glass-card profile-card">
        <div class="profile-header">
          <div class="avatar-circle"><lucide-icon [img]="User" size="24"></lucide-icon></div>
          <div>
            <h2 class="user-email">{{ user.user_metadata?.['username'] || user.email?.split('@')?.[0] }}</h2>
            <span class="user-id">ID: {{ user.id }}</span>
          </div>
        </div>

        <div class="sync-status-box">
          <div class="status-row">
            <span>Stato Connessione:</span>
            <strong [class.text-green]="isOnline$ | async" [class.text-orange]="!(isOnline$ | async)">
              <lucide-icon *ngIf="(isOnline$ | async)" [img]="Globe" size="14"></lucide-icon>
              <lucide-icon *ngIf="!(isOnline$ | async)" [img]="WifiOff" size="14"></lucide-icon>
              {{ (isOnline$ | async) ? ' Online' : ' Offline' }}
            </strong>
          </div>
          <div class="status-row">
            <span>Modifiche in coda di Sync:</span>
            <strong>{{ (pendingCount$ | async) || 0 }} elementi</strong>
          </div>
        </div>

        <div class="profile-actions">
          <button class="btn btn-primary" (click)="syncNow()" [disabled]="!(isOnline$ | async)"><lucide-icon [img]="Zap" size="16"></lucide-icon> Sincronizza Ora</button>
          <button class="btn btn-outline" (click)="signOut()">Disconnetti</button>
        </div>
      </div>

      <!-- LOGIN / SIGNUP FORM -->
      <div *ngIf="!(currentUser$ | async)" class="glass-card auth-card">
        <div class="tabs-header">
          <button class="auth-tab" [class.active]="isLoginMode" (click)="isLoginMode = true">Accedi</button>
          <button class="auth-tab" [class.active]="!isLoginMode" (click)="isLoginMode = false">Registrati</button>
        </div>

        <div *ngIf="errorMessage" class="error-banner">
          <lucide-icon [img]="AlertTriangle" size="16"></lucide-icon> {{ errorMessage }}
        </div>

        <div *ngIf="successMessage" class="success-banner">
          <lucide-icon [img]="CheckCircle" size="16"></lucide-icon> {{ successMessage }}
        </div>

        <form (ngSubmit)="handleSubmit()">
          <div *ngIf="!isLoginMode" class="form-group">
            <label>Nome Completo</label>
            <input type="text" class="input-field" [(ngModel)]="fullName" name="fullName" placeholder="es. Mario Rossi">
          </div>

          <div class="form-group">
            <label>Nome Utente *</label>
            <input type="text" class="input-field" [(ngModel)]="username" name="username" placeholder="nome_utente" required>
          </div>

          <div class="form-group">
            <label>Password *</label>
            <input type="password" class="input-field" [(ngModel)]="password" name="password" placeholder="••••••••" required>
          </div>

          <button type="submit" class="btn btn-primary btn-block">
            {{ isLoginMode ? 'Accedi a Supabase' : 'Crea Account' }}
          </button>
        </form>
      </div>

      <!-- LOCAL DEMO INFO CARD -->
      <div class="glass-card info-card">
        <h3><lucide-icon [img]="CheckCircle" size="18"></lucide-icon> Architettura Offline-First FitSync</h3>
        <p>Tutti i tuoi dati (schede, allenamenti, set) vengono **salvati istantaneamente su IndexedDB** nel browser con Dexie.js. Se non sei connesso ad internet o non hai configurato Supabase, l'app continuerà a funzionare normalmente in locale senza interruzioni.</p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .page-title { font-size: 1.4rem; font-weight: 800; color: var(--text-main); }
    .page-subtitle { font-size: 0.85rem; color: var(--text-muted); }

    .profile-card {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .avatar-circle {
      width: 48px; height: 48px;
      border-radius: 50%;
      background: var(--primary-cyan-glow);
      color: var(--primary-cyan);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem;
    }

    .user-email { font-size: 1.1rem; font-weight: 700; color: var(--text-main); }
    .user-id { font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); }

    .sync-status-box {
      background: rgba(15, 23, 42, 0.6);
      padding: 0.85rem;
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.85rem;
      color: var(--text-muted);

      strong { color: var(--text-main); }
      .text-green { color: var(--accent-lime); }
      .text-orange { color: var(--accent-orange); }
    }

    .profile-actions {
      display: flex;
      gap: 0.75rem;
    }

    .auth-card {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .tabs-header {
      display: flex;
      border-bottom: 1px solid var(--border-color);
    }

    .auth-tab {
      flex: 1;
      background: transparent;
      border: none;
      padding: 0.75rem;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;

      &.active {
        color: var(--primary-cyan);
        border-bottom-color: var(--primary-cyan);
      }
    }

    .error-banner {
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: var(--accent-rose);
      padding: 0.6rem 0.85rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
    }

    .success-banner {
      background: rgba(132, 204, 22, 0.15);
      border: 1px solid rgba(132, 204, 22, 0.3);
      color: var(--accent-lime);
      padding: 0.6rem 0.85rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
    }

    .btn-block { width: 100%; margin-top: 0.5rem; }

    .info-card {
      h3 { font-size: 1rem; color: var(--text-main); margin-bottom: 0.4rem; }
      p { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; }
    }
  `]
})
export class AuthComponent implements OnInit {
  readonly User = User;
  readonly Globe = Globe;
  readonly WifiOff = WifiOff;
  readonly AlertTriangle = AlertTriangle;
  readonly CheckCircle = CheckCircle;
  readonly Zap = Zap;

  private supabaseService = inject(SupabaseService);
  private syncService = inject(SyncService);

  currentUser$ = this.supabaseService.currentUser$;
  isOnline$ = this.syncService.isOnline$;
  pendingCount$ = this.syncService.pendingCount$;

  isLoginMode = true;
  username = '';
  password = '';
  fullName = '';

  errorMessage = '';
  successMessage = '';

  constructor() {}

  ngOnInit() {}

  async handleSubmit() {
    this.errorMessage = '';
    this.successMessage = '';

    try {
      if (this.isLoginMode) {
        await this.supabaseService.signIn(this.username, this.password);
        this.successMessage = 'Accesso effettuato con successo!';
      } else {
        await this.supabaseService.signUp(this.username, this.password, this.fullName);
        this.successMessage = 'Registrazione completata!';
      }
    } catch (err: any) {
      this.errorMessage = err?.message || 'Errore durante l\'autenticazione.';
    }
  }

  async signOut() {
    await this.supabaseService.signOut();
  }

  async syncNow() {
    await this.syncService.syncNow();
  }
}
