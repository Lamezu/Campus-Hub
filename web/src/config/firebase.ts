import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyA2Bvno8r2bi7Uv_2SuTiQ2HsmO3fGPLjs",
  authDomain: "campushub-52343.firebaseapp.com",
  projectId: "campushub-52343",
  storageBucket: "campushub-52343.firebasestorage.app",
  messagingSenderId: "989790879586",
  appId: "1:989790879586:web:a746592970c447eed0f63b",
  measurementId: "G-EP45ZLG6GC"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;