// Rigenera il blocco INSERT dei default foods nella migrazione 0002_foods
// a partire da src/app/core/data/default-foods.json (fonte unica).
// Uso: npm run gen:seed:foods
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'src/app/core/data/default-foods.json');
const schemaPath = path.join(__dirname, '..', 'supabase/migrations/0002_foods.sql');

const foods = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const escape = (s) => s.replace(/'/g, "''");

const lines = ['INSERT INTO public.foods (id, name, is_custom, user_id, kcal_100g, protein_100g, carbs_100g, fat_100g) VALUES'];
foods.forEach((f, i) => {
  const isLast = i === foods.length - 1;
  lines.push(
    `('${f.id}', '${escape(f.name)}', ${f.is_custom}, ${f.user_id === null ? 'NULL' : `'${f.user_id}'`}, ${f.kcal_100g}, ${f.protein_100g}, ${f.carbs_100g}, ${f.fat_100g})${isLast ? '' : ','}`
  );
});
lines.push('ON CONFLICT (id) DO NOTHING;');

const generatedBlock = lines.join('\n');

const schema = fs.readFileSync(schemaPath, 'utf8');
const startMarker = '-- BEGIN GENERATED FOODS SEED';
const endMarker = '-- END GENERATED FOODS SEED';
const startIdx = schema.indexOf(startMarker);
const endIdx = schema.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  throw new Error(`Marker ${startMarker}/${endMarker} non trovati in supabase/migrations/0002_foods.sql`);
}

const before = schema.slice(0, startIdx + startMarker.length);
const after = schema.slice(endIdx);
const updated = `${before}\n${generatedBlock}\n${after}`;

fs.writeFileSync(schemaPath, updated);
console.log(`Rigenerati ${foods.length} alimenti in supabase/migrations/0002_foods.sql`);
