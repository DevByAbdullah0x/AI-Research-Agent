import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ai-research-agent-4f379.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ai-research-agent-4f379",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ai-research-agent-4f379.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "655806517617",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:655806517617:web:718b02c8df36ce6a77a6d0",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-XLF1RSH5DQ"
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export default app;
