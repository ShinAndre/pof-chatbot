<script setup>
import { ref } from 'vue';

defineProps({ recipe: { type: Object, required: true } });
const showIngredients = ref(false);
</script>

<template>
  <article class="recipe-card">
    <img v-if="recipe.image" :src="recipe.image" :alt="recipe.title" loading="lazy" />
    <div class="body">
      <h3>{{ recipe.title }}</h3>
      <p v-if="recipe.phrase" class="phrase">{{ recipe.phrase }}</p>
      <div class="meta">
        <span v-if="recipe.readyInMinutes">{{ recipe.readyInMinutes }} min</span>
        <span v-if="recipe.servings">{{ recipe.servings }} porzioni</span>
      </div>
      <div v-if="recipe.tags?.length" class="tags">
        <span v-for="tag in recipe.tags" :key="tag" class="tag">{{ tag }}</span>
      </div>

      <button
        v-if="recipe.ingredients?.length"
        type="button"
        class="link-btn"
        :aria-expanded="showIngredients"
        @click="showIngredients = !showIngredients"
      >
        {{ showIngredients ? 'Nascondi ingredienti' : `Ingredienti (${recipe.ingredients.length})` }}
      </button>
      <ul v-if="showIngredients" class="ingredients">
        <li v-for="(ing, i) in recipe.ingredients" :key="i">{{ ing }}</li>
      </ul>

      <a v-if="recipe.sourceUrl" :href="recipe.sourceUrl" target="_blank" rel="noopener noreferrer" class="cta">
        Vedi la ricetta
      </a>
    </div>
  </article>
</template>

<style scoped>
.recipe-card {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  min-width: 0;
}
img {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  background: var(--surface-2);
}
.body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px 14px;
  flex: 1;
}
h3 {
  font-size: 0.98rem;
  line-height: 1.3;
  margin: 0;
}
.phrase {
  margin: 0;
  font-size: 0.86rem;
  color: var(--text-muted);
  line-height: 1.45;
}
.meta {
  display: flex;
  gap: 12px;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tag {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  text-transform: capitalize;
}
.link-btn {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  color: var(--accent-strong);
  font: inherit;
  font-size: 0.82rem;
  cursor: pointer;
  text-decoration: underline;
}
.ingredients {
  margin: 0;
  padding-left: 18px;
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
}
.cta {
  margin-top: auto;
  padding-top: 4px;
  font-weight: 600;
  font-size: 0.86rem;
  color: var(--accent-strong);
  text-decoration: none;
}
.cta:hover {
  text-decoration: underline;
}
</style>
