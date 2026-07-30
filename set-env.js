const fs = require('fs');
const dotenv = require('dotenv');

// Carica il file .env
dotenv.config();

const envConfigFile = `export const environment = {
  supabaseUrl: '${process.env.SUPABASE_URL || 'https://tuo-progetto.supabase.co'}',
  supabaseAnonKey: '${process.env.SUPABASE_ANON_KEY || 'la-tua-anon-key'}'
};
`;

const dir = './src/environments';
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(`${dir}/environment.ts`, envConfigFile);
console.log('Environment configuration generated at src/environments/environment.ts');
