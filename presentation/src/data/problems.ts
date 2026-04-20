import { Mail, Heart, Bell } from 'lucide-react';
import type { ProblemCard } from '../types';

export const PROBLEMS: ProblemCard[] = [
  {
    Icon: Mail,
    colorClass: 'red',
    iconColor: '#ef4444',
    title: 'Comunicación fragmentada',
    desc: 'El campus virtual presenta caídas frecuentes y su mensajería no envía notificaciones externas. Los correos se pierden entre spam. La información crítica no llega a tiempo.',
    image: '/assets/problem-1.png',
  },
  {
    Icon: Heart,
    colorClass: 'amber',
    iconColor: '#f59e0b',
    title: 'Sin espacios de apoyo digital',
    desc: 'No existe un canal digital seguro donde el alumnado pueda pedir ayuda de forma discreta. El departamento de orientación es invisible digitalmente para la mayoría del alumnado.',
    image: '/assets/problem-2.png',
  },
  {
    Icon: Bell,
    colorClass: 'purple',
    iconColor: '#8b5cf6',
    title: 'Avisos que no llegan',
    desc: 'Eventos, becas, cambios de horario. Solo disponibles en la web del centro, sin notificaciones y sin posibilidad de suscripción.',
    image: '/assets/problem-3.png',
  },
];
