import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  increment,
  writeBatch,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface Channel {
  id: string;
  name: string;
  description: string;
  type: 'public' | 'private' | 'announcement';
  createdBy: string;
  createdAt: Timestamp;
  memberCount: number;
  lastMessageAt: Timestamp | null;
  departmentRestricted: boolean;
  allowedDepartments: string[];
}

export interface ChannelMember {
  userId: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt: Timestamp;
  lastRead: Timestamp;
  notifications: boolean;
}

export interface ChannelWithMemberInfo extends Channel {
  memberInfo?: ChannelMember;
}

export const createChannel = async (
  channelData: Omit<Channel, 'id' | 'createdAt' | 'memberCount' | 'lastMessageAt'>,
  creatorId: string
): Promise<string> => {
  const channelRef = doc(collection(db, 'channels'));
  const channelId = channelRef.id;
  
  const batch = writeBatch(db);
  
  batch.set(channelRef, {
    ...channelData,
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    memberCount: 1,
    lastMessageAt: null
  });
  
  const memberRef = doc(db, 'channels', channelId, 'members', creatorId);
  batch.set(memberRef, {
    userId: creatorId,
    role: 'admin',
    joinedAt: serverTimestamp(),
    lastRead: serverTimestamp(),
    notifications: true
  });
  
  await batch.commit();
  return channelId;
};

export const getChannel = async (channelId: string): Promise<Channel | null> => {
  const channelRef = doc(db, 'channels', channelId);
  const channelSnap = await getDoc(channelRef);
  
  if (channelSnap.exists()) {
    return { 
      id: channelSnap.id, 
      ...channelSnap.data() 
    } as Channel;
  }
  
  return null;
};

export const getUserChannels = async (userId: string): Promise<ChannelWithMemberInfo[]> => {
  const channelsSnapshot = await getDocs(collection(db, 'channels'));
  const userChannels: ChannelWithMemberInfo[] = [];
  
  for (const channelDoc of channelsSnapshot.docs) {
    const memberRef = doc(db, 'channels', channelDoc.id, 'members', userId);
    const memberSnap = await getDoc(memberRef);
    
    if (memberSnap.exists()) {
      userChannels.push({
        id: channelDoc.id,
        ...channelDoc.data() as Omit<Channel, 'id'>,
        memberInfo: memberSnap.data() as ChannelMember
      });
    }
  }
  
  return userChannels.sort((a, b) => {
    if (!a.lastMessageAt) return 1;
    if (!b.lastMessageAt) return -1;
    return b.lastMessageAt.toMillis() - a.lastMessageAt.toMillis();
  });
};

export const updateChannel = async (
  channelId: string,
  updates: Partial<Omit<Channel, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> => {
  const channelRef = doc(db, 'channels', channelId);
  await updateDoc(channelRef, updates);
};

export const deleteChannel = async (channelId: string): Promise<void> => {
  const channelRef = doc(db, 'channels', channelId);
  
  await deleteDoc(channelRef);
};

export const joinChannel = async (
  channelId: string, 
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  const memberRef = doc(db, 'channels', channelId, 'members', userId);
  batch.set(memberRef, {
    userId,
    role: 'member',
    joinedAt: serverTimestamp(),
    lastRead: serverTimestamp(),
    notifications: true
  });
  
  const channelRef = doc(db, 'channels', channelId);
  batch.update(channelRef, {
    memberCount: increment(1)
  });
  
  await batch.commit();
};

export const leaveChannel = async (
  channelId: string, 
  userId: string
): Promise<void> => {
  const batch = writeBatch(db);
  
  const memberRef = doc(db, 'channels', channelId, 'members', userId);
  batch.delete(memberRef);
  
  const channelRef = doc(db, 'channels', channelId);
  batch.update(channelRef, {
    memberCount: increment(-1)
  });
  
  await batch.commit();
};

export const getChannelMembers = async (channelId: string): Promise<ChannelMember[]> => {
  const membersSnapshot = await getDocs(
    collection(db, 'channels', channelId, 'members')
  );
  
  return membersSnapshot.docs.map(doc => doc.data() as ChannelMember);
};

export const updateMemberRole = async (
  channelId: string,
  userId: string,
  newRole: 'member' | 'moderator' | 'admin'
): Promise<void> => {
  const memberRef = doc(db, 'channels', channelId, 'members', userId);
  await updateDoc(memberRef, { role: newRole });
};

export const subscribeToUserChannels = (
  userId: string,
  callback: (channels: ChannelWithMemberInfo[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'channels'),
    orderBy('lastMessageAt', 'desc')
  );
  
  return onSnapshot(q, async (snapshot) => {
    const channels: ChannelWithMemberInfo[] = [];
    
    for (const channelDoc of snapshot.docs) {
      const memberRef = doc(db, 'channels', channelDoc.id, 'members', userId);
      const memberSnap = await getDoc(memberRef);
      
      if (memberSnap.exists()) {
        channels.push({
          id: channelDoc.id,
          ...channelDoc.data() as Omit<Channel, 'id'>,
          memberInfo: memberSnap.data() as ChannelMember
        });
      }
    }
    
    callback(channels);
  });
};

export const subscribeToChannel = (
  channelId: string,
  callback: (channel: Channel | null) => void
): Unsubscribe => {
  const channelRef = doc(db, 'channels', channelId);
  
  return onSnapshot(channelRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as Channel);
    } else {
      callback(null);
    }
  });
};