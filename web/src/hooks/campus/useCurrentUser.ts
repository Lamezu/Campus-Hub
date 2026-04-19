import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import type { UserRole, UserSubrole } from '../../types';
import { checkPermission, allowedEventTypes } from '../../utils/permissions';
import type { Permission } from '../../utils/permissions';
import type { CalendarEventType } from '../../types';

interface CurrentUserData {
  role: UserRole;
  subrole: UserSubrole;
  department: string | null;
  isAdmin: boolean;
  can: (permission: Permission) => boolean;
  eventTypes: CalendarEventType[];
}

export function useCurrentUser(): CurrentUserData {
  const [role, setRole] = useState<UserRole>('student');
  const [subrole, setSubrole] = useState<UserSubrole>(null);
  const [department, setDepartment] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRole((data.role as UserRole) ?? 'student');
        setSubrole((data.subrole as UserSubrole) ?? null);
        setDepartment(data.department ?? null);
      }
    });
    return unsub;
  }, []);

  const can = (permission: Permission) => checkPermission(role, subrole, permission);
  const eventTypes = allowedEventTypes(role, subrole);

  return { role, subrole, department, isAdmin: role === 'admin', can, eventTypes };
}
