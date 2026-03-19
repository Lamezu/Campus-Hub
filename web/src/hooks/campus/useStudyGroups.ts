import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, serverTimestamp, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import type { StudyGroup, User } from '../../types';

export function useStudyGroups(isAdmin: boolean) {
  const currentUser = auth.currentUser;
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'studyGroups'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snap => {
      const uid = currentUser?.uid ?? '';
      setGroups(snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name ?? '',
            description: data.description ?? '',
            subject: data.subject ?? '',
            createdBy: data.createdBy ?? '',
            createdByName: data.createdByName ?? '',
            memberIds: data.memberIds ?? [],
            memberCount: data.memberCount ?? 0,
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : new Date().toISOString(),
            color: data.color ?? '#007AFF',
            isPrivate: data.isPrivate ?? false,
            allowedRoles: data.allowedRoles ?? [],
            invitedUserIds: data.invitedUserIds ?? [],
          } as StudyGroup;
        })
        .filter(g => isAdmin || !g.isPrivate || g.memberIds.includes(uid))
      );
    }, () => {});

    return unsubscribe;
  }, [isAdmin, currentUser?.uid]);

  const joinGroup = async (groupId: string) => {
    if (!currentUser) return;
    const groupRef = doc(db, 'studyGroups', groupId);
    const group = groups.find(g => g.id === groupId);
    await updateDoc(groupRef, {
      memberIds: arrayUnion(currentUser.uid),
      memberCount: (group?.memberCount ?? 0) + 1,
    });
  };

  const leaveGroup = async (groupId: string) => {
    if (!currentUser) return;
    if (!window.confirm('¿Seguro que quieres salir del grupo?')) return;
    const groupRef = doc(db, 'studyGroups', groupId);
    const group = groups.find(g => g.id === groupId);
    await updateDoc(groupRef, {
      memberIds: arrayRemove(currentUser.uid),
      memberCount: Math.max(0, (group?.memberCount ?? 1) - 1),
    });
  };

  const createGroup = async (form: {
    name: string;
    description: string;
    subject: string;
    color: string;
    isPrivate: boolean;
    allowedRoles: string[];
    invitedUserIds: string[];
  }) => {
    if (!currentUser) return;
    await addDoc(collection(db, 'studyGroups'), {
      ...form,
      createdBy: currentUser.uid,
      createdByName: currentUser.displayName ?? '',
      memberIds: [currentUser.uid, ...(form.invitedUserIds || [])],
      memberCount: 1 + (form.invitedUserIds?.length ?? 0),
      createdAt: serverTimestamp(),
    });
  };

  const updateGroup = async (groupId: string, form: object) => {
    await updateDoc(doc(db, 'studyGroups', groupId), {
      ...form,
      updatedAt: serverTimestamp(),
    });
  };

  const deleteGroup = async (groupId: string) => {
    if (window.confirm('¿Seguro que quieres borrar este grupo?')) {
      await deleteDoc(doc(db, 'studyGroups', groupId));
    }
  };

  const loadUsers = async () => {
    if (allUsers.length > 0 || loadingUsers) return;
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const users = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as User))
        .filter(u => u.uid !== currentUser?.uid);
      setAllUsers(users);
    } finally {
      setLoadingUsers(false);
    }
  };

  return { groups, allUsers, loadingUsers, joinGroup, leaveGroup, createGroup, updateGroup, deleteGroup, loadUsers };
}
