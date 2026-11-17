<script setup>
import { computed } from 'vue';

const props = defineProps({
  conversations: { type: Array, default: () => [] },
  activeId: { type: String, default: null },
  preferences: { type: Object, default: () => ({}) },
  open: { type: Boolean, default: false },
});
const emit = defineEmits(['new', 'select', 'delete', 'clear-preferences', 'close']);

const preferenceRows = computed(() => {
  const p = props.preferences ?? {};
  return [
    ['Allergie', p.allergies?.join(', ')],
    ['Non gradisce', p.dislikedIngredients?.join(', ')],
    ['Preferiti', p.favoriteIngredients?.join(', ')],
    ['Stile', p.dietStyle],
    ['Tempo max', p.maxReadyTime && `${p.maxReadyTime} min`],
    ['Note', p.notes],
  ].filter(([, v]) => v);
});
</script>

<template>
  <div v-if="open" class="backdrop" @click="emit('close')"></div>
  <aside class="sidebar" :class="{ open }">
    <div class="brand">
      <img src="/favicon.svg" alt="" width="36" height="36" />
      <div>
        <strong>POF</strong>
        <span>Planty of Food</span>
      </div>
    </div>

    <button type="button" class="new-chat" @click="emit('new')">+ Nuova chat</button>

    <nav class="section">
      <h2>Le tue chat</h2>
      <p v-if="!conversations.length" class="empty">Nessuna conversazione salvata.</p>
      <ul>
        <li v-for="c in conversations" :key="c.id" :class="{ active: c.id === activeId }">
          <button type="button" class="conv" :title="c.title" @click="emit('select', c.id)">{{ c.title }}</button>
          <button type="button" class="delete" aria-label="Elimina conversazione" @click="emit('delete', c.id)">&times;</button>
        </li>
      </ul>
    </nav>

    <section class="section memory">
      <h2>Le tue preferenze</h2>
      <p v-if="!preferenceRows.length" class="empty">Dimmi allergie o gusti e li ricorderò nelle prossime chat.</p>
      <dl v-else>
        <template v-for="[label, value] in preferenceRows" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </template>
      </dl>
      <button v-if="preferenceRows.length" type="button" class="link-btn" @click="emit('clear-preferences')">
        Dimentica le mie preferenze
      </button>
    </section>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 280px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 14px;
  background: var(--sidebar);
  color: var(--on-primary);
  overflow-y: auto;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand strong {
  display: block;
  font-family: 'Fraunces', serif;
  font-size: 1.3rem;
  letter-spacing: 0.04em;
}
.brand span {
  font-size: 0.78rem;
  opacity: 0.75;
}
.new-chat {
  padding: 10px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.08);
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.new-chat:hover {
  background: rgba(255, 255, 255, 0.16);
}
.section h2 {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.7;
  margin: 0 0 8px;
}
.empty {
  font-size: 0.82rem;
  opacity: 0.7;
  margin: 0;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
li {
  display: flex;
  border-radius: 8px;
}
li.active,
li:hover {
  background: rgba(255, 255, 255, 0.12);
}
.conv {
  flex: 1;
  min-width: 0;
  text-align: left;
  padding: 8px 10px;
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  font-size: 0.86rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.delete {
  background: none;
  border: none;
  color: inherit;
  opacity: 0;
  padding: 0 10px;
  font-size: 1.1rem;
  cursor: pointer;
}
li:hover .delete,
li.active .delete,
.delete:focus-visible {
  opacity: 0.7;
}
.memory {
  margin-top: auto;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.07);
}
dl {
  margin: 0;
  font-size: 0.82rem;
}
dt {
  opacity: 0.65;
  font-size: 0.72rem;
  margin-top: 6px;
}
dd {
  margin: 0;
}
.link-btn {
  margin-top: 10px;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  opacity: 0.75;
  font: inherit;
  font-size: 0.78rem;
  text-decoration: underline;
  cursor: pointer;
}
.backdrop {
  display: none;
}
@media (max-width: 820px) {
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 20;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }
  .sidebar.open {
    transform: none;
  }
  .backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 15;
    background: rgba(0, 0, 0, 0.4);
  }
  .delete {
    opacity: 0.7;
  }
}
</style>
