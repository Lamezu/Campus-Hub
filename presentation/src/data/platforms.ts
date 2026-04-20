import { Smartphone, Globe, Monitor } from 'lucide-react';
import type { PlatformData } from '../types';

export const PLATFORMS: PlatformData[] = [
  {
    key: 'mobile',
    Icon: Smartphone,
    iconColor: '#3b82f6',
    name: 'App Móvil',
    tech: 'React Native · Expo · iOS & Android',
    feats: [
      'Chat de canales con roles',
      'Mensajes directos y grupos',
      'Explorar: posts y eventos',
      'Notificaciones push FCM',
      'Temas claro / oscuro',
    ],
  },
  {
    key: 'web',
    Icon: Globe,
    iconColor: '#10b981',
    name: 'Plataforma Web',
    tech: 'React · Vite · WebRTC',
    feats: [
      'Videollamadas 1:1 y grupales',
      'Compartir pantalla',
      'Chat integrado en tiempo real',
      'DMs y grupos de conversación',
      'Estado en línea de contactos',
    ],
  },
  {
    key: 'desktop',
    Icon: Monitor,
    iconColor: '#8b5cf6',
    name: 'App de Escritorio',
    tech: 'Electron · Node.js',
    feats: [
      'Panel de administración',
      'Gestión de usuarios y roles',
      'Gestión de eventos y anuncios',
      'Estadísticas de actividad',
      'Soporte multiplataforma',
    ],
  },
];
