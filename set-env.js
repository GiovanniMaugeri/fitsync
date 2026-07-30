const fs = require('fs');
const dotenv = require('dotenv');

// Carica il file .env se presente
dotenv.config();

const clean = (val) => (val || '').replace(/[\r\n"']/g, '').trim();

const url = clean(process.env.SUPABASE_URL) || 'https://gpehmwufdobdsuasokdg.supabase.co';
const key = clean(process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZWhtd3VmZG9iZHN1YXNva2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTM4NjAsImV4cCI6MjEwMDk4OTg2MH0.BjsMnRu8YCL5CcaaMz4D6-OL3AZvfZkD1aYgJY-3BiE';

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
