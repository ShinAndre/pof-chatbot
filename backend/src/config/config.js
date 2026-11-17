import 'dotenv/config';

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

const float = (value, fallback) => {
  const n = Number.parseFloat(value ?? '');
  return Number.isFinite(n) ? n : fallback;
};

function firebaseCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return undefined;
  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT non valida: deve essere il JSON della chiave oppure il JSON in base64');
  }
}

export const config = {
  port: int(process.env.PORT, 3000),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  adminToken: process.env.ADMIN_TOKEN || '',

  spoonacular: {
    apiKey: process.env.SPOONACULAR_API_KEY || '',
    baseUrl: 'https://api.spoonacular.com',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    chatModel: process.env.GEMINI_CHAT_MODEL || 'gemini-3.5-flash-lite',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
    embeddingDim: int(process.env.GEMINI_EMBEDDING_DIM, 768),
  },

  firebase: {
    serviceAccount: firebaseCredentials(),
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  },

  rag: {
    minScore: float(process.env.RAG_MIN_SCORE, 0.35),
    defaultLimit: 3,
    maxLimit: 5,
  },

  memory: {
    window: int(process.env.MEMORY_WINDOW, 20),
  },
};

export function assertConfig({ needSpoonacular = false } = {}) {
  const missing = [];
  if (!config.gemini.apiKey) missing.push('GEMINI_API_KEY');
  if (!config.firebase.serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) missing.push('FIREBASE_SERVICE_ACCOUNT');
  if (needSpoonacular && !config.spoonacular.apiKey) missing.push('SPOONACULAR_API_KEY');
  if (missing.length) {
    throw new Error(`Variabili d'ambiente mancanti: ${missing.join(', ')} (vedi .env.example)`);
  }
}
