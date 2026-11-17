import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getDb } from '../db/db.js';


const users = () => getDb().collection('users');
const conversations = () => getDb().collection('conversations');
const messagesOf = (conversationId) => conversations().doc(conversationId).collection('messages');
const toDate = (ts) => (ts?.toDate ? ts.toDate() : (ts ?? null));

export async function ensureUser(userId) {
  const ref = users().doc(userId);
  if ((await ref.get()).exists) return;
  const now = Timestamp.now();
  await ref.create({ createdAt: now, updatedAt: now }).catch((err) => {
    if (err.code !== 6) throw err; 
  });
}

export async function getPreferences(userId) {
  const snap = await users().doc(userId).get();
  return snap.data()?.preferences ?? {};
}

const LIST_FIELDS = ['allergies', 'dislikedIngredients', 'favoriteIngredients'];
const SCALAR_FIELDS = ['dietStyle', 'maxReadyTime', 'notes'];

export function mergePreferences(current = {}, update = {}) {
  const merged = { ...current };
  for (const field of LIST_FIELDS) {
    if (!Array.isArray(update[field])) continue;
    const seen = new Set((merged[field] ?? []).map((v) => v.toLowerCase()));
    merged[field] = [...(merged[field] ?? [])];
    for (const value of update[field]) {
      const v = String(value).trim();
      if (v && !seen.has(v.toLowerCase())) {
        merged[field].push(v);
        seen.add(v.toLowerCase());
      }
    }
  }
  for (const field of SCALAR_FIELDS) {
    if (update[field] !== undefined && update[field] !== null && update[field] !== '') merged[field] = update[field];
  }
  return merged;
}

export async function savePreferences(userId, update) {
  const merged = mergePreferences(await getPreferences(userId), update);
  await users()
    .doc(userId)
    .set({ preferences: merged, updatedAt: Timestamp.now() }, { mergeFields: ['preferences', 'updatedAt'] });
  return merged;
}

export async function clearPreferences(userId) {
  await users()
    .doc(userId)
    .set({ preferences: FieldValue.delete(), updatedAt: Timestamp.now() }, { merge: true });
}


export async function createConversation(userId, title) {
  const id = randomUUID();
  const now = Timestamp.now();
  await conversations().doc(id).set({ userId, title, createdAt: now, updatedAt: now });
  return { id, title };
}

export async function getConversation(conversationId, userId) {
  const snap = await conversations().doc(conversationId).get();
  const data = snap.data();
  if (!data || data.userId !== userId) return null;
  return { id: snap.id, title: data.title };
}

export async function listConversations(userId) {
  const snap = await conversations().where('userId', '==', userId).get();
  return snap.docs
    .map((d) => ({
      id: d.id,
      title: d.data().title,
      createdAt: toDate(d.data().createdAt),
      updatedAt: toDate(d.data().updatedAt),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 50);
}

export async function deleteConversation(conversationId, userId) {
  if (!(await getConversation(conversationId, userId))) return false;
  await getDb().recursiveDelete(conversations().doc(conversationId)); 
  return true;
}

export async function touchConversation(conversationId) {
  await conversations().doc(conversationId).update({ updatedAt: Timestamp.now() });
}

export async function saveMessage(conversationId, role, content, { recipes = null, toolCalls = null } = {}) {
  await messagesOf(conversationId).add({
    role,
    content,
    recipes: recipes?.length ? recipes : null,
    toolCalls: toolCalls?.length ? toolCalls : null,
    createdAt: Timestamp.now(),
  });
}

function docToMessage(doc) {
  const data = doc.data();
  return {
    role: data.role,
    content: data.content,
    recipes: data.recipes ?? [],
    toolCalls: data.toolCalls ?? [],
    createdAt: toDate(data.createdAt),
  };
}

export async function getMessages(conversationId) {
  const snap = await messagesOf(conversationId).orderBy('createdAt', 'asc').get();
  return snap.docs.map(docToMessage);
}

export async function getRecentMessages(conversationId, limit) {
  const snap = await messagesOf(conversationId).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs.map(docToMessage).reverse();
}
