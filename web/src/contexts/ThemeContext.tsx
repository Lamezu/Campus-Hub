import React, { createContext, useContext, useState, useEffect } from 'react';

export type AppTheme = 'light' | 'dark' | 'high-contrast' | 'pastel' | 'monochromatic';

export interface ChatTheme {
  id: string;
  name: string;
  background: string;
  backgroundImage?: string;
  bubbleOwn: string;
  bubbleOther: string;
  textOwn: string;
  textOther: string;
  nameColor: string;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
}

export interface ChatSettings {
  themeId: string;
  fontSize: number;
  fontWeight: '400' | '600' | 'bold';
  fontStyle: 'normal' | 'italic';
}

export const chatSettingsDefaults: ChatSettings = {
  themeId: 'default',
  fontSize: 16,
  fontWeight: '400',
  fontStyle: 'normal',
};

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  danger: string;
  warning: string;
  background: string;
  backgroundSecondary: string;
  text: string;
  textSecondary: string;
  border: string;
  card: string;
  chat: ChatTheme;
  chatSettings: ChatSettings;
}

const defaultChatTheme: ChatTheme = {
  id: 'default',
  name: 'Default',
  background: 'transparent',
  bubbleOwn: '#007AFF',
  bubbleOther: '#E9E9EB',
  textOwn: '#FFFFFF',
  textOther: '#000000',
  nameColor: '#8E8E93',
};

const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    let d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
};

