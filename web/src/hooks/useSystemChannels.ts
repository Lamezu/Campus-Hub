import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useTranslation } from './useTranslation';
import type { Channel } from '../types';

export const SYSTEM_CHANNEL_IDS = ['1', '2', '3', '4'] as const;

const CHANNEL_DEFAULTS: Record<string, {
  nameKey: string; descKey: string; icon: string; type: Channel['type'];
}> = {
  '1': { nameKey: 'channels.general.name',       descKey: 'channels.general.description',       icon: 'messages-square',        type: 'public' },
  '2': { nameKey: 'channels.announcements.name',  descKey: 'channels.announcements.description', icon: 'megaphone',              type: 'announcement' },
  '3': { nameKey: 'channels.events.name',         descKey: 'channels.events.description',        icon: 'calendar-fold',          type: 'public' },
  '4': { nameKey: 'channels.support.name',        descKey: 'channels.support.description',       icon: 'message-circle-question',type: 'public' },
};

export function useSystemChannels(): Channel[] {
  const { t } = useTranslation();

  const [overrides, setOverrides] = useState<Record<string, Partial<Channel>>>({});

  useEffect(() => {
    const unsubs = SYSTEM_CHANNEL_IDS.map(id =>
      onSnapshot(doc(db, 'channels', id), snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        setOverrides(prev => ({
          ...prev,
          [id]: {
            photoURL: data.photoURL ?? null,
            memberCount: data.memberCount ?? 0,
            lastMessageAt: data.lastMessageAt ?? null,
            nameKey: data.nameKey ?? CHANNEL_DEFAULTS[id].nameKey,
            descKey: data.descKey ?? CHANNEL_DEFAULTS[id].descKey,
            icon: data.icon ?? CHANNEL_DEFAULTS[id].icon,
            type: data.type ?? CHANNEL_DEFAULTS[id].type,
          },
        }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, []);

  return SYSTEM_CHANNEL_IDS.map(id => {
    const def = CHANNEL_DEFAULTS[id];
    const ov = overrides[id] ?? {};
    const nameKey = (ov.nameKey as string | undefined) ?? def.nameKey;
    const descKey = (ov.descKey as string | undefined) ?? def.descKey;
    return {
      id,
      name: t(nameKey),
      description: t(descKey),
      type: ov.type ?? def.type,
      icon: ov.icon ?? def.icon,
      createdBy: 'system',
      createdAt: new Date('2026-01-01').toISOString(),
      memberCount: ov.memberCount ?? 0,
      lastMessageAt: ov.lastMessageAt ?? null,
      departmentRestricted: false,
      allowedDepartments: [],
      photoURL: ov.photoURL ?? null,
    } as Channel;
  });
}
