import React, { useState, useCallback, useEffect } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Alert, Image,
  StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft, MessageSquare, Phone, Video, Image as ImageIcon,
  Star, Bell, ImagePlus, Plus, ChevronRight, Share2,
  UserPlus, UserCheck, Heart, Trash2, Shield, AlertTriangle,
} from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { useTranslation } from '@/hooks/useTranslation';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getConversationId } from '@/services/dmService';
import {
  getContactSettings,
  updateContactSettings,
  toggleBestFriend,
  blockUser,
  reportUser,
  clearChat,
  clearChatForAll,
  getSharedMedia,
  getMutualGroups,
  getFriendStatus,
  acceptFriendRequest,
  sendFriendRequest,
} from '@/services/contactSettingsService';
import { useCurrentUser } from '@/contexts/UserContext';
import { SaveToPhotosSheet } from '@/components/dm/SaveToPhotosSheet';
import { BlockSheet } from '@/components/dm/BlockSheet';
import { ReportSheet } from '@/components/dm/ReportSheet';
import type { SaveToPhotosPreference, MuteDuration, MutualGroup } from '@/types';

function roleBadgeLabel(role: string, t: any): string {
  if (role === 'teacher') return t('roles.teacher') || 'Profesor/a';
  if (role === 'admin') return t('roles.admin') || 'Admin';
  return t('roles.student') || 'Alumno/a';
}

function roleBadgeColor(role: string): string {
  if (role === 'teacher') return '#007AFF';
  if (role === 'admin') return '#AF52DE';
  return '#34C759';
}

const getSaveToPhotosLabel = (t: any): Record<SaveToPhotosPreference, string> => ({
  default: t('dm.profile.save_options.default') || 'Por defecto',
  always: t('dm.profile.save_options.always') || 'Siempre',
  never: t('dm.profile.save_options.never') || 'Nunca',
});

const getMuteDurationLabel = (t: any): Record<MuteDuration, string> => ({
  off: t('dm.profile.mute_options.off') || 'Activas',
  '8h': t('dm.profile.mute_options.8h') || 'Silenciadas 8h',
  '1w': t('dm.profile.mute_options.1w') || 'Silenciadas 1 sem.',
  always: t('dm.profile.mute_options.always') || 'Silenciadas',
});

