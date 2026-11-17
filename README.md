# POF - Planty of Food: a chatbot for plant-based recipes

<p>
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white">
  <img alt="Express" src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white">
  <img alt="Vue.js" src="https://img.shields.io/badge/Vue.js_3-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white">
  <img alt="HTML5" src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white">
  <img alt="CSS3" src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white">
</p>

<p>
  <img alt="Google Gemini" src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white">
  <img alt="Firebase Firestore" src="https://img.shields.io/badge/Firebase_Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black">
  <img alt="Spoonacular" src="https://img.shields.io/badge/Spoonacular_API-6BA539?style=for-the-badge">
  <img alt="Render" src="https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black">
  <img alt="Netlify" src="https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white">
</p>

A chatbot that talks with the user, understands their tastes and dietary constraints, and suggests plant-based recipes taken from [Spoonacular](https://spoonacular.com/food-api). The recipes are stored in a RAG, and the conversation is handled by Google Gemini.

## Technologies

- Front end: Vue 3 + Vite (deployed on Netlify)
- Back end: Node.js + Express (deployed on Render)
- LLM: Google Gemini, for the chat (with function calling) and for the embeddings
- Database: Firebase Firestore, for the recipes with their embeddings, the conversations and the users' preferences

## How it works

### Recipe import (RAG)

The `npm run ingest` script (or the `POST /api/admin/ingest` endpoint) performs these steps:

1. downloads vegan and vegetarian recipes from Spoonacular for various meal types (`complexSearch` endpoint, with ingredients and instructions already included);
2. for each recipe, asks Gemini for a characteristic sentence in Italian (10 recipes per call, JSON response);
3. computes the embedding with `gemini-embedding-001` from the sentence, title, dish type, diet and ingredients;
4. saves everything in the `recipes` collection on Firestore: id, title, sourceUrl, summary, ingredients, instructions, tags, phrase, embedding.

### Search

When a recipe is needed, the back end:

1. computes the embedding of the request;
2. filters the recipes by diet, meal type, maximum time, ingredients to exclude, gluten-free or lactose-free;
3. sorts by cosine similarity and returns the top 3 above a minimum threshold.

There are a few hundred recipes, so I compute the similarity directly in JavaScript, keeping the recipes in a cache. A vector database is not needed.

### The RAG as a tool

The search does not run on every message. It is registered as a function (`searchRecipes`) and Gemini decides when to call it. If the request is too generic, it asks a question first. Example:

```
User: I'm hungry, recommend something
Pof:  Happy to! Is it for breakfast, lunch or dinner? Are there ingredients you like or avoid?
User: Quick dinner, I like chickpeas but no mushrooms
Pof calls searchRecipes({ query: "quick chickpea dinner", mealType: "main course",
                          maxReadyTime: 30, excludeIngredients: ["mushroom"], diet: "vegan" })
```

The other two tools are `getRecipeDetails` (details of a recipe that has already been shown) and `saveUserPreferences` (saves allergies and tastes). In the chat, a label showing the tool used appears above the reply.

### Memory

- Short term: every message is saved in the `conversations` collection, in its `messages` sub-collection. At each new message, the last 20 are sent back to Gemini. To messages containing recipes I add the ids of the recipes shown, so the user can ask, for example, "give me the instructions for the second one".
- Long term: allergies, disliked or preferred ingredients, eating style and available time are saved in the `users` collection and inserted into the system prompt of all later chats. The user can see them in the sidebar and delete them.
- There is no login: the user is identified by an anonymous id saved in the browser.

### System prompt

It is located in [backend/src/prompts/systemPrompt.js](backend/src/prompts/systemPrompt.js) and is divided into sections: role, POF context, recipe fields, when to use the tools, behavior rules (no invented recipes, only relevant information, attention to allergies, off-topic questions), response style and the user's saved preferences.

## Structure

```
backend/
  src/
    server.js                 Express startup
    routes/api.js             endpoints
    prompts/systemPrompt.js   system prompt
    services/
      chat.js                 conversation handling with Gemini and the tools
      tools.js                tool definitions
      rag.js                  similarity search
      memory.js               conversations, messages, preferences
      ingest.js               import from Spoonacular
      spoonacular.js          Spoonacular calls
      gemini.js               Gemini calls
    db/db.js                  Firestore connection
  scripts/ingest.js
  test/rag.test.js
frontend/
  src/App.vue, api.js, components/
render.yaml
```

## API

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | body `{ userId, conversationId?, message }`, responds with `{ conversationId, reply, recipes, toolCalls }` |
| GET | `/api/conversations?userId=` | list of chats |
| GET | `/api/conversations/:id?userId=` | messages of a chat |
| DELETE | `/api/conversations/:id?userId=` | deletes a chat |
| GET, DELETE | `/api/users/:id/preferences` | reads or deletes the preferences |
| POST | `/api/admin/ingest` | imports recipes from Spoonacular (`x-admin-token` header) |
| GET | `/api/recipes/stats` | number of saved recipes |
| GET | `/api/health` | server status |

## Why these choices

- Gemini: with a single key I cover chat, function calling, JSON responses and embeddings, and the free plan is enough for the project. The embeddings are multilingual, so a question in Italian also finds recipes written in English.
- Firestore: a free, managed database that fits the Firebase deploy requirement. The embeddings are stored as arrays of numbers and the similarity is computed in the back end, so every step of the RAG is visible in the code.
- RAG as a tool: it avoids useless searches, keeps the conversation natural and leaves to the model the choice of the right moment and of the filters.
- Security: the keys live only in the back end (`.env` file), identifiers coming from the client are validated, the text generated by the model is sanitized before being displayed, the chat has a per-minute request limit, the import requires a token and CORS only accepts the front end's domain.
