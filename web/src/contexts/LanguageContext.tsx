import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  loading: boolean;
}

const STORAGE_KEY = '@app_language';

const LanguageContext = createContext<LanguageContextType>({
  language: 'es',
  setLanguage: async () => {},
  loading: true,
});

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const getScopedKey = (base: string, uid: string | null) => uid ? `${base}_${uid}` : base;

  useEffect(() => {
    const detectLanguage = async (uid: string | null) => {
      try {
        const storedKey = getScopedKey(STORAGE_KEY, uid);
        let stored = localStorage.getItem(storedKey) as Language | null;
        
        if (uid && !stored && localStorage.getItem(STORAGE_KEY)) {
          stored = localStorage.getItem(STORAGE_KEY) as Language;
          localStorage.setItem(storedKey, stored);
          localStorage.removeItem(STORAGE_KEY);
        }

        if (stored === 'es' || stored === 'en') {
          setLanguageState(stored);
          setLoading(false);
          return;
        }

        const browserLang = navigator.language?.slice(0, 2);
        if (browserLang === 'en') {
          setLanguageState('en');
        } else {
          setLanguageState('es');
        }
      } catch {
        setLanguageState('es');
      } finally {
        setLoading(false);
      }
    };

    const unsub = onAuthStateChanged(auth, async (user) => {
      const uid = user ? user.uid : null;
      userIdRef.current = uid;
      
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          if (snap.exists()) {
            const lang = snap.data()?.language as Language | undefined;
            if (lang === 'es' || lang === 'en') {
              setLanguageState(lang);
              localStorage.setItem(getScopedKey(STORAGE_KEY, uid), lang);
              setLoading(false);
              return;
            }
          }
        } catch {}
      }
      detectLanguage(uid);
    });

    return unsub;
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(getScopedKey(STORAGE_KEY, userIdRef.current), lang);
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { language: lang });
      } catch {}
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}
