import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  subscribeToReceivedRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  type FriendRequest
} from '../services/firebase/friendsService';

interface NotificationsContextType {
  pendingRequests: FriendRequest[];
  requestSenders: Record<string, any>;
  acceptRequest: (req: FriendRequest) => Promise<void>;
  rejectRequest: (req: FriendRequest) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType>({
  pendingRequests: [],
  requestSenders: {},
  acceptRequest: async () => {},
  rejectRequest: async () => {}
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [requestSenders, setRequestSenders] = useState<Record<string, any>>({});
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setUserId(user?.uid || null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToReceivedRequests(userId, async (reqs) => {
      setPendingRequests(reqs);
      const senders: Record<string, any> = {};
      await Promise.all(reqs.map(async r => {
        const snap = await getDoc(doc(db, 'users', r.fromUserId));
        if (snap.exists()) senders[r.fromUserId] = snap.data();
      }));
      setRequestSenders(senders);
    });
    return unsub;
  }, [userId]);

  const acceptRequest = async (req: FriendRequest) => {
    await acceptFriendRequest(req.id);
  };

  const rejectRequest = async (req: FriendRequest) => {
    await rejectFriendRequest(req.id);
  };

  return (
    <NotificationsContext.Provider value={{ pendingRequests, requestSenders, acceptRequest, rejectRequest }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);
