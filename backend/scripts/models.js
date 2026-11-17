import { config, assertConfig } from '../src/config/config.js';

assertConfig();

const chat = [];
const embedding = [];
let pageToken = '';

do {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const res = await fetch(url, { headers: { 'x-goog-api-key': config.gemini.apiKey } });
  if (!res.ok) {
    console.error(`Errore ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  for (const m of data.models ?? []) {
    const name = m.name.replace('models/', '');
    const methods = m.supportedGenerationMethods ?? [];
    if (methods.includes('generateContent')) chat.push(name);
    if (methods.includes('embedContent')) embedding.push(name);
  }
  pageToken = data.nextPageToken ?? '';
} while (pageToken);

console.log('Modelli per la chat (GEMINI_CHAT_MODEL):');
chat.forEach((m) => console.log('  ' + m));
console.log('\nModelli per gli embedding (GEMINI_EMBEDDING_MODEL):');
embedding.forEach((m) => console.log('  ' + m));
console.log(`\nAttualmente configurati: chat = ${config.gemini.chatModel}, embedding = ${config.gemini.embeddingModel}`);
