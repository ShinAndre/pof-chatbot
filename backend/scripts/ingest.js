import { parseArgs } from 'node:util';
import { assertConfig } from '../src/config/config.js';
import { initDb, closeDb } from '../src/db/db.js';
import { ingestRecipes, DEFAULT_PLAN } from '../src/services/ingest.js';

const { values } = parseArgs({
  options: {
    number: { type: 'string', default: '15' },
    query: { type: 'string' },
    diet: { type: 'string' },
    type: { type: 'string' },
  },
});

const custom = values.query || values.diet || values.type;
const plan = custom ? [{ query: values.query, diet: values.diet ?? 'vegan', type: values.type }] : DEFAULT_PLAN;

try {
  assertConfig({ needSpoonacular: true });
  await initDb();
  const result = await ingestRecipes({ plan, number: Number(values.number) || 15 });
  console.log('Ingestione completata:', result);
} catch (err) {
  console.error('Ingestione fallita:', err.message || err.code || err);
  process.exitCode = 1;
} finally {
  await closeDb();
}
