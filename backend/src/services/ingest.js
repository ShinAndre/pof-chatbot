import { generateContent, embedTexts } from './gemini.js';
import { searchSpoonacular, normalizeRecipe } from './spoonacular.js';
import { getRecipeIds, upsertRecipe } from './rag.js';


const BATCH_SIZE = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const DEFAULT_PLAN = ['vegan', 'vegetarian'].flatMap((diet) =>
  ['main course', 'breakfast', 'salad', 'soup', 'dessert', 'snack'].map((type) => ({ diet, type })),
);

const PHRASE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: { id: { type: 'integer' }, phrase: { type: 'string' } },
    required: ['id', 'phrase'],
  },
};

export async function generatePhrases(recipes) {
  const input = recipes.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    ingredients: r.ingredients.slice(0, 12),
    tags: r.tags,
    readyInMinutes: r.readyInMinutes,
  }));

  const response = await generateContent({
    systemInstruction:
      'Sei un copywriter gastronomico di POF - Planty of Food, e-commerce italiano di alimentazione plant-based sostenibile.',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text:
              'Per ciascuna ricetta scrivi UNA frase caratteristica in italiano (massimo 30 parole) che ne descriva ' +
              "sapore, ingredienti principali e occasione ideale, con tono invitante. Resta fedele ai dati: non inventare " +
              'ingredienti o caratteristiche. Restituisci un array JSON con id e phrase.\n\n' +
              JSON.stringify(input),
          },
        ],
      },
    ],
    temperature: 0.7,
    responseJsonSchema: PHRASE_SCHEMA,
  });

  let parsed = [];
  try {
    parsed = JSON.parse(response.text ?? '[]');
  } catch {
    console.warn('[ingest] JSON delle frasi non valido, uso un testo di riserva');
  }
  const byId = new Map(parsed.map((p) => [p.id, p.phrase]));
  return recipes.map((r) => byId.get(r.id) || `${r.title}: ${r.summary}`.slice(0, 240));
}

export function buildEmbeddingText(r) {
  return [
    r.phrase,
    `Title: ${r.title}`,
    r.dishTypes.length && `Dish type: ${r.dishTypes.join(', ')}`,
    r.diets.length && `Diet: ${r.diets.join(', ')}`,
    r.cuisines?.length && `Cuisine: ${r.cuisines.join(', ')}`,
    `Ingredients: ${r.ingredients.slice(0, 15).join('; ')}`,
    r.summary,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function ingestRecipes({ plan = DEFAULT_PLAN, number = 15, delayMs = 4000, log = console.log } = {}) {
  const existing = new Set(await getRecipeIds());
  const collected = new Map();
  let fetched = 0;

  for (const step of plan) {
    let results;
    try {
      results = await searchSpoonacular({ number, ...step });
    } catch (err) {
      if (err.status === 402) {
        log('[ingest] quota giornaliera di Spoonacular esaurita, proseguo con le ricette già scaricate');
        break;
      }
      throw err;
    }
    fetched += results.length;
    for (const raw of results) {
      const r = normalizeRecipe(raw);
      if (existing.has(r.id) || collected.has(r.id)) continue;
      if (!r.ingredients.length || !r.instructions.length) continue;
      collected.set(r.id, r);
    }
    log(`[ingest] Spoonacular ${JSON.stringify(step)} -> ${results.length} ricette (nuove totali: ${collected.size})`);
  }

  const list = [...collected.values()];
  let saved = 0;
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);
    const phrases = await generatePhrases(batch);
    batch.forEach((r, idx) => (r.phrase = phrases[idx]));

    const vectors = await embedTexts(batch.map(buildEmbeddingText), 'RETRIEVAL_DOCUMENT');
    batch.forEach((r, idx) => (r.embedding = vectors[idx]));

    for (const r of batch) await upsertRecipe(r);
    saved += batch.length;
    log(`[ingest] salvate ${saved}/${list.length}`);

    if (i + BATCH_SIZE < list.length) await sleep(delayMs);
  }

  return { fetched, added: saved, alreadyPresent: existing.size };
}
