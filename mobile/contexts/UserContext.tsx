import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { checkPermission } from '@/utils/permissions';
import type { User, UserRole, UserSubrole } from '@/types';
import type { Permission } from '@/utils/permissions';

type UserContextType = {
  firebaseUser: FirebaseUser | null;
  userData: User | null;
  role: UserRole;
  subrole: UserSubrole;
  isTeacherOrAdmin: boolean;
  isAdmin: boolean;
  can: (permission: Permission) => boolean;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  firebaseUser: null,
  userData: null,
  role: 'student',
  subrole: null,
  isTeacherOrAdmin: false,
  isAdmin: false,
  can: () => false,
  loading: true,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

        if (!data.role) {
          import('firebase/firestore').then(({ updateDoc }) => {
            updateDoc(doc(db, 'users', firebaseUser.uid), {
              role: 'student',
              updatedAt: serverTimestamp()
            }).catch(() => { });
          });
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('UserDoc Snapshot error:', error);
      }
    });
    return unsubDoc;
  }, [firebaseUser?.uid]);

  const role: UserRole = userData?.role || 'student';
  const subrole: UserSubrole = userData?.subrole ?? null;

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
      loading,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  return useContext(UserContext);
}
