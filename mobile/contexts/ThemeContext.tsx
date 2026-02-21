import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import { getColors, type AppTheme, type ThemeColors, type ChatSettings, chatSettingsDefaults } from '@/constants/styles';

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<AppTheme>('light');
  const [customPrimary, setCustomPrimaryState] = useState<string | null>(null);
  const [chatSettings, setChatSettingsState] = useState<ChatSettings>(chatSettingsDefaults);

  useEffect(() => {
    loadTheme();
  }, [systemColorScheme]);

  const loadTheme = async () => {
    try {
      const [savedTheme, savedColor, savedChatSettings] = await Promise.all([
        AsyncStorage.getItem('theme'),
        AsyncStorage.getItem('customPrimary'),
        AsyncStorage.getItem('chatSettings'),
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
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (newTheme: AppTheme) => {
    try {
      await AsyncStorage.setItem('theme', newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
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
      console.error('Error saving custom color:', error);
    }
  };

  const setChatSettings = async (newSettings: Partial<ChatSettings>) => {
    try {
      const updated = { ...chatSettings, ...newSettings };
      await AsyncStorage.setItem('chatSettings', JSON.stringify(updated));
      setChatSettingsState(updated);
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
      setChatSettings
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