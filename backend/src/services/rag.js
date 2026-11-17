import { config } from '../config/config.js';
import { getDb } from '../db/db.js';
import { embedQuery } from './gemini.js';

const recipesCol = () => getDb().collection('recipes');

function docToRecipe(doc) {
  const d = doc.data();
  return {
    id: Number(doc.id),
    title: d.title,
    phrase: d.phrase,
    summary: d.summary ?? null,
    ingredients: d.ingredients ?? [],
    instructions: d.instructions ?? [],
    tags: d.tags ?? [],
    diets: d.diets ?? [],
    dishTypes: d.dishTypes ?? [],
    sourceUrl: d.sourceUrl ?? null,
    image: d.image ?? null,
    readyInMinutes: d.readyInMinutes ?? null,
    servings: d.servings ?? null,
    glutenFree: Boolean(d.glutenFree),
    dairyFree: Boolean(d.dairyFree),
    embedding: d.embedding ?? [],
  };
}

export async function upsertRecipe(r) {
  await recipesCol().doc(String(r.id)).set({
    title: r.title,
    phrase: r.phrase,
    summary: r.summary,
    ingredients: r.ingredients,
    instructions: r.instructions,
    tags: r.tags,
    diets: r.diets,
    dishTypes: r.dishTypes,
    sourceUrl: r.sourceUrl,
    image: r.image,
    readyInMinutes: r.readyInMinutes,
    servings: r.servings,
    glutenFree: Boolean(r.glutenFree),
    dairyFree: Boolean(r.dairyFree),
    embedding: r.embedding,
  });
  invalidateCache();
}

export async function getRecipeIds() {
  const snap = await recipesCol().select().get();
  return snap.docs.map((d) => Number(d.id));
}

export async function getRecipeById(id) {
  const snap = await recipesCol().doc(String(id)).get();
  return snap.exists ? docToRecipe(snap) : null;
}

export async function countRecipes() {
  const snap = await recipesCol().count().get();
  return snap.data().count;
}

let cache = null;
export function invalidateCache() {
  cache = null;
}
async function getAllRecipes() {
  if (!cache) cache = (await recipesCol().get()).docs.map(docToRecipe);
  return cache;
}


export function cosineSimilarity(a, b) {
  if (!a?.length || a.length !== b?.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

const MEAL_TYPE_SYNONYMS = {
  'main course': ['main course', 'main dish', 'dinner', 'lunch'],
  breakfast: ['breakfast', 'morning meal', 'brunch'],
  salad: ['salad'],
  soup: ['soup'],
  dessert: ['dessert'],
  snack: ['snack', 'fingerfood', 'antipasti', 'appetizer', 'starter'],
  'side dish': ['side dish'],
  appetizer: ['appetizer', 'antipasti', 'antipasto', 'starter', 'hor d\'oeuvre', 'fingerfood'],
};

export function matchesFilters(recipe, filters = {}) {
  const { diet, mealType, maxReadyTime, excludeIngredients = [], glutenFree, dairyFree } = filters;

  if (diet === 'vegan' && !recipe.diets.includes('vegan')) return false;
  if (diet === 'vegetarian' && !recipe.diets.some((d) => d === 'vegetarian' || d === 'vegan' || d.includes('vegetarian'))) return false;
  if (glutenFree && !recipe.glutenFree) return false;
  if (dairyFree && !recipe.dairyFree) return false;
  if (maxReadyTime && recipe.readyInMinutes && recipe.readyInMinutes > maxReadyTime) return false;

  if (mealType) {
    const accepted = MEAL_TYPE_SYNONYMS[mealType] ?? [mealType];
    if (!recipe.dishTypes.some((t) => accepted.includes(t))) return false;
  }

  if (excludeIngredients.length) {
    const text = recipe.ingredients.join(' | ').toLowerCase();
    if (excludeIngredients.some((ex) => ex && text.includes(String(ex).toLowerCase().trim()))) return false;
  }
  return true;
}

export function rankRecipes(recipes, queryVector, { filters = {}, limit = 3, minScore = 0 } = {}) {
  return recipes
    .filter((r) => matchesFilters(r, filters))
    .map((r) => ({ recipe: r, score: cosineSimilarity(queryVector, r.embedding) }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function searchRecipes({ query: text, limit, ...filters }) {
  const recipes = await getAllRecipes();
  if (!recipes.length) return [];
  const queryVector = await embedQuery(text);
  const safeLimit = Math.min(Math.max(Number(limit) || config.rag.defaultLimit, 1), config.rag.maxLimit);
  return rankRecipes(recipes, queryVector, { filters, limit: safeLimit, minScore: config.rag.minScore });
}
