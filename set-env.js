const fs = require('fs');
const dotenv = require('dotenv');

// Carica il file .env se presente
dotenv.config();

const clean = (val) => (val || '').replace(/[\r\n"']/g, '').trim();

// Senza .env, niente fallback a credenziali reali: usiamo i placeholder che
// supabase.service.ts riconosce per far partire l'app in modalità offline-only.
const url = clean(process.env.SUPABASE_URL) || 'https://tuo-progetto.supabase.co';
const key = clean(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY) || 'la-tua-anon-key';

if (url === 'https://tuo-progetto.supabase.co' || key === 'la-tua-anon-key') {
  console.warn('SUPABASE_URL/SUPABASE_ANON_KEY non impostate: build in modalità offline-only (nessuna sincronizzazione remota).');
}

const envConfigFile = `export const environment = {
  supabaseUrl: '${url}',
  supabaseAnonKey: '${key}'
};
`;

const dir = './src/environments';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(`${dir}/environment.ts`, envConfigFile);
console.log('Environment configuration generated at src/environments/environment.ts');
