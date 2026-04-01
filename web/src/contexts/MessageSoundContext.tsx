import { useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
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

  locationRef.current = location.pathname;

  const playIfAllowed = () => {
    const mute = settingsRef.current?.globalMute ?? 'off';
    if (mute === 'off') {
      playMessageTone(settingsRef.current?.globalTone ?? 'Melodía');
    }
  };

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, user => {
      unsubsRef.current.forEach(u => u());
      unsubsRef.current = [];
      dmUnreadRef.current = {};
      channelLastMsgRef.current = {};

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
          snap.docChanges().forEach(change => {
            const data = change.doc.data();
            const count = data.unreadCount?.[user.uid] ?? 0;
            if (change.type === 'added') {
              dmUnreadRef.current[change.doc.id] = count;
            } else if (change.type === 'modified') {
              const prev = dmUnreadRef.current[change.doc.id] ?? 0;
              if (count > prev && !locationRef.current.includes(change.doc.id)) {
                playIfAllowed();
              }
              dmUnreadRef.current[change.doc.id] = count;
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
