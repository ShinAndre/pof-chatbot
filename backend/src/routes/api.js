import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/config.js';
import { HttpError, assertUuid } from '../utils/httpError.js';
import { handleChat } from '../services/chat.js';
import { countRecipes } from '../services/rag.js';
import { ingestRecipes, DEFAULT_PLAN } from '../services/ingest.js';
import {
  ensureUser,
  getPreferences,
  clearPreferences,
  listConversations,
  getConversation,
  getMessages,
  deleteConversation,
} from '../services/memory.js';

export const router = Router();

const MAX_MESSAGE_LENGTH = 1000;

const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Troppe richieste, riprova tra un minuto.' },
});

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.get('/recipes/stats', async (req, res) => {
  res.json({ total: await countRecipes() });
});


router.post('/chat', chatLimiter, async (req, res) => {
  const { userId, conversationId, message } = req.body ?? {};
  const uid = assertUuid(userId, 'userId');
  const cid = conversationId ? assertUuid(conversationId, 'conversationId') : null;
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text) throw new HttpError(400, 'Il messaggio è vuoto');
  if (text.length > MAX_MESSAGE_LENGTH) throw new HttpError(400, `Il messaggio supera i ${MAX_MESSAGE_LENGTH} caratteri`);

  res.json(await handleChat({ userId: uid, conversationId: cid, message: text }));
});


router.get('/conversations', async (req, res) => {
  const uid = assertUuid(req.query.userId, 'userId');
  res.json(await listConversations(uid));
});

router.get('/conversations/:id', async (req, res) => {
  const uid = assertUuid(req.query.userId, 'userId');
  const cid = assertUuid(req.params.id, 'id');
  const conversation = await getConversation(cid, uid);
  if (!conversation) throw new HttpError(404, 'Conversazione non trovata');
  res.json({ ...conversation, messages: await getMessages(cid) });
});

router.delete('/conversations/:id', async (req, res) => {
  const uid = assertUuid(req.query.userId, 'userId');
  const cid = assertUuid(req.params.id, 'id');
  if (!(await deleteConversation(cid, uid))) throw new HttpError(404, 'Conversazione non trovata');
  res.status(204).end();
});


router.get('/users/:id/preferences', async (req, res) => {
  const uid = assertUuid(req.params.id, 'id');
  await ensureUser(uid);
  res.json(await getPreferences(uid));
});

router.delete('/users/:id/preferences', async (req, res) => {
  const uid = assertUuid(req.params.id, 'id');
  await clearPreferences(uid);
  res.status(204).end();
});


function requireAdmin(req) {
  const token = req.get('x-admin-token') ?? '';
  const expected = config.adminToken;
  const ok =
    expected.length > 0 &&
    token.length === expected.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  if (!ok) throw new HttpError(401, 'Token admin non valido');
}

router.post('/admin/ingest', async (req, res) => {
  requireAdmin(req);
  const { plan, number } = req.body ?? {};
  const validPlan = Array.isArray(plan) && plan.length ? plan.slice(0, 20) : DEFAULT_PLAN;
  const n = Math.min(Math.max(Number(number) || 15, 1), 50);
  res.json(await ingestRecipes({ plan: validPlan, number: n }));
});
