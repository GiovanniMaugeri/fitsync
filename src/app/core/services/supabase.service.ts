import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { db } from '../db/app-db';
import { Profile } from '../models/fitsync.models';
import { logger } from '../utils/logger';
import { environment } from '../../../environments/environment';

export const SUPABASE_URL = environment.supabaseUrl;
export const SUPABASE_ANON_KEY = environment.supabaseAnonKey;

// Identifica i dati creati offline prima del login, poi "reclamati" dall'utente reale al primo accesso.
export const LOCAL_USER_ID = 'local-user-id';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private client: SupabaseClient | null = null;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$: Observable<User | null> = this.currentUserSubject.asObservable();
  
  private isConfiguredSubject = new BehaviorSubject<boolean>(false);
  public isConfigured$: Observable<boolean> = this.isConfiguredSubject.asObservable();

  constructor() {
    this.initSupabase();
  }

  private initSupabase() {
    if (SUPABASE_URL !== 'https://tuo-progetto.supabase.co' && SUPABASE_ANON_KEY !== 'la-tua-anon-key') {
      try {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        this.isConfiguredSubject.next(true);

        this.client.auth.getUser().then(({ data }) => {
          if (data?.user) {
            this.currentUserSubject.next(data.user);
            this.syncUserProfile(data.user);
          }
        });

        this.client.auth.onAuthStateChange((event, session) => {
          const user = session?.user || null;
          this.currentUserSubject.next(user);
          if (user) {
            this.syncUserProfile(user);
          }
        });
      } catch (err) {
        logger.warn('Supabase initialization failed or using offline mode:', err);
      }
    } else {
      logger.log('FitSync running in local-only / offline demo mode. Supabase keys can be updated in env.');
    }
  }

  public get supabase(): SupabaseClient | null {
    return this.client;
  }

  public get isConfigured(): boolean {
    return this.isConfiguredSubject.value;
  }

  public get currentUserId(): string {
    return this.currentUserSubject.value?.id || LOCAL_USER_ID;
  }

  private async syncUserProfile(user: User) {
    const profile: Profile = {
      id: user.id,
      username: user.email?.split('@')[0] || 'Utente',
      full_name: user.user_metadata?.['full_name'] || user.email || 'Utente FitSync',
      avatar_url: user.user_metadata?.['avatar_url'] || '',
      updated_at: new Date().toISOString()
    };
    await db.profiles.put(profile);

    if (this.client) {
      try {
        await this.client.from('profiles').upsert(profile);
      } catch (err) {
        logger.warn('Could not sync user profile to remote Supabase:', err);
      }
    }
  }

  async signUp(username: string, password: string, fullName?: string) {
    if (!this.client) {
      throw new Error('Supabase non è configurato. Inserisci le tue API key.');
    }
    const email = `${username.toLowerCase().trim()}@fitsync.com`;
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username }
      }
    });
    if (error) throw error;
    return data;
  }

  async signIn(username: string, password: string) {
    if (!this.client) {
      throw new Error('Supabase non è configurato. Inserisci le tue API key.');
    }
    const email = `${username.toLowerCase().trim()}@fitsync.com`;
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async signOut() {
    if (this.client) {
      await this.client.auth.signOut();
    }
    this.currentUserSubject.next(null);
  }
}
