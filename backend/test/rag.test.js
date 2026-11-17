import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosineSimilarity, matchesFilters, rankRecipes } from '../src/services/rag.js';
import { mergePreferences } from '../src/services/memory.js';
import { normalizeRecipe, stripHtml } from '../src/services/spoonacular.js';
import { historyToContents } from '../src/services/chat.js';

const recipe = (over) => ({
  id: 1,
  title: 'Chickpea Curry',
  diets: ['vegan', 'gluten free'],
  dishTypes: ['main course', 'dinner'],
  ingredients: ['400g chickpeas', '1 can coconut milk', '2 tbsp curry powder'],
  readyInMinutes: 30,
  glutenFree: true,
  dairyFree: true,
  embedding: [1, 0, 0],
  ...over,
});

test('cosineSimilarity', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosineSimilarity([1, 1], [2, 2]) - 1) < 1e-9);
  assert.equal(cosineSimilarity([1, 0], [1, 0, 0]), 0);
});

test('matchesFilters applica i filtri sui metadati', () => {
  const r = recipe();
  assert.ok(matchesFilters(r, { diet: 'vegan', mealType: 'main course', maxReadyTime: 30 }));
  assert.ok(matchesFilters(r, { diet: 'vegetarian' }), 'una ricetta vegana è anche vegetariana');
  assert.equal(matchesFilters(r, { maxReadyTime: 20 }), false);
  assert.equal(matchesFilters(r, { mealType: 'dessert' }), false);
  assert.equal(matchesFilters(r, { excludeIngredients: ['Coconut'] }), false);
  assert.equal(matchesFilters(recipe({ diets: ['vegetarian'] }), { diet: 'vegan' }), false);
  assert.equal(matchesFilters(recipe({ glutenFree: false }), { glutenFree: true }), false);
});

test('rankRecipes ordina per similarità e rispetta soglia e limite', () => {
  const recipes = [
    recipe({ id: 1, embedding: [1, 0, 0] }),
    recipe({ id: 2, embedding: [0.7, 0.7, 0] }),
    recipe({ id: 3, embedding: [0, 0, 1] }),
  ];
  const ranked = rankRecipes(recipes, [1, 0, 0], { limit: 5, minScore: 0.3 });
  assert.deepEqual(ranked.map((x) => x.recipe.id), [1, 2]);
  assert.equal(rankRecipes(recipes, [1, 0, 0], { limit: 1 }).length, 1);
});

test('mergePreferences accoda le liste senza duplicati', () => {
  const merged = mergePreferences(
    { allergies: ['arachidi'], dietStyle: 'vegano' },
    { allergies: ['Arachidi', 'sesamo'], maxReadyTime: 30, notes: '' },
  );
  assert.deepEqual(merged.allergies, ['arachidi', 'sesamo']);
  assert.equal(merged.dietStyle, 'vegano');
  assert.equal(merged.maxReadyTime, 30);
  assert.equal(merged.notes, undefined);
});

test('normalizeRecipe converte il formato Spoonacular', () => {
  const r = normalizeRecipe({
    id: 7,
    title: 'Lentil Soup',
    vegan: true,
    diets: ['dairy free'],
    dishTypes: ['Soup'],
    summary: 'A <b>warm</b> lentil soup. It has a spoonacular score of 90%. Try similar recipes.',
    extendedIngredients: [{ original: '1 cup lentils' }, { original: '1 carrot' }],
    analyzedInstructions: [{ steps: [{ step: 'Boil lentils.' }, { step: 'Add carrot.' }] }],
    readyInMinutes: 25,
    dairyFree: true,
  });
  assert.deepEqual(r.diets, ['dairy free', 'vegan']);
  assert.equal(r.summary, 'A warm lentil soup.');
  assert.deepEqual(r.ingredients, ['1 cup lentils', '1 carrot']);
  assert.deepEqual(r.instructions, ['Boil lentils.', 'Add carrot.']);
  assert.ok(r.tags.includes('quick'));
  assert.equal(stripHtml('a &amp; <i>b</i>'), 'a & b');
});

test('historyToContents aggiunge le note interne e inizia con l\'utente', () => {
  const contents = historyToContents([
    { role: 'assistant', content: 'ciao' },
    { role: 'user', content: 'una zuppa' },
    { role: 'assistant', content: 'Ecco', recipes: [{ id: 7, title: 'Lentil Soup' }] },
  ]);
  assert.equal(contents[0].role, 'user');
  assert.equal(contents.length, 2);
  assert.match(contents[1].parts[0].text, /id 7: "Lentil Soup"/);
});
