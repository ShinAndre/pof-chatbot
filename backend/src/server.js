import express from 'express';
import cors from 'cors';
import { config, assertConfig } from './config/config.js';
import { initDb } from './db/db.js';
import { router } from './routes/api.js';

assertConfig();

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin(origin, callback) {
      const allowed = !origin || config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin);
      callback(null, allowed);
    },
  }),
);
app.use(express.json({ limit: '50kb' }));

app.get('/', (req, res) => res.json({ name: 'POF - Planty of Food API', docs: '/api/health' }));
app.use('/api', router);

app.use((req, res) => res.status(404).json({ error: 'Endpoint non trovato' }));

app.use((err, req, res, next) => {
  const status = err.status && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Errore interno del server' : err.message });
});

try {
  await initDb();
  app.listen(config.port, () => console.log(`Server avviato sulla porta ${config.port}`));
} catch (err) {
  console.error('Impossibile avviare il server (controlla la connessione a Firestore):', err.message || err.code || err);
  process.exit(1);
}
