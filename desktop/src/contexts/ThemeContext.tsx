import React, { createContext, useContext, useState, useEffect } from 'react';
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
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const loadTheme = () => {
    try {
      const savedTheme = localStorage.getItem('theme');
      const savedColor = localStorage.getItem('customPrimary');
      const savedChatSettings = localStorage.getItem('chatSettings');

      if (savedTheme) {
        setThemeState(savedTheme as AppTheme);
      } else {
        setThemeState(getSystemColorScheme());
      }

      if (savedColor) {
        setCustomPrimaryState(savedColor);
      }

      if (savedChatSettings) {
        setChatSettingsState(JSON.parse(savedChatSettings));
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
      localStorage.setItem('chatSettings', JSON.stringify(updated));
      setChatSettingsState(updated);
    } catch (error) {
      console.error(error);
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
