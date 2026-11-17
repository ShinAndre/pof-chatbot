<script setup>
import { ref, nextTick, onMounted } from 'vue';
import { api, getUserId } from './api.js';
import ChatSidebar from './components/ChatSidebar.vue';
import ChatMessage from './components/ChatMessage.vue';

const userId = getUserId();
const conversations = ref([]);
const activeId = ref(null);
const messages = ref([]);
const preferences = ref({});
const input = ref('');
const loading = ref(false);
const error = ref('');
const sidebarOpen = ref(false);
const scroller = ref(null);
const textarea = ref(null);

const suggestions = [
  'Ho poco tempo: una cena veloce con i ceci',
  'Una colazione proteica e vegana',
  'Un dolce senza glutine per domenica',
  'Sono allergico alla frutta secca, cosa mi consigli?',
];

async function scrollToBottom() {
  await nextTick();
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' });
}

async function loadSidebar() {
  try {
    const [convs, prefs] = await Promise.all([api.listConversations(userId), api.getPreferences(userId)]);
    conversations.value = convs;
    preferences.value = prefs ?? {};
  } catch (err) {
    error.value = `Impossibile contattare il server: ${err.message}`;
  }
}

async function selectConversation(id) {
  sidebarOpen.value = false;
  if (id === activeId.value) return;
  error.value = '';
  try {
    const data = await api.getConversation(userId, id);
    activeId.value = id;
    messages.value = data.messages;
    scrollToBottom();
  } catch (err) {
    error.value = err.message;
  }
}

function newChat() {
  activeId.value = null;
  messages.value = [];
  error.value = '';
  sidebarOpen.value = false;
  nextTick(() => textarea.value?.focus());
}

async function deleteConversation(id) {
  if (!confirm('Eliminare questa conversazione?')) return;
  try {
    await api.deleteConversation(userId, id);
    conversations.value = conversations.value.filter((c) => c.id !== id);
    if (id === activeId.value) newChat();
  } catch (err) {
    error.value = err.message;
  }
}

async function clearPreferences() {
  if (!confirm('Vuoi che dimentichi le tue preferenze alimentari?')) return;
  try {
    await api.clearPreferences(userId);
    preferences.value = {};
  } catch (err) {
    error.value = err.message;
  }
}

async function send(text = input.value) {
  const message = text.trim();
  if (!message || loading.value) return;

  error.value = '';
  input.value = '';
  messages.value.push({ role: 'user', content: message });
  loading.value = true;
  scrollToBottom();

  try {
    const res = await api.chat(userId, activeId.value, message);
    messages.value.push({ role: 'assistant', content: res.reply, recipes: res.recipes, toolCalls: res.toolCalls });
    if (res.preferences) preferences.value = res.preferences;
    if (activeId.value !== res.conversationId) activeId.value = res.conversationId;
    conversations.value = await api.listConversations(userId);
  } catch (err) {
    error.value = err.message;
    messages.value.pop();
    input.value = message;
  } finally {
    loading.value = false;
    scrollToBottom();
    nextTick(() => textarea.value?.focus());
  }
}

function onKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    send();
  }
}

onMounted(loadSidebar);
</script>

<template>
  <div class="layout">
    <ChatSidebar
      :conversations="conversations"
      :active-id="activeId"
      :preferences="preferences"
      :open="sidebarOpen"
      @new="newChat"
      @select="selectConversation"
      @delete="deleteConversation"
      @clear-preferences="clearPreferences"
      @close="sidebarOpen = false"
    />

    <main class="chat">
      <header class="topbar">
        <button type="button" class="menu" aria-label="Apri menu" @click="sidebarOpen = true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div>
          <h1>Pof, il tuo assistente plant-based</h1>
          <p>Ricette vegetali, sostenibili e su misura per te</p>
        </div>
      </header>

      <div ref="scroller" class="messages">
        <section v-if="!messages.length" class="welcome">
          <img class="leaf" src="/favicon.svg" alt="" width="56" height="56" />
          <h2>Ciao! Cosa ti va di cucinare?</h2>
          <p>
            Raccontami i tuoi gusti, quanto tempo hai e cosa non mangi: cerco per te ricette plant-based davvero
            sostenibili nel ricettario POF.
          </p>
          <div class="suggestions">
            <button v-for="s in suggestions" :key="s" type="button" @click="send(s)">{{ s }}</button>
          </div>
        </section>

        <ChatMessage v-for="(m, i) in messages" :key="i" :message="m" />

        <div v-if="loading" class="typing" aria-live="polite">
          <img class="avatar" src="/favicon.svg" alt="" />
          <span class="dots"><i></i><i></i><i></i></span>
          <span class="sr-only">Pof sta scrivendo</span>
        </div>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <form class="composer" @submit.prevent="send()">
        <textarea
          ref="textarea"
          v-model="input"
          rows="1"
          maxlength="1000"
          placeholder="Scrivi un messaggio... (es. una zuppa calda con le lenticchie)"
          aria-label="Messaggio"
          @keydown="onKeydown"
        ></textarea>
        <button type="submit" :disabled="loading || !input.trim()" aria-label="Invia">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  height: 100dvh;
}
.chat {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.topbar h1 {
  font-family: 'Fraunces', serif;
  font-size: 1.15rem;
  margin: 0;
  color: var(--primary-text);
}
.topbar p {
  margin: 2px 0 0;
  font-size: 0.82rem;
  color: var(--text-muted);
}
.menu {
  display: none;
  padding: 4px;
  background: none;
  border: none;
  font-size: 1.4rem;
  color: var(--text);
  cursor: pointer;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.welcome {
  margin: auto;
  max-width: 560px;
  text-align: center;
}
.leaf {
  font-size: 2.6rem;
}
.welcome h2 {
  font-family: 'Fraunces', serif;
  color: var(--primary-text);
  margin: 6px 0;
}
.welcome p {
  color: var(--text-muted);
  line-height: 1.55;
}
.suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 18px;
}
.suggestions button {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.86rem;
  cursor: pointer;
}
.suggestions button:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.typing {
  display: flex;
  align-items: center;
  gap: 10px;
}
.typing .avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent-soft);
}
.dots {
  display: inline-flex;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  animation: blink 1.2s infinite ease-in-out;
}
.dots i:nth-child(2) {
  animation-delay: 0.2s;
}
.dots i:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-3px); }
}
.error {
  margin: 0 24px 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--error-bg);
  color: var(--error);
  font-size: 0.86rem;
}
.composer {
  display: flex;
  gap: 10px;
  padding: 12px 24px 20px;
}
textarea {
  flex: 1;
  resize: none;
  max-height: 160px;
  field-sizing: content;
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  line-height: 1.45;
}
textarea:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.composer button {
  display: grid;
  place-items: center;
  flex: none;
  width: 48px;
  border-radius: 14px;
  border: none;
  background: var(--primary);
  color: var(--on-primary);
  font-size: 1.1rem;
  cursor: pointer;
}
.composer button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
@media (max-width: 820px) {
  .menu {
    display: block;
  }
  .topbar,
  .messages,
  .composer {
    padding-left: 16px;
    padding-right: 16px;
  }
  .error {
    margin: 0 16px 8px;
  }
}
</style>
