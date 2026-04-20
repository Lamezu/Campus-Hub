import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { getColors, type AppTheme, type ThemeColors, type ChatSettings, chatSettingsDefaults, type ChatTheme } from '@/constants/styles';

type ThemeContextType = {
  theme: AppTheme;
  colors: ThemeColors;
  customPrimary: string | null;
  chatSettings: ChatSettings;
  customChatThemes: ChatTheme[];
  setTheme: (theme: AppTheme) => Promise<void>;
  setCustomPrimary: (color: string) => Promise<void>;
  setChatSettings: (settings: Partial<ChatSettings>) => Promise<void>;
  addCustomChatTheme: (theme: ChatTheme) => Promise<void>;
  deleteCustomChatTheme: (themeId: string) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const uk = (base: string, uid: string | null) => (uid ? `${base}_${uid}` : base);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const systemSchemeRef = useRef(systemColorScheme);
  systemSchemeRef.current = systemColorScheme;

  const [theme, setThemeState] = useState<AppTheme>('light');
  const [customPrimary, setCustomPrimaryState] = useState<string | null>(null);
  const [chatSettings, setChatSettingsState] = useState<ChatSettings>(chatSettingsDefaults);
  const [customChatThemes, setCustomChatThemesState] = useState<ChatTheme[]>([]);

  const loadTheme = async (uid: string | null) => {
    try {
      const [savedTheme, savedColor, savedChatSettings, savedChatThemes] = await Promise.all([
        AsyncStorage.getItem(uk('theme', uid)),
        AsyncStorage.getItem(uk('customPrimary', uid)),
        AsyncStorage.getItem(uk('chatSettings', uid)),
        AsyncStorage.getItem(uk('customChatThemes', uid)),
      ]);

      setThemeState(savedTheme ? (savedTheme as AppTheme) : (systemSchemeRef.current === 'dark' ? 'dark' : 'light'));
      setCustomPrimaryState(savedColor ?? null);
      setChatSettingsState(savedChatSettings ? JSON.parse(savedChatSettings) : chatSettingsDefaults);
      setCustomChatThemesState(savedChatThemes ? JSON.parse(savedChatThemes) : []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      loadTheme(user?.uid ?? null);
    });
    return unsub;
  }, [systemColorScheme]);

  const setTheme = async (newTheme: AppTheme) => {
    try {
      const uid = auth.currentUser?.uid ?? null;
      await AsyncStorage.setItem(uk('theme', uid), newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error(error);
    }
  };

  const setCustomPrimary = async (color: string) => {
    try {
      const uid = auth.currentUser?.uid ?? null;
      await AsyncStorage.setItem(uk('customPrimary', uid), color);
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
      const uid = auth.currentUser?.uid ?? null;
      const updated = { ...chatSettings, ...newSettings };
      await AsyncStorage.setItem(uk('chatSettings', uid), JSON.stringify(updated));
      setChatSettingsState(updated);
    } catch (error) {
      console.error(error);
    }
  };

  const addCustomChatTheme = async (newTheme: ChatTheme) => {
    try {
      const uid = auth.currentUser?.uid ?? null;
      const updated = [...customChatThemes, newTheme];
      await AsyncStorage.setItem(uk('customChatThemes', uid), JSON.stringify(updated));
      setCustomChatThemesState(updated);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteCustomChatTheme = async (themeId: string) => {
    try {
      const uid = auth.currentUser?.uid ?? null;
      const updated = customChatThemes.filter(t => t.id !== themeId);
      await AsyncStorage.setItem(uk('customChatThemes', uid), JSON.stringify(updated));
      setCustomChatThemesState(updated);
    } catch (error) {
      console.error(error);
    }
  };

  const colors = getColors(theme, customPrimary || undefined, chatSettings, customChatThemes);

  return (
    <ThemeContext.Provider value={{
      theme,
      colors,
      customPrimary,
      chatSettings,
      customChatThemes,
      setTheme,
      setCustomPrimary,
      setChatSettings,
      addCustomChatTheme,
      deleteCustomChatTheme
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
