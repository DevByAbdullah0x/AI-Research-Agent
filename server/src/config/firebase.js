import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

let app;
const existingApps = getApps();

if (existingApps.length > 0) {
  app = existingApps[0];
} else {
  let credential;

  // 1. Try raw JSON string from env var (Vercel production secret)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      credential = cert(parsed);
    } catch (e) {
      console.error('[Firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e.message);
    }
  }

  // 2. Try file path from env var or local serviceAccountKey.json location
  if (!credential) {
    const defaultPath = resolve(currentDir, '../../serviceAccountKey.json');
    const targetPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      ? resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : defaultPath;

    if (existsSync(targetPath)) {
      try {
        const fileContent = JSON.parse(readFileSync(targetPath, 'utf8'));
        credential = cert(fileContent);
      } catch (e) {
        console.error('[Firebase] Failed to read service account file from ' + targetPath + ':', e.message);
      }
    }
  }

  // 3. Fallback to default application credentials if running in GCP
  if (!credential) {
    try {
      credential = applicationDefault();
    } catch {
      console.warn('[Firebase] Warning: No service account credentials found. Admin operations may fail.');
    }
  }

  app = initializeApp({
    credential: credential || applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'ai-research-agent-4f379'
  });
}

export const firebaseApp = app;
export const firebaseAuth = getAuth(app);
export const firestoreDb = getFirestore(app);
export default app;
