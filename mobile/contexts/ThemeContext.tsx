import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<AppTheme>('light');
  const [customPrimary, setCustomPrimaryState] = useState<string | null>(null);
  const [chatSettings, setChatSettingsState] = useState<ChatSettings>(chatSettingsDefaults);
  const [customChatThemes, setCustomChatThemesState] = useState<ChatTheme[]>([]);

  useEffect(() => {
    loadTheme();
  }, [systemColorScheme]);

  const loadTheme = async () => {
    try {
      const [savedTheme, savedColor, savedChatSettings, savedChatThemes] = await Promise.all([
        AsyncStorage.getItem('theme'),
        AsyncStorage.getItem('customPrimary'),
        AsyncStorage.getItem('chatSettings'),
        AsyncStorage.getItem('customChatThemes'),
      ]);

      if (savedTheme) {
        setThemeState(savedTheme as AppTheme);
      } else {
        setThemeState(systemColorScheme === 'dark' ? 'dark' : 'light');
      }

      if (savedColor) {
        setCustomPrimaryState(savedColor);
      }

      if (savedChatSettings) {
        setChatSettingsState(JSON.parse(savedChatSettings));
      }

      if (savedChatThemes) {
        setCustomChatThemesState(JSON.parse(savedChatThemes));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const setTheme = async (newTheme: AppTheme) => {
    try {
      await AsyncStorage.setItem('theme', newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error(error);
    }
  };

  const setCustomPrimary = async (color: string) => {
    try {
      await AsyncStorage.setItem('customPrimary', color);
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
      await AsyncStorage.setItem('chatSettings', JSON.stringify(updated));
      setChatSettingsState(updated);
    } catch (error) {
      console.error(error);
    }
  };

  const addCustomChatTheme = async (theme: ChatTheme) => {
    try {
      const updated = [...customChatThemes, theme];
      await AsyncStorage.setItem('customChatThemes', JSON.stringify(updated));
      setCustomChatThemesState(updated);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteCustomChatTheme = async (themeId: string) => {
    try {
      const updated = customChatThemes.filter(t => t.id !== themeId);
      await AsyncStorage.setItem('customChatThemes', JSON.stringify(updated));
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