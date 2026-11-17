<script setup>
import { computed } from 'vue';
import { renderMarkdown } from '../markdown.js';
import RecipeCard from './RecipeCard.vue';

const props = defineProps({ message: { type: Object, required: true } });

const html = computed(() => (props.message.role === 'assistant' ? renderMarkdown(props.message.content) : ''));

function toolLabel(call) {
  switch (call.name) {
    case 'searchRecipes':
      return `Ricerca nel ricettario: "${call.args?.query ?? ''}"`;
    case 'getRecipeDetails':
      return 'Dettagli ricetta recuperati';
    case 'saveUserPreferences':
      return 'Preferenze salvate in memoria';
    default:
      return call.name;
  }
}
</script>

<template>
  <div class="message" :class="message.role">
    <img v-if="message.role === 'assistant'" class="avatar" src="/favicon.svg" alt="" />
    <div class="content">
      <div v-if="message.toolCalls?.length" class="tools">
        <span v-for="(call, i) in message.toolCalls" :key="i" class="tool-chip">{{ toolLabel(call) }}</span>
      </div>
      <div v-if="message.role === 'assistant'" class="bubble markdown" v-html="html"></div>
      <div v-else class="bubble">{{ message.content }}</div>
      <div v-if="message.recipes?.length" class="recipes">
        <RecipeCard v-for="recipe in message.recipes" :key="recipe.id" :recipe="recipe" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.message {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.message.user {
  justify-content: flex-end;
}
.avatar {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
  font-size: 1rem;
}
.content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  max-width: min(720px, 100%);
}
.user .content {
  align-items: flex-end;
  max-width: min(560px, 85%);
}
.bubble {
  padding: 10px 14px;
  border-radius: 16px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.user .bubble {
  background: var(--primary);
  color: var(--on-primary);
  border-bottom-right-radius: 4px;
  white-space: pre-wrap;
}
.assistant .bubble {
  background: var(--surface);
  border: 1px solid var(--border);
  border-top-left-radius: 4px;
}
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tool-chip {
  font-size: 0.74rem;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px dashed var(--accent);
  color: var(--accent-strong);
  background: var(--accent-soft);
}
.recipes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.markdown :deep(p) {
  margin: 0 0 0.6em;
}
.markdown :deep(p:last-child),
.markdown :deep(ul:last-child),
.markdown :deep(ol:last-child) {
  margin-bottom: 0;
}
.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 0 0 0.6em;
  padding-left: 1.3em;
}
.markdown :deep(a) {
  color: var(--accent-strong);
  font-weight: 500;
}
</style>
