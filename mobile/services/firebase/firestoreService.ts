import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import type { Timestamp, Unsubscribe } from 'firebase/firestore';
import { authService } from '../shared';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: 'student' | 'teacher' | 'admin';
  department: string | null;
  createdAt: Timestamp;
  lastActive: Timestamp;
  fcmToken: string | null;
}

export interface RolePermissions {
  canCreateChannels: boolean;
  canDeleteMessages: boolean;
  canManageUsers: boolean;
  canSendAnnouncements: boolean;
}

export const createUser = async (
  userId: string,
  userData: Omit<User, 'uid' | 'createdAt' | 'lastActive'>
): Promise<void> => {
  await (authService as any).updateLastActive(userId);
};

export const getUser = async (userId: string): Promise<User | null> => {
  const data = await authService.getUserData(userId);
  return data as User | null;
};

export const updateUser = async (
  userId: string,
  updates: Partial<Omit<User, 'uid' | 'createdAt'>>
): Promise<void> => {
  await (authService as any).updateLastActive(userId);
};

export const deleteUser = async (userId: string): Promise<void> => {
};

export const getUserRole = async (userId: string): Promise<string> => {
  const user = await getUser(userId);
  return user?.role || 'student';
};

export const subscribeToUser = (
  userId: string,
  callback: (user: User | null) => void
): Unsubscribe => {
  return onSnapshot(doc(db, 'users', userId), (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as User) : null);
  });
};
