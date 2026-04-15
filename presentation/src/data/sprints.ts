import type { Sprint } from '../types';

export const SPRINTS: Sprint[] = [
  {
    num: 'Sprint 0',
    text: 'Preparación y Entorno',
    tags: [
      { label: 'Trello', color: '#3b82f6' },
      { label: 'Firebase', color: '#10b981' },
      { label: 'Init', color: '#6b7280' },
    ],
    details: 'Configuración de tableros Trello, entorno local y despliegue inicial de Firebase. Definición de la estructura de carpetas multiplataforma (Mobile/Web/Functions) y primera conexión exitosa con Firestore.'
  },
  {
    num: 'Sprint 1',
    text: 'Cimientos y Autenticación',
    tags: [
      { label: 'Auth', color: '#3b82f6' },
      { label: 'Styles', color: '#f59e0b' },
      { label: 'OAuth', color: '#ef4444' },
    ],
    details: 'Desarrollo del sistema de estilos centralizado y pantallas base de Auth. Implementación de Google Sign-In con resolución de Redirect URIs y maquetación de la Home por canales.'
  },
  {
    num: 'Sprint 2',
    text: 'MVP de Mensajería',
    tags: [
      { label: 'Cloud', color: '#10b981' },
      { label: 'Chat', color: '#3b82f6' },
      { label: 'Realtime', color: '#8b5cf6' },
    ],
    details: 'Implementación de chat en tiempo real con Firestore Listeners. Refactorización a servicios compartidos, gestión de teclado (KeyboardAvoidingView) y sistema de 5 pestañas de navegación.'
  },
  {
    num: 'Sprint 3',
    text: 'Social & Multimedia',
    tags: [
      { label: 'Multimedia', color: '#f59e0b' },
      { label: 'Voice', color: '#10b981' },
      { label: 'Theming', color: '#8b5cf6' },
    ],
    details: 'Lanzamiento del Tablón Social (Explore), integración de Cloudinary para fotos/perfil y Jamendo API para música. Sistema de 10 temas de chat, mensajes de voz con waveform y notificaciones push iniciales.'
  },
  {
    num: 'Sprint 4',
    text: 'Conectividad Total',
    tags: [
      { label: 'WebRTC', color: '#ef4444' },
      { label: 'Friends', color: '#3b82f6' },
      { label: 'DMs', color: '#8b5cf6' },
    ],
    details: 'Desarrollo de mensajería directa 1-on-1, sistema de amigos y videollamadas tipo Discord. Introducción del calendario de eventos para profesores y lanzamiento de la base para la app Desktop.'
  },
  {
    num: 'Sprint 5',
    text: 'Pulido y Ecosistema',
    tags: [
      { label: 'i18n', color: '#10b981' },
      { label: 'Sync', color: '#f59e0b' },
      { label: 'UX', color: '#ef4444' },
    ],
    details: 'Migración a RNGH v2 para gestos premium. Videoconferencias grupales, sistema de tickets de soporte e i18n completa (ES/EN). Sincronización bidireccional entre Eventos y el Feed Social.'
  },
  {
    num: 'Sprint 6',
    text: 'Entrega y Despliegue',
    tags: [
      { label: 'Deploy', color: '#10b981' },
      { label: 'Build', color: '#3b82f6' },
      { label: 'Final', color: '#ef4444' },
    ],
    details: 'Generación de builds de producción para iOS/Android y despliegue final en dominios reales para Web y Desktop. Preparación de la defensa técnica, documentación de APIs y presentación final del proyecto.'
  },
];

export const PLANNING_METRICS = [
  { label: 'Metodología', val: 'Scrum Iterativo' },
  { label: 'Ciclos', val: '7 Sprints' },
  { label: 'Duración total', val: '4 meses' },
  { label: 'Lanzamiento final', val: '16 mayo 2026' },
];
