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
  isDark?: boolean; // True if the theme background is dark (forces light text)
}

export interface ChatSettings {
  themeId: string;
  fontSize: number;
  fontWeight: '400' | '600' | 'bold';
  fontStyle: 'normal' | 'italic';
  notificationSound: string;
  muteUntil?: number;
  customBackground?: { url: string; x: number; y: number; scale: number } | null;
  savedCustomBackgrounds?: { url: string; x: number; y: number; scale: number }[] | null;
}

export const chatSettingsDefaults: ChatSettings = {
  themeId: 'default',
  fontSize: 16,
  fontWeight: '400',
  fontStyle: 'normal',
  notificationSound: 'default',
  muteUntil: 0,
  customBackground: null,
  savedCustomBackgrounds: [],
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
    nameColor: '#FFFFFF',
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
    nameColor: '#FFFFFF',
    isDark: true,
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
    nameColor: '#FFFFFF',
  },
  space: {
    id: 'space',
    name: 'Space',
    background: '#fefeffff',
    backgroundImage: 'https://i.pinimg.com/736x/9b/74/42/9b7442dfcf02f20e3d46f29ba5e1dd02.jpg',
    bubbleOwn: '#504a58ff',
    bubbleOther: '#8f909bff',
    textOwn: '#FFFFFF',
    textOther: '#E8EAF6',
    nameColor: '#FFFFFF',
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
    nameColor: '#FFFFFF',
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
    nameColor: '#FFFFFF',
  },
  zen: {
    id: 'zen',
    name: 'Zen',
    background: '#F5F5F5',
    backgroundImage: 'https://png.pngtree.com/thumb_back/fh260/background/20241029/pngtree-man-meditating-at-sunset-image_16371611.jpg',
    bubbleOwn: '#ffaf53ff',
    bubbleOther: '#e7cbb3ff',
    textOwn: '#FFFFFF',
    textOther: '#212121',
    nameColor: '#FFFFFF',
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    background: '#ffffffff',
    backgroundImage: 'https://preview.redd.it/i-made-some-phone-wallpapers-if-anyone-is-interested-v0-2rf4fw385bqe1.jpg?width=640&crop=smart&auto=webp&s=79c55a2bbb5fe4e1292ff700753ae8390007e7bf',
    bubbleOwn: '#47363cff',
    bubbleOther: '#6a7973ff',
    textOwn: '#ffffffff',
    textOther: '#ffffffff',
    nameColor: '#FFFFFF',
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
    nameColor: '#FFFFFF',
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
    nameColor: '#FFFFFF',
  },
};

export const getColors = (
  theme: AppTheme,
  customPrimary?: string,
  userChatSettings: ChatSettings = chatSettingsDefaults
): ThemeColors => {
  let baseColors: Omit<ThemeColors, 'chat' | 'chatSettings'>;

  if (theme === 'monochromatic' && customPrimary) {
    const { h, s, l } = hexToHsl(customPrimary);
    const isYellowRange = h >= 35 && h <= 85;
    const primary = isYellowRange && l > 45 ? hslToHex(h, s, 38) : customPrimary;
    const bg = hslToHex(h, Math.max(s * 0.45, 18), 84);
    const bgSec = hslToHex(h, Math.max(s * 0.55, 25), 77);
    const border = hslToHex(h, Math.max(s * 0.62, 32), 65);
    const secondary = hslToHex(h, s, 58);
    const textSec = hslToHex(h, Math.min(s, 65), 35);
    const text = hslToHex(h, Math.min(s, 70), 10);
    const card = hslToHex(h, Math.max(s * 0.28, 12), 90);
    baseColors = {
      primary, secondary,
      success: '#34C759', danger: '#FF3B30', warning: '#FF9500',
      background: bg, backgroundSecondary: bgSec, text, textSecondary: textSec, border, card,
    };
  } else {
    baseColors = themes[theme as keyof typeof themes] || themes.light;
  }

  let chatTheme = chatThemes[userChatSettings.themeId] || chatThemes.default;

  if (userChatSettings.themeId === 'default') {
    chatTheme = {
      ...chatTheme,
      background: baseColors.background,
      bubbleOwn: baseColors.primary,
      bubbleOther: baseColors.backgroundSecondary,
      textOther: baseColors.text,
      isDark: theme === 'dark' || theme === 'high-contrast'
    };
  }

  return { ...baseColors, chat: chatTheme, chatSettings: userChatSettings };
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: '400' as const,
    semibold: '600' as const,
    bold: 'bold' as const,
  },
};

export const STATUS_COLORS: Record<string, string> = {
  'open': '#FF9500',
  'in_progress': '#007AFF',
  'resolved': '#34C759'
};

export const STATUS_LABELS: Record<string, string> = {
  'open': 'Abierto',
  'in_progress': 'En curso',
  'resolved': 'Resuelto'
};