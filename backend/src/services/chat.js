import { config } from '../config/config.js';
import { buildSystemPrompt } from '../prompts/systemPrompt.js';
import { HttpError } from '../utils/httpError.js';
import { generateContent } from './gemini.js';
import {
  ensureUser,
  getPreferences,
  getConversation,
  createConversation,
  getRecentMessages,
  saveMessage,
  touchConversation,
} from './memory.js';
import { toolDeclarations, executeTool, toCard } from './tools.js';

const MAX_STEPS = 5;

function makeTitle(message) {
  const clean = message.replace(/\s+/g, ' ').trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}...` : clean;
}

export function historyToContents(history) {
  const contents = history.map((m) => {
    let text = m.content;
    if (m.role === 'assistant' && m.recipes?.length) {
      const list = m.recipes.map((r) => `id ${r.id}: "${r.title}"`).join('; ');
      text += `\n\n[Nota interna - ricette mostrate in questo messaggio: ${list}]`;
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text }] };
  });
  while (contents.length && contents[0].role !== 'user') contents.shift();
  return contents;
}

export async function handleChat({ userId, conversationId, message }) {
  await ensureUser(userId);

  let conversation = null;
  if (conversationId) {
    conversation = await getConversation(conversationId, userId);
    if (!conversation) throw new HttpError(404, 'Conversazione non trovata');
  } else {
    conversation = await createConversation(userId, makeTitle(message));
  }

  const [history, preferences] = await Promise.all([
    getRecentMessages(conversation.id, config.memory.window),
    getPreferences(userId),
  ]);
  await saveMessage(conversation.id, 'user', message);

  const contents = [...historyToContents(history), { role: 'user', parts: [{ text: message }] }];
  const ctx = { userId, preferences, preferencesUpdated: false, recipes: new Map() };
  const toolCalls = [];
  let reply = '';

  for (let step = 0; step < MAX_STEPS; step++) {
    const isLastStep = step === MAX_STEPS - 1;
    const response = await generateContent({
      contents,
      systemInstruction: buildSystemPrompt(ctx.preferences),
      tools: [{ functionDeclarations: toolDeclarations }],
      toolMode: isLastStep ? 'NONE' : 'AUTO',
    });

    const calls = response.functionCalls ?? [];
    if (!calls.length) {
      reply = response.text?.trim() ?? '';
      break;
    }

    contents.push(response.candidates[0].content);

    const responseParts = [];
    for (const call of calls) {
      const args = call.args ?? {};
      toolCalls.push({ name: call.name, args });
      console.log(`[tool] ${call.name}`, JSON.stringify(args));
      const result = await executeTool(call.name, args, ctx);
      responseParts.push({
        functionResponse: { ...(call.id && { id: call.id }), name: call.name, response: result },
      });
    }
    contents.push({ role: 'user', parts: responseParts });
  }

  if (!reply) {
    reply = 'Scusa, in questo momento non riesco a rispondere. Puoi riformulare la richiesta?';
  }

  const recipes = [...ctx.recipes.values()].map(toCard);
  await saveMessage(conversation.id, 'assistant', reply, { recipes, toolCalls });
  await touchConversation(conversation.id);

  return {
    conversationId: conversation.id,
    title: conversation.title,
    reply,
    recipes,
    toolCalls,
    preferences: ctx.preferencesUpdated ? ctx.preferences : undefined,
  };
}
