import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { playMessageTone } from '../utils/toneGenerator';

export function MessageSoundProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  const userIdRef = useRef<string | null>(null);
  const settingsRef = useRef<any>({});
  const dmUnreadRef = useRef<Record<string, number>>({});
  const channelLastMsgRef = useRef<Record<string, string>>({});
  const unsubsRef = useRef<(() => void)[]>([]);
  const dmContactCacheRef = useRef<Record<string, { otherId: string; alertTone?: string; mute?: string }>>({});

  locationRef.current = location.pathname;

  const playIfAllowed = (conversationId?: string) => {
    const globalMute = settingsRef.current?.globalMute ?? 'off';
    const globalTone = settingsRef.current?.globalTone ?? 'Melodía';

    if (conversationId) {
      const contact = dmContactCacheRef.current[conversationId];
      if (contact) {
        if (contact.mute === 'always') return;
        if (contact.alertTone && contact.alertTone !== 'Predeterminado') {
          playMessageTone(contact.alertTone);
          return;
        }
      }
    }

    if (globalMute !== 'off') return;
    playMessageTone(globalTone);
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, user => {
      unsubsRef.current.forEach(u => u());
      unsubsRef.current = [];
      dmUnreadRef.current = {};
      channelLastMsgRef.current = {};
      dmContactCacheRef.current = {};

      if (!user) {
        userIdRef.current = null;
        return;
      }

      userIdRef.current = user.uid;

      const settingsUnsub = onSnapshot(doc(db, 'users', user.uid), snap => {
        settingsRef.current = snap.data()?.settings ?? {};
      });
      unsubsRef.current.push(settingsUnsub);

      const dmUnsub = onSnapshot(
        query(collection(db, 'conversations'), where('participants', 'array-contains', user.uid)),
        snap => {
          snap.docChanges().forEach(async change => {
            const data = change.doc.data();
            const convId = change.doc.id;
            const count = data.unreadCount?.[user.uid] ?? 0;

            if (change.type === 'added') {
              dmUnreadRef.current[convId] = count;
              const otherId = (data.participants as string[] | undefined)?.find(id => id !== user.uid);
              if (otherId) {
                try {
                  const csSnap = await getDoc(doc(db, 'users', user.uid, 'contactSettings', otherId));
                  const cs = csSnap.exists() ? csSnap.data() : {};
                  dmContactCacheRef.current[convId] = { otherId, alertTone: cs.alertTone, mute: cs.mute };
                } catch {
                  dmContactCacheRef.current[convId] = { otherId };
                }
              }
            } else if (change.type === 'modified') {
              const prev = dmUnreadRef.current[convId] ?? 0;
              const hasNewMsg = count > prev && !locationRef.current.includes(convId);

              const otherId = dmContactCacheRef.current[convId]?.otherId
                ?? (data.participants as string[] | undefined)?.find(id => id !== user.uid);

              if (otherId) {
                getDoc(doc(db, 'users', user.uid, 'contactSettings', otherId))
                  .then(csSnap => {
                    const cs = csSnap.exists() ? csSnap.data() : {};
                    dmContactCacheRef.current[convId] = { otherId, alertTone: cs.alertTone, mute: cs.mute };
                    if (hasNewMsg) playIfAllowed(convId);
                  })
                  .catch(() => {
                    if (hasNewMsg) playIfAllowed(convId);
                  });
              } else if (hasNewMsg) {
                playIfAllowed(convId);
              }

              dmUnreadRef.current[convId] = count;
            }
          });
        }
      );
      unsubsRef.current.push(dmUnsub);

      const channelListUnsub = onSnapshot(
        query(collection(db, 'channels'), where('memberIds', 'array-contains', user.uid)),
        channelSnap => {
          channelSnap.docChanges().forEach(change => {
            if (change.type !== 'added') return;
            const channelId = change.doc.id;
            if (channelLastMsgRef.current[channelId] !== undefined) return;

            let firstLoad = true;
            const msgUnsub = onSnapshot(
              query(
                collection(db, 'channels', channelId, 'messages'),
                orderBy('createdAt', 'desc'),
                limit(1)
              ),
              msgSnap => {
                if (msgSnap.empty) { firstLoad = false; return; }
                const msg = msgSnap.docs[0];
                if (firstLoad) {
                  channelLastMsgRef.current[channelId] = msg.id;
                  firstLoad = false;
                  return;
                }
                if (
                  msg.id !== channelLastMsgRef.current[channelId] &&
                  msg.data().senderId !== userIdRef.current &&
                  !locationRef.current.includes(channelId)
                ) {
                  playIfAllowed();
                }
                channelLastMsgRef.current[channelId] = msg.id;
              }
            );
            unsubsRef.current.push(msgUnsub);
          });
        }
      );
      unsubsRef.current.push(channelListUnsub);
    });

    return () => {
      unsubAuth();
      unsubsRef.current.forEach(u => u());
    };
  }, []);

  return children;
}
