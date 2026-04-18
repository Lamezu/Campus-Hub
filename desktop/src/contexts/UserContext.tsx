import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { notificationService } from '@/services/notificationService';
import { checkPermission, type Permission } from '@/utils/permissions';
import type { User, UserRole, UserSubrole } from '@/types';

type UserContextType = {
  firebaseUser: FirebaseUser | null;
  userData: User | null;
  role: UserRole;
  subrole: UserSubrole | undefined;
  isTeacherOrAdmin: boolean;
  isAdmin: boolean;
  can: (permission: Permission) => boolean;
  updateUserData: (data: Partial<User>) => Promise<void>;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  firebaseUser: null,
  userData: null,
  role: 'student',
  subrole: undefined,
  isTeacherOrAdmin: false,
  isAdmin: false,
  can: () => false,
  updateUserData: async () => { },
  loading: true,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const updateUserData = useCallback(async (data: Partial<User>) => {
    if (!firebaseUser) return;
    try {
      await updateDoc(doc(db, 'users', firebaseUser.uid), {
        ...data,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }, [firebaseUser]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, fbUser => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setUserData(null);
        setLoading(false);
      }
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), snap => {
      if (snap.exists()) {
        const data = snap.data() as User;
        setUserData(data);
        notificationService.init(firebaseUser.uid);

        if (!data.role) {
          updateDoc(doc(db, 'users', firebaseUser.uid), {
            role: 'student',
            updatedAt: serverTimestamp()
          }).catch(() => { });
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('UserDoc Snapshot error:', error);
      }
      setLoading(false);
    });
    return unsubDoc;
  }, [firebaseUser?.uid]);

  const role: UserRole = userData?.role || 'student';
  const subrole: UserSubrole | undefined = userData?.subrole;

  const can = useCallback(
    (permission: Permission) => checkPermission(role, subrole, permission),
    [role, subrole]
  );

  return (
    <UserContext.Provider value={{
      firebaseUser,
      userData,
      role,
      subrole,
      isTeacherOrAdmin: role === 'teacher' || role === 'admin',
      isAdmin: role === 'admin',
      can,
      updateUserData,
      loading,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

export function useCurrentUser() {
  return useContext(UserContext);
}
