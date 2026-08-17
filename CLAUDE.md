# FitSync

PWA Angular 19 per allenamenti e dieta. Backend Supabase, storage locale offline-first con Dexie (IndexedDB), sincronizzazione via `src/app/core/services/sync.service.ts`. Deploy su Vercel.

# Comandi
- Usa `npm start` / `npm run build` — NON `ng serve` / `ng build` direttamente: saltano `set-env.js`, che genera `src/environments/environment.ts` (gitignored) dalle variabili in `.env`. Senza quel passaggio l'app non ha le credenziali Supabase.
- Nessun test automatico configurato (nessun file `.spec.ts`, nessuno script `test` in package.json). Se scrivi test, va impostato prima il framework — non assumere che esista già.

# Database di sviluppo
Esiste un secondo progetto Supabase (`fitsync-db-dev`, stesso org, region `eu-west-1`, ref `nultwrzgauspmeelmlps`) separato dalla produzione (`fitsync-db`, ref `gpehmwufdobdsuasokdg`), con lo stesso schema (tutte le migrazioni in `supabase/migrations/` applicate su entrambi). Credenziali in `.env.dev` (gitignored).
- `npm run start:dev-db` / `npm run config:dev` — puntano al DB di sviluppo invece che a produzione.
- Nuove migrazioni: pusha prima su dev per testare (`npx supabase db push --project-ref nultwrzgauspmeelmlps`), poi su produzione una volta verificate (`npx supabase db push`, richiede `supabase link` sul progetto di produzione — è quello linkato di default).
- Il DB di sviluppo parte vuoto (solo lo schema + seed dei foods/exercises di default, nessun dato utente) — serve un account di test separato per accedere alla sincronizzazione, non riusa gli utenti di produzione.

# Stile di scrittura del codice (minimal-first)
Prima di scrivere codice nuovo, valuta in ordine, fermandoti al primo che si applica:
1. Serve davvero? (YAGNI — non costruire per ipotesi future non richieste)
2. Esiste già nel codebase una soluzione riutilizzabile?
3. Lo risolve già la standard library / Angular / RxJS?
4. Esiste una feature nativa della piattaforma (HTML/browser)?
5. Lo fa già una dipendenza già installata?
6. Si può scrivere in una riga invece che con una nuova astrazione?
7. Solo a quel punto: scrivi il minimo indispensabile che funziona.

Non sacrificare mai validazione, gestione errori, sicurezza o accessibilità per accorciare il codice. Evita wrapper e dipendenze non necessarie.
(Ispirato al progetto "Ponytail" — github.com/DietrichGebert/ponytail — applicato come convenzione di progetto, non come plugin.)

# Convenzioni Angular
- Componenti standalone ovunque, nessun NgModule nel progetto — segui questo pattern per i nuovi componenti.

# Git
- Branch di feature: `feature/<nome>`. Dopo il merge, GitHub li elimina automaticamente sul remoto — non serve pulirli a mano lì.
- Se `git status` mostra quasi tutti i file come modificati con lo stesso numero di righe aggiunte/rimosse, è quasi certamente rumore di fine riga (CRLF/LF) e non una modifica reale — verifica con `git diff <file>` prima di agire.

# Second brain del progetto
Le note di progetto (decisioni architetturali, bug tracker, backlog, dev log) sono in un vault Obsidian separato, non in questo repo: `D:\Obsdian\Projects\FitSync\`.
Protocollo completo: `D:\Obsdian\_Protocollo con Claude.md`. In sintesi: a fine di ogni sessione di lavoro rilevante su questo progetto, aggiorna le note del vault (Dev Log sempre, Bugs/Architecture/Backlog se pertinente), stesso frontmatter delle note esistenti (`type`, `status`, `priority`, `date`).

# Struttura
- `src/app/core/services/` — servizi (workout, diet, template, exercise, sync, supabase)
- `src/app/core/db/app-db.ts` — schema Dexie
- `src/app/features/` — componenti standalone per feature (auth, diet, exercises, history, home, templates, workout)
- `supabase/migrations/` — schema del database remoto, come migrazioni SQL numerate (vedi `supabase/README.md` per la convenzione)
