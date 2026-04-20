import {
  Mic, Music, Video, Image as ImageIcon,
  Bell, ShieldCheck, Users, Globe,
  Smartphone, Palette, Layers, Languages,
} from 'lucide-react';
import type { FeatureModule } from '../types';

export const MODULES: FeatureModule[] = [
  {
    Icon: Mic,
    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',
    name: 'Mensajes de voz',
    desc: 'Grabación en alta fidelidad con ondas de sonido visuales. Todo se procesa y guarda automáticamente en la nube.',
  },
  {
    Icon: Music,
    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',
    name: 'Música en el feed',
    desc: 'Música de fondo gratuita mientras navegas. Un reproductor inteligente que nunca interrumpe tu flujo.',
  },
  {
    Icon: Video,
    color: '#10b981', bg: 'rgba(16,185,129,0.15)',
    name: 'Videollamadas P2P',
    desc: 'Llamadas de alta calidad sin intermediarios externos, seguras y directas entre dispositivos.',
  },
  {
    Icon: ImageIcon,
    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',
    name: 'Gestión de archivos',
    desc: 'Gestión inteligente: si borras un mensaje, el sistema limpia la memoria de la nube por ti para ahorrar espacio.',
  },
  {
    Icon: Bell,
    color: '#10b981', bg: 'rgba(16,185,129,0.15)',
    name: 'Notificaciones inteligentes',
    desc: 'Cerebro centralizado que gestiona avisos específicos para cada plataforma (iOS/Android) al instante.',
  },
  {
    Icon: ShieldCheck,
    color: '#ef4444', bg: 'rgba(239,68,68,0.15)',
    name: 'Seguridad avanzada',
    desc: 'Reglas de acceso estrictas: cada usuario solo ve lo que tiene permiso de ver, validado en tiempo real.',
  },
  {
    Icon: Users,
    color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',
    name: 'Roles y jerarquías',
    desc: 'Sistema de delegados, coordinadores y roles personalizados que se adaptan a cualquier centro educativo.',
  },
  {
    Icon: Globe,
    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',
    name: 'Soporte multiidioma',
    desc: 'Presente en Mobile, Web y Desktop. Hablamos tu idioma: la plataforma se traduce y adapta por completo a tu región.',
  },
  {
    Icon: Smartphone,
    color: '#10b981', bg: 'rgba(16,185,129,0.15)',
    name: 'Gestos fluidos',
    desc: 'Navegación natural para responder mensajes al instante. Una experiencia suave sin esperas ni tirones.',
  },
  {
    Icon: Palette,
    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',
    name: 'Diseño Inteligente',
    desc: 'Legibilidad garantizada: los colores de la interfaz se ajustan para que siempre veas todo claro, sea cual sea el fondo.',
  },
  {
    Icon: Languages,
    color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',
    name: 'Arquitectura i18n',
    desc: 'Sistema de internacionalización dinámico que permite la expansión global inmediata sin cambios en el código base.',
  },
  {
    Icon: Layers,
    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',
    name: 'Optimización de carga',
    desc: 'Carga bajo demanda: la aplicación es mucho más ligera porque solo activa lo que necesitas exactamente en cada momento.',
  },
];
