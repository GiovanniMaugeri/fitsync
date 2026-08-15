// Rigenera il blocco INSERT dei default exercises in supabase/schema.sql
// a partire da src/app/core/data/default-exercises.json (fonte unica).
// Uso: npm run gen:seed
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'src/app/core/data/default-exercises.json');
const schemaPath = path.join(__dirname, '..', 'supabase/schema.sql');

const exercises = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const escape = (s) => s.replace(/'/g, "''");

const lines = ['INSERT INTO public.exercises (id, name, category, equipment, is_custom, user_id) VALUES'];
let lastCategory = null;
exercises.forEach((ex, i) => {
  if (ex.category !== lastCategory) {
    if (lastCategory !== null) lines.push('');
    lines.push(`-- ${ex.category}`);
    lastCategory = ex.category;
  }
  const isLast = i === exercises.length - 1;
  lines.push(
    `('${ex.id}', '${escape(ex.name)}', '${escape(ex.category)}', '${escape(ex.equipment)}', ${ex.is_custom}, ${ex.user_id === null ? 'NULL' : `'${ex.user_id}'`})${isLast ? '' : ','}`
  );
});
lines.push('ON CONFLICT (id) DO NOTHING;');

const generatedBlock = lines.join('\n');

const schema = fs.readFileSync(schemaPath, 'utf8');
const startMarker = '-- BEGIN GENERATED EXERCISES SEED';
const endMarker = '-- END GENERATED EXERCISES SEED';
const startIdx = schema.indexOf(startMarker);
const endIdx = schema.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  throw new Error(`Marker ${startMarker}/${endMarker} non trovati in supabase/schema.sql`);
}

const before = schema.slice(0, startIdx + startMarker.length);
const after = schema.slice(endIdx);
const updated = `${before}\n${generatedBlock}\n${after}`;

fs.writeFileSync(schemaPath, updated);
console.log(`Rigenerati ${exercises.length} esercizi in supabase/schema.sql`);
