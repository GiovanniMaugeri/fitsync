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

Non è configurata la Supabase CLI in questo repo: le migrazioni vanno eseguite manualmente,
in ordine, incollando il contenuto del file SQL nel Supabase Dashboard → SQL Editor del progetto.

Se in futuro si passa alla Supabase CLI (`supabase migration new` / `supabase db push`), questa
stessa cartella `migrations/` è già nel formato compatibile: basterà collegare il progetto
(`supabase link`) e i file esistenti verranno riconosciuti come storico.
