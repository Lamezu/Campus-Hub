import { useState, useEffect } from 'react';
import { groupsService } from '../../services/shared';
import { auth } from '../../config/firebase';
import { useCurrentUser } from '../../contexts/UserContext';
import { useTranslation } from '../../hooks/useTranslation';
import { notificationService } from '../../services/notificationService';
import type { StudyGroup, User } from '../../types';
import { Alert } from 'react-native';

export function useStudyGroups() {
    const currentUser = auth.currentUser;
    const { isAdmin } = useCurrentUser();
    const { t } = useTranslation();
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    useEffect(() => {
        const unsubscribe = groupsService.subscribeToGroups((newGroups: any[]) => {
            const uid = currentUser?.uid ?? '';
            setGroups(newGroups
                .map(data => ({
                    id: data.id,
                    name: data.name ?? '',
                    description: data.description ?? '',
                    subject: data.subject ?? '',
                    createdBy: data.createdBy ?? '',
                    createdByName: data.createdByName ?? '',
                    memberIds: data.memberIds ?? [],
                    memberCount: data.memberCount ?? 0,
                    createdAt: (data.createdAt as any)?.toDate?.()?.toISOString() ?? new Date().toISOString(),
                    color: data.color ?? '#007AFF',
                    isPrivate: data.isPrivate ?? false,
                    allowedRoles: data.allowedRoles ?? [],
                    invitedUserIds: data.invitedUserIds ?? [],
                } as StudyGroup))
                .filter(g => isAdmin || !g.isPrivate || g.memberIds.includes(uid))
            );
        });

        return typeof unsubscribe === 'function' ? unsubscribe : () => { };
    }, [isAdmin, currentUser?.uid]);

    const joinGroup = async (groupId: string) => {
        if (!currentUser) return;
        const group = groups.find(g => g.id === groupId);
        await groupsService.joinGroup(groupId, currentUser.uid);

        if (group && group.createdBy && group.createdBy !== currentUser.uid) {
            const myName = currentUser.displayName ?? 'Alguien';
            notificationService.addNotification(group.createdBy, {
                category: 'campus',
                title: t('explore.groups.notifications.new_member_title') || 'Nuevo miembro en tu grupo',
                body: t('explore.groups.notifications.new_member_body', { name: myName, groupName: group.name }) || `${myName} se unió a "${group.name}"`,
                meta: { groupId },
            }).catch(() => { });
        }
    };

    const leaveGroup = async (groupId: string) => {
        if (!currentUser) return;
        return new Promise<void>((resolve) => {
            Alert.alert(
                t('explore.groups.alerts.leave_title') || 'Salir del grupo',
                t('explore.groups.alerts.leave_subtitle') || '¿Seguro que quieres salir?',
                [
                    { text: t('common.cancel') || 'Cancelar', style: 'cancel', onPress: () => resolve() },
                    {
                        text: t('common.leave') || 'Salir', style: 'destructive', onPress: async () => {
                            await groupsService.leaveGroup(groupId, currentUser.uid);
                            resolve();
                        }
                    },
                ]);
        });
    };

    const createGroup = async (form: any) => {
        if (!currentUser) return;
        const groupId = await groupsService.createGroup({
            ...form,
            createdByName: currentUser.displayName ?? '',
            memberIds: [currentUser.uid, ...(form.invitedUserIds || [])],
        }, currentUser.uid);

        const invited: string[] = form.invitedUserIds ?? [];
        if (invited.length > 0) {
            const myName = currentUser.displayName ?? 'Alguien';
            invited.forEach(uid => {
                notificationService.addNotification(uid, {
                    category: 'campus',
                    title: t('explore.groups.notifications.added_title') || 'Te añadieron a un grupo de estudio',
                    body: t('explore.groups.notifications.added_body', { name: myName, groupName: form.name }) || `${myName} te añadió a "${form.name}"`,
                    meta: { groupId },
                }).catch(() => { });
            });
        }
    };

    const updateGroup = async (groupId: string, form: any) => {
        await groupsService.updateGroup(groupId, form);
    };

    const deleteGroup = async (groupId: string) => {
        return new Promise<void>((resolve) => {
            Alert.alert(
                t('explore.groups.alerts.delete_title') || 'Eliminar grupo',
                t('explore.groups.alerts.delete_subtitle') || '¿Seguro que quieres borrar este grupo?',
                [
                    { text: t('common.cancel') || 'Cancelar', style: 'cancel', onPress: () => resolve() },
                    {
                        text: t('common.delete') || 'Borrar', style: 'destructive', onPress: async () => {
                            await groupsService.deleteGroup(groupId);
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
            const users = await groupsService.getAllUsers();
            setAllUsers(users.filter((u: any) => u.uid !== currentUser?.uid) as User[]);
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
