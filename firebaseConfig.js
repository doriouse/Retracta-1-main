import { getApp, getApps, initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyBm-EG949QXz28IEMHG5xeHc-SmrwKOZHA',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'retracta-9dc30.firebaseapp.com',
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || 'https://retracta-9dc30-default-rtdb.firebaseio.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'retracta-9dc30',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'retracta-9dc30.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '202845073243',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:202845073243:web:86ce7949a057439876b47e',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const database = getDatabase(app);
