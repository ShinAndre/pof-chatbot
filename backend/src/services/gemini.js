import { GoogleGenAI } from '@google/genai';
import { config } from '../config/config.js';

let client;
function ai() {
  if (!client) client = new GoogleGenAI({
      apiKey: config.gemini.apiKey,
      apiVersion: 'v1beta',
      httpOptions: { timeout: 60_000 },
    });
  return client;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function withRetry(fn, { retries = 4, baseDelayMs = 2000 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status ?? err?.code;
      const retriable = status === 429 || status === 500 || status === 503;
      if (!retriable || attempt >= retries) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`[gemini] errore ${status}, nuovo tentativo tra ${delay / 1000}s...`);
      await sleep(delay);
    }
  }
}

export function generateContent({ contents, systemInstruction, tools, toolMode, temperature = 0.6, responseJsonSchema }) {
  const cfg = { systemInstruction, temperature };
  if (tools) {
    cfg.tools = tools;
    if (toolMode) cfg.toolConfig = { functionCallingConfig: { mode: toolMode } };
  }
  if (responseJsonSchema) {
    cfg.responseMimeType = 'application/json';
    cfg.responseJsonSchema = responseJsonSchema;
  }
  return withRetry(() =>
    ai().models.generateContent({ model: config.gemini.chatModel, contents, config: cfg }),
  );
}

export async function embedTexts(texts, taskType) {
  const response = await withRetry(() =>
    ai().models.embedContent({
      model: config.gemini.embeddingModel,
      contents: texts,
      config: { taskType, outputDimensionality: config.gemini.embeddingDim },
    }),
  );
  const vectors = (response.embeddings ?? []).map((e) => e.values);
  if (vectors.length !== texts.length) {
    throw new Error(`Embedding attesi: ${texts.length}, ricevuti: ${vectors.length}`);
  }
  return vectors;
}

export async function embedQuery(text) {
  const [vector] = await embedTexts([text], 'RETRIEVAL_QUERY');
  return vector;
}
