import { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, serverTimestamp, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useCurrentUser } from '../../contexts/UserContext';
import { notificationService } from '../../services/notificationService';
import type { StudyGroup, User } from '../../types';
import { Alert } from 'react-native';

export function useStudyGroups() {
    const currentUser = auth.currentUser;
    const { isAdmin } = useCurrentUser();
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
        }, (error) => {
            if (error.code !== 'permission-denied') {
                console.error('StudyGroups Snapshot error:', error);
            }
        });

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
        // Notify the group creator
        if (group && group.createdBy && group.createdBy !== currentUser.uid) {
            const myName = currentUser.displayName ?? 'Alguien';
            notificationService.addNotification(group.createdBy, {
                category: 'campus',
                title: 'Nuevo miembro en tu grupo',
                body: `${myName} se unió a "${group.name}"`,
                meta: { groupId },
            }).catch(() => {});
        }
    };

    const leaveGroup = async (groupId: string) => {
        if (!currentUser) return;
        return new Promise<void>((resolve) => {
            Alert.alert('Salir del grupo', '¿Seguro que quieres salir?', [
                { text: 'Cancelar', style: 'cancel', onPress: () => resolve() },
                {
                    text: 'Salir', style: 'destructive', onPress: async () => {
                        const groupRef = doc(db, 'studyGroups', groupId);
                        const group = groups.find(g => g.id === groupId);
                        await updateDoc(groupRef, {
                            memberIds: arrayRemove(currentUser.uid),
                            memberCount: Math.max(0, (group?.memberCount ?? 1) - 1),
                        });
                        resolve();
                    }
                },
            ]);
        });
    };

    const createGroup = async (form: any) => {
        if (!currentUser) return;
        const docRef = await addDoc(collection(db, 'studyGroups'), {
            ...form,
            createdBy: currentUser.uid,
            createdByName: currentUser.displayName ?? '',
            memberIds: [currentUser.uid, ...(form.invitedUserIds || [])],
            memberCount: 1 + (form.invitedUserIds?.length ?? 0),
            createdAt: serverTimestamp(),
        });
        // Notify invited members
        const invited: string[] = form.invitedUserIds ?? [];
        if (invited.length > 0) {
            const myName = currentUser.displayName ?? 'Alguien';
            invited.forEach(uid => {
                notificationService.addNotification(uid, {
                    category: 'campus',
                    title: 'Te añadieron a un grupo de estudio',
                    body: `${myName} te añadió a "${form.name}"`,
                    meta: { groupId: docRef.id },
                }).catch(() => {});
            });
        }
    };

    const updateGroup = async (groupId: string, form: any) => {
        await updateDoc(doc(db, 'studyGroups', groupId), {
            ...form,
            updatedAt: serverTimestamp(),
        });
    };

    const deleteGroup = async (groupId: string) => {
        return new Promise<void>((resolve) => {
            Alert.alert('Eliminar grupo', '¿Seguro que quieres borrar este grupo?', [
                { text: 'Cancelar', style: 'cancel', onPress: () => resolve() },
                {
                    text: 'Borrar', style: 'destructive', onPress: async () => {
                        await deleteDoc(doc(db, 'studyGroups', groupId));
                        resolve();
                    }
                },
            ]);
        });
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

    return {
        groups,
        allUsers,
        loadingUsers,
        joinGroup,
        leaveGroup,
        createGroup,
        updateGroup,
        deleteGroup,
        loadUsers,
    };
}
