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
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../config/firebase';

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
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    uid: userId,
    ...userData,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp()
  });
};

export const getUser = async (userId: string): Promise<User | null> => {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? (userSnap.data() as User) : null;
};

export const updateUser = async (
  userId: string, 
  updates: Partial<Omit<User, 'uid' | 'createdAt'>>
): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...updates,
    lastActive: serverTimestamp()
  });
};

export const deleteUser = async (userId: string): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await deleteDoc(userRef);
};

export const getUserRole = async (userId: string): Promise<string> => {
  const user = await getUser(userId);
  return user?.role || 'student';
};

export const getRolePermissions = async (roleName: string): Promise<RolePermissions> => {
  const roleRef = doc(db, 'roles', roleName);
  const roleSnap = await getDoc(roleRef);
  
  if (roleSnap.exists()) {
    return roleSnap.data().permissions as RolePermissions;
  }
  
  return {
    canCreateChannels: false,
    canDeleteMessages: false,
    canManageUsers: false,
    canSendAnnouncements: false
  };
};

export const subscribeToUser = (
  userId: string, 
  callback: (user: User | null) => void
): Unsubscribe => {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(userRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.data() as User) : null);
  });
};

export const subscribeToUsersByRole = (
  role: string,
  callback: (users: User[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'users'),
    where('role', '==', role),
    orderBy('displayName', 'asc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => doc.data() as User);
    callback(users);
  });
};