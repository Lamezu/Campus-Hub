import {
  Smartphone, Globe, Monitor, Package,
  Lock, Database, Zap, FolderOpen,
  Image as ImageIcon, Video, Bell, Music,
} from 'lucide-react';
import type { ArchNode } from '../types';

export const CLIENTS: ArchNode[] = [
  { icon: Smartphone, name: 'Mobile',  tech: 'React Native / Expo SDK 54', color: 'blue' },
  { icon: Globe,      name: 'Web',     tech: 'React / Vite',               color: 'green' },
  { icon: Monitor,    name: 'Desktop', tech: 'Electron',                   color: 'purple' },
  { icon: Package,    name: 'shared/', tech: '10 servicios · lógica compartida entre plataformas', color: 'amber' },
];

export const FIREBASE: ArchNode[] = [
  { icon: Lock,       name: 'Auth',           tech: 'Firebase Auth',    color: 'blue' },
  { icon: Database,   name: 'Base de datos',  tech: 'Firestore',        color: 'blue' },
  { icon: Zap,        name: 'Cloud Functions', tech: 'Node.js 22 / v7', color: 'green' },
  { icon: FolderOpen, name: 'Storage',         tech: 'Firebase Storage', color: 'blue' },
];

export const EXTERNAL: ArchNode[] = [
  { icon: ImageIcon, name: 'Cloudinary', tech: 'Media CDN',          color: 'amber' },
  { icon: Video,     name: 'WebRTC',     tech: 'P2P Video/Audio',    color: 'green' },
  { icon: Bell,      name: 'FCM',        tech: 'Push Notifications', color: 'amber' },
  { icon: Music,     name: 'Jamendo',    tech: 'Music API',          color: 'purple' },
];
