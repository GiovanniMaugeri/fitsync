const fs = require('fs');
const dotenv = require('dotenv');

// Carica il file .env se presente
dotenv.config();

const clean = (val) => (val || '').replace(/[\r\n"']/g, '').trim();

const url = clean(process.env.SUPABASE_URL) || 'https://gpehmwufdobdsuasokdg.supabase.co';
const key = clean(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY) || 'la-tua-anon-key';

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