export default function DMContactProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const { isAdmin } = useCurrentUser();
  const meId = auth.currentUser?.uid ?? '';

  const [participantName, setParticipantName] = useState('Usuario');
  const [participantPhoto, setParticipantPhoto] = useState<string | null>(null);
  const [participantRole, setParticipantRole] = useState('student');
  const [participantBio, setParticipantBio] = useState('');

  const [mute, setMute] = useState<MuteDuration>('off');
  const [saveToPhotos, setSaveToPhotos] = useState<SaveToPhotosPreference>('default');
  const [isBestFriend, setIsBestFriend] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestStatus, setFriendRequestStatus] = useState<'none' | 'sent' | 'received'>('none');
  const [sharedMediaCount, setSharedMediaCount] = useState(0);
  const [mutualGroups, setMutualGroups] = useState<MutualGroup[]>([]);
  const [showAllGroups, setShowAllGroups] = useState(false);

  const saveToPhotosLabel = getSaveToPhotosLabel(t);
  const muteDurationLabel = getMuteDurationLabel(t);

  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [showBlockSheet, setShowBlockSheet] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);

  const conversationId = meId && userId ? getConversationId(meId, userId) : '';

  useEffect(() => {
    if (!userId || !meId) return;

    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) {
        const u = snap.data();
        setParticipantName(u.displayName ?? 'Usuario');
        setParticipantPhoto(u.photoURL ?? null);
        setParticipantRole(u.role ?? 'student');
        setParticipantBio(u.bio ?? '');
      }
    }).catch(() => { });

    getContactSettings(meId, userId).then(s => {
      setMute(s.mute);
      setSaveToPhotos(s.saveToPhotos);
      setIsBestFriend(s.isBestFriend);
    }).catch(() => { });

    getFriendStatus(meId, userId).then(s => {
      setIsFriend(s.isFriend);
      setFriendRequestStatus(s.friendRequestStatus);
    }).catch(() => { });

    getSharedMedia(conversationId).then(media => {
      setSharedMediaCount(media.length);
    }).catch(() => { });

    getMutualGroups(meId, userId).then(groups => {
      setMutualGroups(groups);
    }).catch(() => { });
  }, [meId, userId, conversationId]);

  const initials = participantName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const displayedGroups = showAllGroups ? mutualGroups : mutualGroups.slice(0, 3);

  const handleFriendAction = useCallback(async () => {
    if (!meId || !userId) return;
    if (friendRequestStatus === 'received') {
      await acceptFriendRequest(meId, userId);
      setIsFriend(true);
      setFriendRequestStatus('none');
    } else if (friendRequestStatus === 'none' && !isFriend) {
      const currentUser = auth.currentUser;
      await sendFriendRequest(
        meId, userId,
        currentUser?.displayName ?? 'Tú',
        currentUser?.photoURL ?? null
      );
      setFriendRequestStatus('sent');
      Alert.alert(t('dm.profile.friend_request_sent') || 'Solicitud enviada', t('dm.profile.friend_request_success', { name: participantName }) || `Se envió una solicitud de amistad a ${participantName}`);
    } else if (isFriend) {
      const next = await toggleBestFriend(meId, userId);
      setIsBestFriend(next);
    }
  }, [friendRequestStatus, isFriend, meId, userId, participantName]);

  const handleClearChat = () => {
    const buttons: any[] = [
      { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
      {
        text: t('chat.delete_for_me') || 'Eliminar para mí',
        onPress: async () => {
          await clearChat(conversationId, meId);
          Alert.alert(t('chat.chat_cleared') || 'Chat vaciado', t('chat.chat_cleared_msg') || 'Los mensajes ya no son visibles para ti');
        },
      },
    ];
    if (isAdmin) {
      buttons.push({
        text: t('chat.delete_for_all') || 'Eliminar para todos',
        style: 'destructive',
        onPress: async () => {
          await clearChatForAll(conversationId);
          Alert.alert(t('chat.chat_deleted') || 'Chat eliminado', t('chat.chat_deleted_msg') || 'Se eliminaron todos los mensajes');
        },
      });
    }
    Alert.alert(
      t('dm.profile.clear_chat') || 'Vaciar chat',
      t('chat.clear_chat_msg') || `¿Cómo quieres vaciar el chat con ${participantName}?`,
      buttons
    );
  };

  const handleBlock = useCallback(async () => {
    if (!meId || !userId) return;
    await blockUser(meId, userId);
    Alert.alert(t('dm.profile.user_blocked') || 'Usuario bloqueado', t('dm.profile.user_blocked_msg', { name: participantName }) || `Has bloqueado a ${participantName}`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }, [meId, userId, participantName]);

  const handleReport = useCallback(async () => {
    if (!meId || !userId) return;
    await reportUser(meId, userId);
    Alert.alert(t('dm.profile.report_sent') || 'Reporte enviado', t('dm.profile.report_sent_msg') || 'Tu reporte ha sido enviado al equipo de Campus Hub');
  }, [meId, userId]);

  const handleBlockAndReport = useCallback(async () => {
    if (!meId || !userId) return;
    await Promise.all([blockUser(meId, userId), reportUser(meId, userId)]);
    Alert.alert(t('dm.profile.blocked_and_reported') || 'Bloqueado y reportado', t('dm.profile.blocked_and_reported_msg', { name: participantName }) || `Has bloqueado y reportado a ${participantName}`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }, [meId, userId, participantName]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('dm.profile.title') || 'Info. del contacto'}</ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.hero, { borderBottomColor: colors.border }]}>
          <View style={styles.avatarWrapper}>
            {participantPhoto ? (
              <Image source={{ uri: participantPhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={[styles.heroName, { color: colors.text }]}>{participantName}</ThemedText>
          <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor(participantRole) + '22' }]}>
            <ThemedText style={[styles.roleBadgeText, { color: roleBadgeColor(participantRole) }]}>
              {roleBadgeLabel(participantRole, t)}
            </ThemedText>
          </View>
          {!!participantBio && (
            <ThemedText style={[styles.heroBio, { color: colors.textSecondary }]} numberOfLines={3}>
              {participantBio}
            </ThemedText>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <MessageSquare size={22} color={colors.primary} strokeWidth={1.8} />
              <ThemedText style={[styles.actionBtnLabel, { color: colors.text }]}>{t('dm.profile.message') || 'Mensaje'}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => router.push(`/dm/${userId}/call?type=audio` as never)}
              activeOpacity={0.7}
            >
              <Phone size={22} color={colors.primary} strokeWidth={1.8} />
              <ThemedText style={[styles.actionBtnLabel, { color: colors.text }]}>{t('dm.profile.call') || 'Llamar'}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
              onPress={() => router.push(`/dm/${userId}/call?type=video` as never)}
              activeOpacity={0.7}
            >
              <Video size={22} color={colors.primary} strokeWidth={1.8} />
              <ThemedText style={[styles.actionBtnLabel, { color: colors.text }]}>{t('dm.profile.video') || 'Video'}</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push(`/dm/${userId}/profile/media` as never)}
            activeOpacity={0.7}
          >
            <ImageIcon size={20} color={colors.textSecondary} strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: colors.text }]}>{t('dm.profile.media_links') || 'Archivos, enlaces y docs'}</ThemedText>
            <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>{sharedMediaCount}</ThemedText>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/dm/${userId}/profile/media?tab=starred` as never)}
            activeOpacity={0.7}
          >
            <Star size={20} color={colors.textSecondary} strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: colors.text }]}>{t('dm.profile.starred') || 'Destacados'}</ThemedText>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push(`/dm/${userId}/profile/notifications` as never)}
            activeOpacity={0.7}
          >
            <Bell size={20} color={colors.textSecondary} strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: colors.text }]}>{t('dm.profile.notifications') || 'Notificaciones'}</ThemedText>
            <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
              {muteDurationLabel[mute]}
            </ThemedText>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => setShowSaveSheet(true)} activeOpacity={0.7}>
            <ImagePlus size={20} color={colors.textSecondary} strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: colors.text }]}>{t('dm.profile.save_to_photos') || 'Guardar en Fotos'}</ThemedText>
            <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>
              {saveToPhotosLabel[saveToPhotos]}
            </ThemedText>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>
              {t('dm.profile.mutual_groups.title') || (mutualGroups.length === 1 ? '1 grupo en común' : `${mutualGroups.length} grupos en común`)}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => router.push(`/chat/create?userId=${userId}&userName=${encodeURIComponent(participantName)}` as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.groupIcon, { backgroundColor: colors.backgroundSecondary }]}>
              <Plus size={18} color={colors.primary} strokeWidth={2} />
            </View>
            <ThemedText style={[styles.rowLabel, { color: colors.primary }]}>
              {t('dm.profile.create_group_with', { name: participantName.split(' ')[0] }) || `Crear grupo con ${participantName.split(' ')[0]}`}
            </ThemedText>
          </TouchableOpacity>
          {displayedGroups.map((group, idx) => (
            <TouchableOpacity
              key={group.id}
              style={[styles.row, idx < displayedGroups.length - 1 && { borderBottomColor: colors.border }]}
              onPress={() => router.push(`/chat/${group.id}` as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.groupIcon, { backgroundColor: colors.backgroundSecondary }]}>
                <ThemedText style={[styles.groupIconText, { color: colors.textSecondary }]}>
                  {group.name.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.groupInfo}>
                <ThemedText style={[styles.groupName, { color: colors.text }]}>{group.name}</ThemedText>
                <ThemedText style={[styles.groupMembers, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('chat.info.member_count', { count: group.memberCount }) || `${group.memberCount} miembros`} • {group.memberPreview}
                </ThemedText>
              </View>
              <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          ))}
          {mutualGroups.length > 3 && (
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push(`/dm/${userId}/profile/groups` as never)}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.rowLabel, { color: colors.primary }]}>
                {t('dm.profile.view_all', { count: mutualGroups.length }) || `Ver todos (${mutualGroups.length})`}
              </ThemedText>
              <ChevronRight size={16} color={colors.primary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => {
              router.push(`/forward?contactUserId=${userId}&contactName=${encodeURIComponent(participantName)}&contactRole=${participantRole}&contactBio=${encodeURIComponent(participantBio)}&contactPhoto=${encodeURIComponent(participantPhoto ?? '')}` as never);
            }}
            activeOpacity={0.7}
          >
            <Share2 size={20} color="#34C759" strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: '#34C759' }]}>{t('dm.profile.share_user') || 'Compartir usuario'}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={handleFriendAction}
            activeOpacity={friendRequestStatus === 'sent' ? 1 : 0.7}
            disabled={friendRequestStatus === 'sent'}
          >
            {isFriend ? (
              isBestFriend
                ? <Heart size={20} color={colors.primary} fill={colors.primary} strokeWidth={1.8} />
                : <UserCheck size={20} color={colors.primary} strokeWidth={1.8} />
            ) : friendRequestStatus === 'received' ? (
              <UserCheck size={20} color="#34C759" strokeWidth={1.8} />
            ) : (
              <UserPlus size={20} color={friendRequestStatus === 'sent' ? colors.textSecondary : colors.primary} strokeWidth={1.8} />
            )}
            <ThemedText style={[styles.rowLabel, {
              color: isFriend
                ? colors.primary
                : friendRequestStatus === 'received' ? '#34C759'
                  : friendRequestStatus === 'sent' ? colors.textSecondary
                    : colors.primary,
            }]}>
              {isFriend
                ? isBestFriend ? (t('dm.profile.best_friend_remove') || 'Quitar de mejores amigos') : (t('dm.profile.best_friend_add') || 'Añadir a mejores amigos')
                : friendRequestStatus === 'received' ? (t('dm.profile.friend_request_accept') || 'Aceptar solicitud de amistad')
                  : friendRequestStatus === 'sent' ? (t('dm.profile.friend_request_sent') || 'Solicitud enviada')
                    : (t('dm.profile.friend_request_send') || 'Enviar solicitud de amistad')}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={handleClearChat} activeOpacity={0.7}>
            <Trash2 size={20} color="#FF9500" strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: '#FF9500' }]}>{t('dm.profile.clear_chat') || 'Vaciar chat'}</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            onPress={() => setShowBlockSheet(true)}
            activeOpacity={0.7}
          >
            <Shield size={20} color="#FF3B30" strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: '#FF3B30' }]}>
              {t('dm.profile.block_user', { name: participantName.split(' ')[0] }) || `Bloquear a ${participantName.split(' ')[0]}`}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={() => setShowReportSheet(true)} activeOpacity={0.7}>
            <AlertTriangle size={20} color="#FF3B30" strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: '#FF3B30' }]}>
              {t('dm.profile.report_user', { name: participantName.split(' ')[0] }) || `Reportar a ${participantName.split(' ')[0]}`}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SaveToPhotosSheet
        visible={showSaveSheet}
        current={saveToPhotos}
        onSelect={async (value) => {
          setSaveToPhotos(value);
          await updateContactSettings(meId, userId ?? '', { saveToPhotos: value });
        }}
        onClose={() => setShowSaveSheet(false)}
      />
      <BlockSheet
        visible={showBlockSheet}
        userName={participantName.split(' ')[0]}
        onBlockOnly={handleBlock}
        onBlockAndReport={handleBlockAndReport}
        onClose={() => setShowBlockSheet(false)}
      />
      <ReportSheet
        visible={showReportSheet}
        userName={participantName.split(' ')[0]}
        onReportOnly={handleReport}
        onReportAndBlock={handleBlockAndReport}
        onClose={() => setShowReportSheet(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'space-between',
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: {
    fontSize: typography.sizes.md, fontWeight: '700',
    lineHeight: 20, flex: 1, textAlign: 'center',
  },
  hero: {
    alignItems: 'center', paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm,
  },
  avatarWrapper: { width: 90, height: 90, marginBottom: spacing.xs },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarFallback: {
    width: 90, height: 90, borderRadius: 45,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: {
    color: '#fff', fontSize: 32, fontWeight: '700',
    lineHeight: 38, includeFontPadding: false,
  },
  heroName: {
    fontSize: typography.sizes.xl + 2, fontWeight: '700',
    lineHeight: 28, textAlign: 'center',
  },
  roleBadge: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: 20 },
  roleBadgeText: { fontSize: typography.sizes.xs + 1, fontWeight: '600', lineHeight: 16 },
  heroBio: {
    fontSize: typography.sizes.sm, lineHeight: 20,
    textAlign: 'center', paddingHorizontal: spacing.xl,
  },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  actionBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
    borderRadius: 14, gap: 6, minWidth: 80,
  },
  actionBtnLabel: { fontSize: typography.sizes.xs + 1, lineHeight: 16, fontWeight: '500' },
  section: { borderBottomWidth: StyleSheet.hairlineWidth },
  sectionHeader: {
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm, fontWeight: '600', lineHeight: 18,
    textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm,
  },
  rowLabel: { flex: 1, fontSize: typography.sizes.md, lineHeight: 20 },
  rowValue: { fontSize: typography.sizes.sm, lineHeight: 18 },
  groupIcon: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  groupIconText: { fontSize: 16, fontWeight: '700', lineHeight: 20, includeFontPadding: false },
  groupInfo: { flex: 1 },
  groupName: { fontSize: typography.sizes.md, fontWeight: '500', lineHeight: 20 },
  groupMembers: { fontSize: typography.sizes.xs, lineHeight: 16, marginTop: 1 },
});
