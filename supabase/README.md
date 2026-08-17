# Schema database

Lo schema del database Supabase è versionato come migrazioni SQL numerate in `migrations/`,
invece di un unico file monolitico modificato a mano.

## Convenzione

- `0001_baseline.sql` è lo stato dello schema al momento dell'introduzione di questa convenzione
  (2026-08-15): tabelle, RLS policy, seed dei default exercises. Non modificarlo.
- Ogni modifica successiva allo schema va in un **nuovo file numerato in ordine crescente**
  (es. `0002_add_xyz_column.sql`), mai modificando i file già presenti. Questo permette di
  vedere la storia dello schema leggendo i file in ordine e di sapere sempre cosa è già stato
  applicato al database remoto.
- Ogni file dovrebbe essere idempotente dove possibile (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`),
  così può essere ri-eseguito senza effetti collaterali se non si è sicuri sia già stato applicato.

## Come applicare una migrazione

La Supabase CLI è collegata (`npx supabase`, nessuna installazione globale) al progetto di
produzione (`fitsync-db`). Applicare una nuova migrazione:

```
npx supabase db push
```

da eseguire dalla root del repo (lo stato del link vive in `supabase/.temp`, relativo alla cwd).

## Due progetti: produzione e sviluppo

Esiste anche un secondo progetto Supabase dedicato allo sviluppo (`fitsync-db-dev`, stesso schema,
creato il 2026-08-17 per non lavorare su nuove feature direttamente contro i dati reali). Prima di
pushare una nuova migrazione in produzione, testala sul progetto di sviluppo:

```
npx supabase db push --project-ref nultwrzgauspmeelmlps --include-all
```

Il progetto di sviluppo non è quello collegato di default (`supabase link` punta a produzione) —
va sempre specificato esplicitamente con `--project-ref`, così non si rischia di dimenticare il
flag e pushare per sbaglio su dev quando si intendeva produzione (o viceversa).

Dettagli su come l'app sceglie a quale progetto connettersi (`.env` = dev per default, `.env.production`
solo opt-in esplicito) in `CLAUDE.md`, sezione "Database di sviluppo".
