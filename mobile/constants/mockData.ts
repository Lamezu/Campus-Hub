export interface Channel {
  id: string;
  name: string;
  description: string;
  icon: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
}

export const MOCK_CHANNELS: Channel[] = [
  {
    id: '1',
    name: 'General',
    description: 'Canal general para todos',
    icon: '💬',
    unreadCount: 3,
    lastMessage: 'Hola a todos!',
    lastMessageTime: '10:30',
  },
  {
    id: '2',
    name: 'Programación',
    description: 'Dudas y recursos de código',
    icon: '💻',
    unreadCount: 0,
    lastMessage: 'Alguien tiene el enlace del repo?',
    lastMessageTime: 'Ayer',
  },
  {
    id: '3',
    name: 'Proyectos',
    description: 'Coordinación de proyectos',
    icon: '📁',
    unreadCount: 5,
    lastMessage: 'Reunión mañana a las 10',
    lastMessageTime: '15:45',
  },
  {
    id: '4',
    name: 'Eventos',
    description: 'Eventos y actividades',
    icon: '🎉',
    unreadCount: 1,
    lastMessage: 'Hackathon este fin de semana',
    lastMessageTime: '2d',
  },
  {
    id: '5',
    name: 'Ayuda',
    description: 'Soporte y asistencia',
    icon: '❓',
    unreadCount: 0,
    lastMessage: 'Gracias por la ayuda!',
    lastMessageTime: '3d',
  },
];