import { Globe, Smartphone, Monitor } from 'lucide-react';
import type { QRLink } from '../types';

export const QR_LINKS: QRLink[] = [
  {
    Icon: Globe,
    iconColor: '#10b981',
    iconBg: 'rgba(16,185,129,0.15)',
    title: 'Versión Web',
    subtitle: 'Acceso completo desde el navegador',
    qrText: '',
    urlText: 'https://campus-hub-one-alpha.vercel.app/',
    borderColor: 'rgba(16,185,129,0.35)',
    qrImage: '/web_deploy_qr.png',
  },
  {
    Icon: Monitor,
    iconColor: '#8b5cf6',
    iconBg: 'rgba(139,92,246,0.15)',
    title: 'Versión Desktop',
    subtitle: 'Cliente nativo PC',
    qrText: '',
    urlText: 'Descarga Instaladores',
    borderColor: 'rgba(139,92,246,0.35)',
    qrImage: null,
    isDesktop: true,
  },
  {
    Icon: Smartphone,
    iconColor: '#3b82f6',
    iconBg: 'rgba(59,130,246,0.15)',
    title: 'Versión Mobile',
    subtitle: 'Descarga la app en tu dispositivo',
    qrText: '',
    urlText: 'Descarga APK / Expo Go',
    borderColor: 'rgba(59,130,246,0.35)',
    qrImage: '/assets/qr-mobile.png',
  },
];
