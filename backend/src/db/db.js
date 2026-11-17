import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from '../config/config.js';

let db;

export function getDb() {
  if (!db) {
    if (!getApps().length) {
      const { serviceAccount, projectId } = config.firebase;
      initializeApp(
        serviceAccount
          ? { credential: cert(serviceAccount) }
          : { credential: applicationDefault(), ...(projectId && { projectId }) },
      );
    }
    db = getFirestore();
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export async function initDb() {
  await getDb().collection('recipes').limit(1).get();
}

export async function closeDb() {
  if (db) await db.terminate();
  db = undefined;
}
