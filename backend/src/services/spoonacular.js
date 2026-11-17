import { config } from '../config/config.js';

export async function searchSpoonacular({ query, diet = 'vegan', type, number = 15, offset = 0 } = {}) {
  if (!config.spoonacular.apiKey) throw new Error('SPOONACULAR_API_KEY mancante');

  const params = new URLSearchParams({
    diet,
    number: String(number),
    offset: String(offset),
    addRecipeInformation: 'true',
    addRecipeInstructions: 'true',
    fillIngredients: 'true',
    instructionsRequired: 'true',
    sort: 'popularity',
  });
  if (query) params.set('query', query);
  if (type) params.set('type', type);

  const res = await fetch(`${config.spoonacular.baseUrl}/recipes/complexSearch?${params}`, {
    headers: { 'x-api-key': config.spoonacular.apiKey },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Spoonacular ha risposto ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.results ?? [];
}

const ENTITIES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' };

export function stripHtml(html = '') {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|quot|#39|lt|gt|nbsp);/g, (m) => ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSummary(html) {
  const sentences = stripHtml(html).match(/[^.!?]+[.!?]+/g) ?? [];
  let out = '';
  for (const s of sentences) {
    if (/spoonacular score|similar recipes|try |brought to you by/i.test(s)) continue;
    if ((out + s).length > 450) break;
    out += s;
  }
  return out.trim();
}

const unique = (arr) => [...new Set(arr.filter(Boolean).map((s) => String(s).toLowerCase()))];

function extractIngredients(r) {
  const list = r.extendedIngredients?.length
    ? r.extendedIngredients
    : [...(r.usedIngredients ?? []), ...(r.missedIngredients ?? [])];
  return [...new Set(list.map((i) => i.original || i.originalString || i.name).filter(Boolean))];
}

function extractInstructions(r) {
  const steps = (r.analyzedInstructions ?? []).flatMap((block) => (block.steps ?? []).map((s) => s.step));
  if (steps.length) return steps.map((s) => s.trim()).filter(Boolean);
  return stripHtml(r.instructions ?? '')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.length > 3);
}

export function normalizeRecipe(r) {
  const diets = unique(r.diets ?? []);
  if (r.vegan && !diets.includes('vegan')) diets.push('vegan');
  if (r.vegetarian && !diets.includes('vegetarian')) diets.push('vegetarian');
  const dishTypes = unique(r.dishTypes ?? []);
  const cuisines = unique(r.cuisines ?? []);

  return {
    id: r.id,
    title: r.title,
    sourceUrl: r.sourceUrl || r.spoonacularSourceUrl || null,
    image: r.image || null,
    summary: cleanSummary(r.summary),
    ingredients: extractIngredients(r),
    instructions: extractInstructions(r),
    diets,
    dishTypes,
    cuisines,
    readyInMinutes: r.readyInMinutes ?? null,
    servings: r.servings ?? null,
    glutenFree: Boolean(r.glutenFree),
    dairyFree: Boolean(r.dairyFree),
    tags: unique([
      ...diets,
      ...dishTypes,
      ...cuisines,
      r.glutenFree && 'gluten free',
      r.dairyFree && 'dairy free',
      r.veryHealthy && 'very healthy',
      r.readyInMinutes && r.readyInMinutes <= 30 && 'quick',
    ]),
  };
}
