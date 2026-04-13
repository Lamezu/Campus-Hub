import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const CHANNEL_SEED: Record<string, object> = {
  '1': {
    name: 'General',
    nameKey: 'channels.general.name',
    description: 'Canal general para todos los miembros del campus',
    descKey: 'channels.general.description',
    type: 'public',
    icon: 'messages-square',
    createdBy: 'system',
    createdAt: new Date('2026-01-01').toISOString(),
    memberCount: 0,
    departmentRestricted: false,
    allowedDepartments: [],
  },
  '2': {
    name: 'Anuncios Oficiales',
    nameKey: 'channels.announcements.name',
    description: 'Comunicados oficiales del campus',
    descKey: 'channels.announcements.description',
    type: 'announcement',
    icon: 'megaphone',
    createdBy: 'system',
    createdAt: new Date('2026-01-01').toISOString(),
    memberCount: 0,
    departmentRestricted: false,
    allowedDepartments: [],
  },
  '3': {
    name: 'Eventos y Actividades',
    nameKey: 'channels.events.name',
    description: 'Próximos eventos y actividades del campus',
    descKey: 'channels.events.description',
    type: 'public',
    icon: 'calendar-fold',
    createdBy: 'system',
    createdAt: new Date('2026-01-01').toISOString(),
    memberCount: 0,
    departmentRestricted: false,
    allowedDepartments: [],
  },
  '4': {
    name: 'Ayuda y Soporte',
    nameKey: 'channels.support.name',
    description: 'Soporte técnico y ayuda al usuario',
    descKey: 'channels.support.description',
    type: 'public',
    icon: 'message-circle-question',
    createdBy: 'system',
    createdAt: new Date('2026-01-01').toISOString(),
    memberCount: 0,
    departmentRestricted: false,
    allowedDepartments: [],
  },
};

/** Creates system channels in Firestore if they don't exist yet. Safe to call multiple times. */
export async function seedSystemChannels(): Promise<void> {
  await Promise.all(
    Object.entries(CHANNEL_SEED).map(async ([id, data]) => {
      const ref = doc(db, 'channels', id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, data);
      }
    })
  );
}
