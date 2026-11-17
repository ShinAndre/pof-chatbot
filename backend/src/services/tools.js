import { searchRecipes, getRecipeById } from './rag.js';
import { savePreferences } from './memory.js';


const MEAL_TYPES = ['main course', 'breakfast', 'salad', 'soup', 'dessert', 'snack', 'side dish', 'appetizer'];

export const toolDeclarations = [
  {
    name: 'searchRecipes',
    description:
      'Cerca ricette plant-based nel database POF (RAG con ricerca semantica). Da chiamare solo quando è chiaro cosa cerca l\'utente.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Descrizione in INGLESE della ricetta desiderata: ingredienti, tipo di piatto, gusto, occasione. Es. "creamy chickpea curry for dinner".',
        },
        mealType: { type: 'string', enum: MEAL_TYPES, description: 'Tipo di pasto/piatto, se specificato.' },
        diet: {
          type: 'string',
          enum: ['vegan', 'vegetarian'],
          description: 'vegan (default consigliato) oppure vegetarian se l\'utente accetta latticini o uova.',
        },
        maxReadyTime: { type: 'integer', description: 'Tempo massimo di preparazione in minuti.' },
        excludeIngredients: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ingredienti da escludere, in INGLESE e al singolare (allergie, ingredienti sgraditi).',
        },
        glutenFree: { type: 'boolean', description: 'true se serve una ricetta senza glutine.' },
        dairyFree: { type: 'boolean', description: 'true se serve una ricetta senza latticini.' },
        limit: { type: 'integer', description: 'Numero di ricette da restituire (1-5, default 3).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'getRecipeDetails',
    description: 'Restituisce tutti i dettagli (ingredienti, procedimento) di una ricetta già mostrata, dato il suo id.',
    parametersJsonSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: 'id della ricetta' } },
      required: ['id'],
    },
  },
  {
    name: 'saveUserPreferences',
    description:
      'Salva nella memoria a lungo termine preferenze alimentari stabili dell\'utente (allergie, gusti, stile alimentare). I valori vanno scritti in italiano.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        allergies: { type: 'array', items: { type: 'string' }, description: 'Allergie o intolleranze.' },
        dislikedIngredients: { type: 'array', items: { type: 'string' }, description: 'Ingredienti che non gradisce.' },
        favoriteIngredients: { type: 'array', items: { type: 'string' }, description: 'Ingredienti preferiti.' },
        dietStyle: { type: 'string', enum: ['vegano', 'vegetariano', 'flexitariano'], description: 'Stile alimentare.' },
        maxReadyTime: { type: 'integer', description: 'Minuti che dedica di solito alla cucina.' },
        notes: { type: 'string', description: 'Altre informazioni stabili utili (es. cucina per 4 persone).' },
      },
    },
  },
];

function forLlm(recipe, score) {
  return {
    id: recipe.id,
    title: recipe.title,
    phrase: recipe.phrase,
    summary: recipe.summary,
    ingredients: recipe.ingredients,
    instructions: recipe.instructions,
    tags: recipe.tags,
    readyInMinutes: recipe.readyInMinutes,
    servings: recipe.servings,
    sourceUrl: recipe.sourceUrl,
    ...(score !== undefined && { relevance: Number(score.toFixed(3)) }),
  };
}

export function toCard(recipe) {
  return {
    id: recipe.id,
    title: recipe.title,
    phrase: recipe.phrase,
    image: recipe.image,
    sourceUrl: recipe.sourceUrl,
    readyInMinutes: recipe.readyInMinutes,
    servings: recipe.servings,
    tags: recipe.tags.slice(0, 4),
    ingredients: recipe.ingredients,
  };
}

export async function executeTool(name, args, ctx) {
  try {
    switch (name) {
      case 'searchRecipes': {
        if (!args.query) return { error: 'Il parametro query è obbligatorio.' };
        const results = await searchRecipes(args);
        ctx.recipes.clear(); 
        for (const { recipe } of results) ctx.recipes.set(recipe.id, recipe);
        return results.length
          ? { found: results.length, recipes: results.map(({ recipe, score }) => forLlm(recipe, score)) }
          : { found: 0, recipes: [], message: 'Nessuna ricetta pertinente trovata con questi criteri.' };
      }
      case 'getRecipeDetails': {
        const recipe = await getRecipeById(Number(args.id));
        if (!recipe) return { error: `Nessuna ricetta con id ${args.id}.` };
        ctx.recipes.set(recipe.id, recipe);
        return { recipe: forLlm(recipe) };
      }
      case 'saveUserPreferences': {
        ctx.preferences = await savePreferences(ctx.userId, args);
        ctx.preferencesUpdated = true;
        return { saved: true, preferences: ctx.preferences };
      }
      default:
        return { error: `Tool sconosciuto: ${name}` };
    }
  } catch (err) {
    console.error(`[tool ${name}]`, err);
    return { error: 'Il tool non è disponibile in questo momento.' };
  }
}
