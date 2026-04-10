import React, { createContext, useContext, useState, useEffect } from 'react';
import { getColors, type AppTheme, type ThemeColors, type ChatSettings, chatSettingsDefaults } from '@/constants/styles';
import { auth, db } from '@/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

type ThemeContextType = {
  theme: AppTheme;
  colors: ThemeColors;
  customPrimary: string | null;
  chatSettings: ChatSettings;
  setTheme: (theme: AppTheme) => Promise<void>;
  setCustomPrimary: (color: string) => Promise<void>;
  setChatSettings: (settings: Partial<ChatSettings>) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemColorScheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');
  const [customPrimary, setCustomPrimaryState] = useState<string | null>(null);
  const [chatSettings, setChatSettingsState] = useState<ChatSettings>(chatSettingsDefaults);

  useEffect(() => {
    loadTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const saved = localStorage.getItem('theme');
      if (!saved) {
        setThemeState(mediaQuery.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Immediate cleanup to avoid "ghost" data from previous user
      setChatSettingsState(chatSettingsDefaults);

      if (user) {
        // Load from local for speed
        const local = localStorage.getItem(`chatSettings_${user.uid}`);
        if (local) {
          try { setChatSettingsState(JSON.parse(local)); } catch (e) {}
        }

        // Setup Firestore listener for Cloud Sync using user root document
        const userRef = doc(db, 'users', user.uid);
        const unsubFirestore = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data.chatSettings) {
              setChatSettingsState(data.chatSettings);
              localStorage.setItem(`chatSettings_${user.uid}`, JSON.stringify(data.chatSettings));
            }
          }
        }, (error) => {
          if (error.code !== 'permission-denied') {
            console.error('ThemeContext: Sync error', error);
          }
        });
        
        return () => unsubFirestore();
      }
    });

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      unsubAuth();
    };
  }, []);

  const loadTheme = () => {
    try {
      const savedTheme = localStorage.getItem('theme');
      const savedColor = localStorage.getItem('customPrimary');

      if (savedTheme) {
        setThemeState(savedTheme as AppTheme);
      } else {
        setThemeState(getSystemColorScheme());
      }

      if (savedColor) {
        setCustomPrimaryState(savedColor);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const setTheme = async (newTheme: AppTheme) => {
    try {
      localStorage.setItem('theme', newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error(error);
    }
  };

  const setCustomPrimary = async (color: string) => {
    try {
      localStorage.setItem('customPrimary', color);
      setCustomPrimaryState(color);
      if (theme !== 'monochromatic') {
        await setTheme('monochromatic');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const setChatSettings = async (newSettings: Partial<ChatSettings>) => {
    try {
      const updated = { ...chatSettings, ...newSettings };
      const uid = auth.currentUser?.uid;
      
      setChatSettingsState(updated);
      
      if (uid) {
        // Save to local
        localStorage.setItem(`chatSettings_${uid}`, JSON.stringify(updated));
        
        // Save to Cloud (Root User Doc)
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { chatSettings: updated });
      }
    } catch (error) {
      console.error('Error saving chat settings:', error);
    }
  };

  const colors = getColors(theme, customPrimary || undefined, chatSettings);

  return (
    <ThemeContext.Provider value={{
      theme,
      colors,
      customPrimary,
      chatSettings,
      setTheme,
      setCustomPrimary,
      setChatSettings,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