const hslToHex = (h: number, s: number, l: number): string => {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    let hex = Math.round(255 * color).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

export const themes: Record<Exclude<AppTheme, 'monochromatic'>, Omit<ThemeColors, 'chat' | 'chatSettings'>> = {
  light: {
    primary: '#007AFF',
    secondary: '#5856D6',
    success: '#34C759',
    danger: '#FF3B30',
    warning: '#FF9500',
    background: '#FFFFFF',
    backgroundSecondary: '#F2F2F7',
    text: '#1C1C1E',
    textSecondary: '#636366',
    border: '#C6C6C8',
    card: '#FFFFFF',
  },
  dark: {
    primary: '#0A84FF',
    secondary: '#5E5CE6',
    success: '#30D158',
    danger: '#FF453A',
    warning: '#FF9F0A',
    background: '#1C1C1E',
    backgroundSecondary: '#2C2C2E',
    text: '#FFFFFF',
    textSecondary: '#EBEBF599',
    border: '#38383A',
    card: '#2C2C2E',
  },
  'high-contrast': {
    primary: '#FFFF00',
    secondary: '#00FFFF',
    success: '#00FF00',
    danger: '#FF0000',
    warning: '#FFFF00',
    background: '#000000',
    backgroundSecondary: '#000000',
    text: '#FFFFFF',
    textSecondary: '#FFFFFF',
    border: '#FFFFFF',
    card: '#000000',
  },
  pastel: {
    primary: '#C9527E',
    secondary: '#7B5EA7',
    success: '#3BAF8A',
    danger: '#D95070',
    warning: '#C98520',
    background: '#EEE8FA',
    backgroundSecondary: '#F8F5FF',
    text: '#18103A',
    textSecondary: '#5A4785',
    border: '#C4B6E8',
    card: '#F8F5FF',
  },
};

export const chatThemes: Record<string, ChatTheme> = {
  default: defaultChatTheme,
  love: {
    id: 'love',
    name: 'Love',
    background: '#FFF0F5',
    backgroundImage: 'https://i.pinimg.com/736x/35/82/a4/3582a409f827b3e698f6eaf8580b1a0c.jpg',
    bubbleOwn: '#FF69B4',
    bubbleOther: '#FFB6C1',
    textOwn: '#FFFFFF',
    textOther: '#4A4A4A',
    nameColor: '#C2185B',
  },
  gamer: {
    id: 'gamer',
    name: 'Gamer',
    background: '#0F0F23',
    backgroundImage: 'https://i.pinimg.com/736x/0c/0c/0d/0c0c0dbeb2b4d78042be2d14609b7fbb.jpg',
    bubbleOwn: '#00F2FF',
    bubbleOther: '#7000FF',
    textOwn: '#000000',
    textOther: '#FFFFFF',
    nameColor: '#00F2FF',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    background: '#E0F7FA',
    backgroundImage: 'https://i.pinimg.com/236x/33/9b/dc/339bdcf2e288c8a442578cfb1076aab8.jpg',
    bubbleOwn: '#00838F',
    bubbleOther: '#B2EBF2',
    textOwn: '#FFFFFF',
    textOther: '#006064',
    nameColor: '#00696F',
  },
  space: {
    id: 'space',
    name: 'Space',
    background: '#fefeff',
    backgroundImage: 'https://i.pinimg.com/736x/9b/74/42/9b7442dfcf02f20e3d46f29ba5e1dd02.jpg',
    bubbleOwn: '#504a58',
    bubbleOther: '#8f909b',
    textOwn: '#FFFFFF',
    textOther: '#FFFFFF',
    nameColor: '#3D3749',
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    background: '#FBE9E7',
    backgroundImage: 'https://i.pinimg.com/564x/f3/f2/b1/f3f2b1f8cf87e4de41f74ffc78b9f7b7.jpg',
    bubbleOwn: '#FF7043',
    bubbleOther: '#FFCCBC',
    textOwn: '#FFFFFF',
    textOther: '#BF360C',
    nameColor: '#BF360C',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    background: '#E8F5E9',
    backgroundImage: 'https://i.pinimg.com/736x/e3/65/76/e365760a81c47fa405d08604f2d0926d.jpg',
    bubbleOwn: '#2E7D32',
    bubbleOther: '#C8E6C9',
    textOwn: '#FFFFFF',
    textOther: '#1B5E20',
    nameColor: '#1B5E20',
  },
  zen: {
    id: 'zen',
    name: 'Zen',
    background: '#F5F5F5',
    backgroundImage: 'https://png.pngtree.com/thumb_back/fh260/background/20241029/pngtree-man-meditating-at-sunset-image_16371611.jpg',
    bubbleOwn: '#E65100',
    bubbleOther: '#e7cbb3',
    textOwn: '#FFFFFF',
    textOther: '#3E2700',
    nameColor: '#E65100',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    background: '#FFFFFF',
    backgroundImage: 'https://preview.redd.it/i-made-some-phone-wallpapers-if-anyone-is-interested-v0-2rf4fw385bqe1.jpg?width=640&crop=smart&auto=webp&s=79c55a2bbb5fe4e1292ff700753ae8390007e7bf',
    bubbleOwn: '#47363C',
    bubbleOther: '#6A7973',
    textOwn: '#FFFFFF',
    textOther: '#FFFFFF',
    nameColor: '#3E2A30',
  },
  sky: {
    id: 'sky',
    name: 'Sky',
    background: '#E3F2FD',
    backgroundImage: 'https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?q=80&w=500',
    bubbleOwn: '#1976D2',
    bubbleOther: '#BBDEFB',
    textOwn: '#FFFFFF',
    textOther: '#0D47A1',
    nameColor: '#0D47A1',
  },
  coffee: {
    id: 'coffee',
    name: 'Coffee',
    background: '#EFEBE9',
    backgroundImage: 'https://images.rawpixel.com/image_800/cHJpdmF0ZS9sci9pbWFnZXMvd2Vic2l0ZS8yMDI0LTAxL3Jhd3BpeGVsb2ZmaWNlMjFfdHdvX2NvZmZlZV9jdXBzX3BsYWNlZF9jbG9zZV90b2dldGhlcl93aXRoX2xhdF9hMmU2YTU5Ni1iNmJjLTQ5OTMtODRmYy0yODg3NjlkOWVhOGJfMS5qcGc.jpg',
    bubbleOwn: '#6D4C41',
    bubbleOther: '#D7CCC8',
    textOwn: '#FFFFFF',
    textOther: '#3E2723',
    nameColor: '#3E2723',
  },
};

export const getColors = (
  theme: AppTheme,
  customPrimary?: string,
  userChatSettings: ChatSettings = chatSettingsDefaults,
  customChatThemes: ChatTheme[] = []
): ThemeColors => {
  let baseColors: Omit<ThemeColors, 'chat' | 'chatSettings'>;

  if (theme === 'monochromatic' && customPrimary) {
    const { h, s } = hexToHsl(customPrimary);
    const isYellowRange = h >= 35 && h <= 85;
    const primary = isYellowRange ? hslToHex(h, Math.min(s, 90), 36) : customPrimary;
    const bg = hslToHex(h, Math.max(s * 0.06, 4), 97);
    const bgSec = hslToHex(h, Math.max(s * 0.10, 6), 93);
    const border = hslToHex(h, Math.max(s * 0.18, 10), 82);
    const secondary = hslToHex(h, s, 58);
    const textSec = hslToHex(h, Math.min(s, 45), 42);
    const text = hslToHex(h, Math.min(s, 55), 12);
    const card = hslToHex(h, Math.max(s * 0.04, 3), 98);
    baseColors = {
      primary,
      secondary,
      success: '#34C759',
      danger: '#FF3B30',
      warning: '#FF9500',
      background: bg,
      backgroundSecondary: bgSec,
      text,
      textSecondary: textSec,
      border,
      card,
    };
  } else {
    baseColors = themes[theme as keyof typeof themes] || themes.light;
  }

  let chatTheme = chatThemes[userChatSettings.themeId]
    || customChatThemes.find(t => t.id === userChatSettings.themeId)
    || chatThemes.default;

  if (userChatSettings.themeId === 'default') {
    chatTheme = {
      ...chatTheme,
      background: baseColors.background,
      bubbleOwn: baseColors.primary,
      bubbleOther: baseColors.backgroundSecondary,
      textOther: baseColors.text,
    };
  }

  return {
    ...baseColors,
    chat: chatTheme,
    chatSettings: userChatSettings
  };
};

type ThemeContextType = {
  theme: AppTheme;
  colors: ThemeColors;
  customPrimary: string | null;
  chatSettings: ChatSettings;
  chatThemes: Record<string, ChatTheme>;
  customChatThemes: ChatTheme[];
  setTheme: (theme: AppTheme) => void;
  setCustomPrimary: (color: string) => void;
  setChatSettings: (settings: Partial<ChatSettings>) => void;
  addCustomChatTheme: (theme: ChatTheme) => void;
  deleteCustomChatTheme: (themeId: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>('light');
  const [customPrimary, setCustomPrimaryState] = useState<string | null>(null);
  const [chatSettings, setChatSettingsState] = useState<ChatSettings>(chatSettingsDefaults);
  const [customChatThemes, setCustomChatThemesState] = useState<ChatTheme[]>([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as AppTheme | null;
    const savedColor = localStorage.getItem('customPrimary');
    const savedChatSettings = localStorage.getItem('chatSettings');
    const savedCustomThemes = localStorage.getItem('customChatThemes');

    if (savedTheme) {
      setThemeState(savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeState(prefersDark ? 'dark' : 'light');
    }

    if (savedColor) {
      setCustomPrimaryState(savedColor);
    }

    if (savedChatSettings) {
      try {
        setChatSettingsState(JSON.parse(savedChatSettings));
      } catch {
      }
    }

    if (savedCustomThemes) {
      try {
        setCustomChatThemesState(JSON.parse(savedCustomThemes));
      } catch {
      }
    }
  }, []);

  const setTheme = (newTheme: AppTheme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };

  const setCustomPrimary = (color: string) => {
    localStorage.setItem('customPrimary', color);
    setCustomPrimaryState(color);
    if (theme !== 'monochromatic') {
      setTheme('monochromatic');
    }
  };

  const setChatSettings = (newSettings: Partial<ChatSettings>) => {
    const updated = { ...chatSettings, ...newSettings };
    localStorage.setItem('chatSettings', JSON.stringify(updated));
    setChatSettingsState(updated);
  };

  const addCustomChatTheme = (newTheme: ChatTheme) => {
    const updated = [...customChatThemes, newTheme];
    localStorage.setItem('customChatThemes', JSON.stringify(updated));
    setCustomChatThemesState(updated);
  };

  const deleteCustomChatTheme = (themeId: string) => {
    const updated = customChatThemes.filter(t => t.id !== themeId);
    localStorage.setItem('customChatThemes', JSON.stringify(updated));
    setCustomChatThemesState(updated);
    if (chatSettings.themeId === themeId) {
      setChatSettings({ themeId: 'default' });
    }
  };

  const colors = getColors(theme, customPrimary || undefined, chatSettings, customChatThemes);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--secondary', colors.secondary);
    root.style.setProperty('--success', colors.success);
    root.style.setProperty('--danger', colors.danger);
    root.style.setProperty('--warning', colors.warning);
    root.style.setProperty('--background', colors.background);
    root.style.setProperty('--background-secondary', colors.backgroundSecondary);
    root.style.setProperty('--text', colors.text);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--border', colors.border);
    root.style.setProperty('--card', colors.card);
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.text;
  }, [colors]);

  return (
    <ThemeContext.Provider value={{
      theme,
      colors,
      customPrimary,
      chatSettings,
      chatThemes,
      customChatThemes,
      setTheme,
      setCustomPrimary,
      setChatSettings,
      addCustomChatTheme,
      deleteCustomChatTheme,
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