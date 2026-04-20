import type { TeamMember } from '../types';

export const TEAM: TeamMember[] = [
  {
    initial: 'A',
    name: 'Alejandro Mejías',
    role: 'Mobile Lead · Arquitectura UI/UX',
    roleColor: '#3b82f6',
    gradient: 'linear-gradient(135deg,#1A3A6B,#3b82f6)',
    avatarGradient: 'linear-gradient(135deg,#1A3A6B,#3b82f6)',
    stack: 'React Native · Expo SDK 54\nFirebase · Expo Router\nArquitectura & CI/CD',
    chips: [
      { label: 'React Native', color: 'blue' },
      { label: 'Expo SDK 54', color: 'blue' },
      { label: 'TypeScript', color: 'blue' },
    ],
    highlights: ['App iOS & Android', 'Diseño del sistema', 'Módulo shared/'],
  },
  {
    initial: 'S',
    name: 'Sara Alonso',
    role: 'Web Lead · Sistema de llamadas WebRTC',
    roleColor: '#10b981',
    gradient: 'linear-gradient(135deg,#065f46,#10b981)',
    avatarGradient: 'linear-gradient(135deg,#E87C1E,#f97316)',
    stack: 'React · Vite\nWebRTC · CSS avanzado\nDiseño UI / UX',
    chips: [
      { label: 'React', color: 'green' },
      { label: 'WebRTC', color: 'green' },
      { label: 'Document PiP', color: 'green' },
    ],
    highlights: ['Videollamadas P2P', 'Mesh grupal', 'Document Picture-in-Picture'],
  },
  {
    initial: 'S',
    name: 'Samuel Morán',
    role: 'Backend & Desktop Lead · Cloud Functions',
    roleColor: '#8b5cf6',
    gradient: 'linear-gradient(135deg,#4c1d95,#8b5cf6)',
    avatarGradient: 'linear-gradient(135deg,#1e3a8a,#1A3A6B)',
    stack: 'Electron · Node.js\nFirebase Cloud Functions\nFirestore Rules & Admin',
    chips: [
      { label: 'Electron', color: 'purple' },
      { label: 'Cloud Functions', color: 'purple' },
      { label: 'Firestore Rules', color: 'purple' },
    ],
    highlights: ['22 Cloud Functions', 'Seguridad y Roles RBAC', 'Panel de admin'],
  },
];
