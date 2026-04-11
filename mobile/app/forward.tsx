import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, StatusBar, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Check, Send, Mic, Search, X, Hash, MessageCircle, Users } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography } from '@/constants/styles';
import { auth, db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CHANNELS } from '@/constants/channelData';
import {
  subscribeToConversations,
  getConversationId,
  sendMessage as dmSendMessage,
  sendAudioMessage as dmSendAudioMessage,
} from '@/services/dmService';
import { messageService, forumService } from '@/services/shared';
import { useStudyGroups } from '@/hooks/explore/useStudyGroups';
import type { DMConversation, Channel, StudyGroup } from '@/types';

type ForwardTab = 'channels' | 'dms' | 'groups';

const FORWARD_EXCLUDED_CHANNEL_IDS = new Set(['3', '4']);

function ChannelRow({
  channel,
  selected,
  onToggle,
}: {
  channel: Channel;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const displayName = t(`predefined_channels.${channel.id}.name`) || channel.name;
  const displayDescription = t(`predefined_channels.${channel.id}.description`) || channel.description;
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => onToggle(channel.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.channelIcon, { backgroundColor: colors.primary + '18' }]}>
        <Hash size={18} color={colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.info}>
        <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {displayName}
        </ThemedText>
        <ThemedText style={[styles.role, { color: colors.textSecondary }]} numberOfLines={1}>
          {displayDescription}
        </ThemedText>
      </View>
      <View style={[
        styles.checkbox,
        { borderColor: selected ? colors.primary : colors.border },
        selected && { backgroundColor: colors.primary },
      ]}>
        {selected && <Check size={14} color="#fff" strokeWidth={2.5} />}
      </View>
    </TouchableOpacity>
  );
}

function ConversationRow({
  conversation,
  selected,
  onToggle,
}: {
  conversation: DMConversation;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const { colors } = useTheme();
  const initials = conversation.participantName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => onToggle(conversation.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
        {conversation.isOnline && (
          <View style={[styles.onlineDot, { borderColor: colors.background }]} />
        )}
      </View>
      <View style={styles.info}>
        <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {conversation.participantName}
        </ThemedText>
        <ThemedText style={[styles.role, { color: colors.textSecondary }]} numberOfLines={1}>
          {conversation.participantRole === 'teacher' ? 'Profesor/a' : conversation.participantRole === 'admin' ? 'Admin' : 'Alumno/a'}
        </ThemedText>
      </View>
      <View style={[
        styles.checkbox,
        { borderColor: selected ? colors.primary : colors.border },
        selected && { backgroundColor: colors.primary },
      ]}>
        {selected && <Check size={14} color="#fff" strokeWidth={2.5} />}
      </View>
    </TouchableOpacity>
  );
}

function GroupRow({
  group,
  selected,
  onToggle,
}: {
  group: StudyGroup;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => onToggle(group.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.groupIcon, { backgroundColor: group.color + '22' }]}>
        <ThemedText style={[styles.groupIconText, { color: group.color }]}>
          {group.name[0].toUpperCase()}
        </ThemedText>
      </View>
      <View style={styles.info}>
        <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {group.name}
        </ThemedText>
        <ThemedText style={[styles.role, { color: colors.textSecondary }]} numberOfLines={1}>
          {group.subject} · {group.memberCount} miembros
        </ThemedText>
      </View>
      <View style={[
        styles.checkbox,
        { borderColor: selected ? colors.primary : colors.border },
        selected && { backgroundColor: colors.primary },
      ]}>
        {selected && <Check size={14} color="#fff" strokeWidth={2.5} />}
      </View>
    </TouchableOpacity>
  );
}

export default function ForwardScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const {
    messageText, audioUrl, audioDuration,
    imageUrl, imageWidth, imageHeight,
    fileUrl, fileName, fileSize,
    contactUserId, contactName, contactRole, contactBio, contactPhoto,
    postId, postTitle, postContent, postImageUrl, postAuthorName, postAuthorPhoto,
  } = useLocalSearchParams<{
    messageText?: string;
    audioUrl?: string;
    audioDuration?: string;
    imageUrl?: string;
    imageWidth?: string;
    imageHeight?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: string;
    contactUserId?: string;
    contactName?: string;
    contactRole?: string;
    contactBio?: string;
    contactPhoto?: string;
    postId?: string;
    postTitle?: string;
    postContent?: string;
    postImageUrl?: string;
    postAuthorName?: string;
    postAuthorPhoto?: string;
  }>();

  const isContact = !!contactUserId;
  const isPost = !!postId;
  const title = isContact ? 'Compartir contacto' : isPost ? 'Compartir post' : 'Reenviar a...';

  const [allConversationsRaw, setAllConversationsRaw] = useState<DMConversation[]>([]);
  const allConversations = useMemo(
    () => allConversationsRaw.filter(c => !isContact || c.participantId !== contactUserId),
    [allConversationsRaw, isContact, contactUserId],
  );

  useEffect(() => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    return subscribeToConversations(meId, setAllConversationsRaw);
  }, []);

  const { groups: allStudyGroups } = useStudyGroups();

  const [tab, setTab] = useState<ForwardTab>('channels');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [selectedDMs, setSelectedDMs] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const totalSelected = selectedChannels.size + selectedDMs.size + selectedGroups.size;

  const filteredChannels = useMemo(() => {
    const q = query.trim().toLowerCase();
    const forwardable = CHANNELS.filter(c => !FORWARD_EXCLUDED_CHANNEL_IDS.has(c.id));
    if (!q) return forwardable;
    return forwardable.filter(c =>
      c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [query]);

  const filteredDMs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allConversations;
    return allConversations.filter(c => c.participantName.toLowerCase().includes(q));
  }, [allConversations, query]);

  const filteredGroups = useMemo(() => {
    const meId = auth.currentUser?.uid ?? '';
    const joined = allStudyGroups.filter(g => g.memberIds.includes(meId));
    const q = query.trim().toLowerCase();
    if (!q) return joined;
    return joined.filter(g =>
      g.name.toLowerCase().includes(q) || g.subject?.toLowerCase().includes(q),
    );
  }, [allStudyGroups, query]);

  const toggleChannel = useCallback((id: string) => {
    setSelectedChannels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleDM = useCallback((id: string) => {
    setSelectedDMs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((id: string) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSend = async () => {
    if (totalSelected === 0) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const meId = currentUser.uid;
    const senderName = currentUser.displayName ?? 'Me';
    const senderPhoto = currentUser.photoURL ?? null;

    let singleChannelId: string | null = null;
    let singleChannelMsgId: string | null = null;
    let singleDMParticipantId: string | null = null;
    let singleDMMsgId: string | null = null;
    let singleGroupId: string | null = null;

    const tasks: Promise<any>[] = [];
    const isSingleChannel = selectedChannels.size === 1 && selectedDMs.size === 0 && selectedGroups.size === 0;
    const isSingleDM = selectedDMs.size === 1 && selectedChannels.size === 0 && selectedGroups.size === 0;
    const isSingleGroup = selectedGroups.size === 1 && selectedChannels.size === 0 && selectedDMs.size === 0;

    if (selectedChannels.size > 0) {
      const text = isContact
        ? `👤 ${contactName ?? 'Usuario'}${contactBio ? ` — ${contactBio}` : ''}`
        : isPost ? ''
        : messageText ?? '';
      selectedChannels.forEach(channelId => {
        const attachments = isContact ? [{
          type: 'contact',
          url: contactPhoto ?? '',
          name: contactName ?? 'Usuario',
          size: 0,
          bio: contactBio ?? '',
          userId: contactUserId
        } as any] : isPost ? [{
          type: 'post',
          url: postImageUrl ?? '',
          name: postTitle ?? '',
          size: 0,
          postId,
          postTitle: postTitle ?? '',
          postContent: postContent ?? '',
          postAuthorName: postAuthorName ?? '',
          postAuthorPhoto: postAuthorPhoto ?? '',
        } as any] : null;

        const p = messageService.sendMessage(
          channelId,
          text,
          meId,
          senderName,
          senderPhoto,
          attachments,
          null,
          true
        );

        if (isSingleChannel) {
          singleChannelId = channelId;
          tasks.push(p.then((id: string) => { singleChannelMsgId = id; }));
        } else {
          tasks.push(p);
        }
      });
    }

    if (selectedDMs.size > 0) {
      const selectedConvs = allConversations.filter(c => selectedDMs.has(c.id));
      if (isContact) {
        const contactText = `👤 ${contactName ?? 'Usuario'}`;
        const contactAttachment = {
          type: 'contact',
          url: contactPhoto ?? '',
          name: contactName ?? 'Usuario',
          size: 0,
          bio: contactBio ?? '',
          userId: contactUserId
        };
        selectedConvs.forEach(c => {
          const p = dmSendMessage(
            getConversationId(meId, c.participantId),
            meId,
            senderName,
            senderPhoto,
            contactText,
            null,
            true,
            [contactAttachment]
          );
          if (isSingleDM) {
            singleDMParticipantId = c.participantId;
            tasks.push(p.then(msgId => { singleDMMsgId = msgId; }));
          } else { tasks.push(p); }
        });
      } else if (isPost) {
        selectedConvs.forEach(c => {
          const p = dmSendMessage(
            getConversationId(meId, c.participantId),
            meId, senderName, senderPhoto, '', null, true,
            [{ type: 'post', url: postImageUrl ?? '', name: postTitle ?? '', size: 0, postId, postTitle: postTitle ?? '', postContent: postContent ?? '', postAuthorName: postAuthorName ?? '', postAuthorPhoto: postAuthorPhoto ?? '' }]
          );
          if (isSingleDM) {
            singleDMParticipantId = c.participantId;
            tasks.push(p.then(msgId => { singleDMMsgId = msgId; }));
          } else { tasks.push(p); }
        });
      } else if (audioUrl) {
        const duration = parseFloat(audioDuration ?? '0');
        selectedConvs.forEach(c => {
          if (isSingleDM) singleDMParticipantId = c.participantId;
          tasks.push(dmSendAudioMessage(getConversationId(meId, c.participantId), meId, senderName, senderPhoto, audioUrl, duration, true));
        });
      } else if (imageUrl) {
        const width = parseFloat(imageWidth ?? '0');
        const height = parseFloat(imageHeight ?? '0');
        selectedConvs.forEach(c => {
          if (isSingleDM) singleDMParticipantId = c.participantId;
          // dmSendImageMessage no está exportado, usamos dmSendMessage con attachments
          const attachment = { type: 'image', url: imageUrl, name: 'imagen.jpg', size: 0, imageWidth: width, imageHeight: height };
          tasks.push(dmSendMessage(getConversationId(meId, c.participantId), meId, senderName, senderPhoto, '', null, true, [attachment]));
        });
      } else if (fileUrl) {
        const size = parseFloat(fileSize ?? '0');
        selectedConvs.forEach(c => {
          if (isSingleDM) singleDMParticipantId = c.participantId;
          const attachment = { type: 'file', url: fileUrl, name: fileName ?? 'archivo', size };
          tasks.push(dmSendMessage(getConversationId(meId, c.participantId), meId, senderName, senderPhoto, '', null, true, [attachment]));
        });
      } else {
        const text = messageText ?? '';
        selectedConvs.forEach(c => {
          const p = dmSendMessage(getConversationId(meId, c.participantId), meId, senderName, senderPhoto, text, null, true);
          if (isSingleDM) {
            singleDMParticipantId = c.participantId;
            tasks.push(p.then(msgId => { singleDMMsgId = msgId; }));
          } else { tasks.push(p); }
        });
      }
    }

    if (selectedGroups.size > 0) {
      const forwardText = isContact
        ? `👤 ${contactName ?? 'Usuario'}${contactBio ? ` — ${contactBio}` : ''}`
        : isPost ? ''
        : messageText ?? '';
      const forwardAttachments = isContact ? [{
        type: 'contact', url: contactPhoto ?? '', name: contactName ?? 'Usuario',
        size: 0, bio: contactBio ?? '', userId: contactUserId,
      }] : isPost ? [{
        type: 'post', url: postImageUrl ?? '', name: postTitle ?? '', size: 0,
        postId, postTitle: postTitle ?? '', postContent: postContent ?? '',
        postAuthorName: postAuthorName ?? '', postAuthorPhoto: postAuthorPhoto ?? '',
      }] : audioUrl ? [{
        type: 'audio', url: audioUrl, name: 'audio.m4a',
        size: 0, duration: parseFloat(audioDuration ?? '0'),
      }] : imageUrl ? [{
        type: 'image', url: imageUrl, name: 'imagen.jpg', size: 0,
        imageWidth: parseFloat(imageWidth ?? '0'), imageHeight: parseFloat(imageHeight ?? '0'),
      }] : fileUrl ? [{
        type: 'file', url: fileUrl, name: fileName ?? 'archivo', size: parseFloat(fileSize ?? '0'),
      }] : null;

      selectedGroups.forEach(groupId => {
        if (isSingleGroup) singleGroupId = groupId;
        tasks.push(addDoc(collection(db, 'studyGroups', groupId, 'messages'), {
          text: forwardText,
          senderId: meId,
          senderName,
          senderPhoto,
          createdAt: serverTimestamp(),
          edited: false,
          editedAt: null,
          attachments: forwardAttachments,
          reactions: {},
          replyTo: null,
          deletedForUsers: [],
          forwarded: true,
        }));
      });
    }

    await Promise.all(tasks);

    if (isPost && postId && meId) {
      await forumService.trackShare(postId, meId);
    }

    if (singleChannelId) {
      const dest = singleChannelMsgId
        ? `/chat/${singleChannelId}?highlight=${singleChannelMsgId}`
        : `/chat/${singleChannelId}`;
      router.replace(dest as never);
    } else if (singleDMParticipantId) {
      const dest = singleDMMsgId
        ? `/dm/${singleDMParticipantId}?highlight=${singleDMMsgId}`
        : `/dm/${singleDMParticipantId}`;
      router.replace(dest as never);
    } else if (singleGroupId) {
      router.replace(`/chat/sg_${singleGroupId}` as never);
    } else {
      router.back();
    }
  };

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
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{title}</ThemedText>
        {totalSelected > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
            <ThemedText style={styles.countText}>{totalSelected}</ThemedText>
          </View>
        )}
      </View>

      {isContact ? (
        <View style={[styles.previewBanner, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText style={[styles.previewLabel, { color: colors.textSecondary }]}>Contacto a compartir</ThemedText>
          <ThemedText style={[styles.previewText, { color: colors.text }]} numberOfLines={1}>{contactName}</ThemedText>
        </View>
      ) : isPost ? (
        <View style={[styles.previewBanner, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText style={[styles.previewLabel, { color: colors.textSecondary }]}>Post a compartir</ThemedText>
          <ThemedText style={[styles.previewText, { color: colors.text }]} numberOfLines={1}>{postTitle}</ThemedText>
        </View>
      ) : audioUrl ? (
        <View style={[styles.previewBanner, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText style={[styles.previewLabel, { color: colors.textSecondary }]}>Mensaje a reenviar</ThemedText>
          <View style={styles.previewAudioRow}>
            <Mic size={14} color={colors.text} strokeWidth={2} />
            <ThemedText style={[styles.previewText, { color: colors.text }]}>Mensaje de voz</ThemedText>
          </View>
        </View>
      ) : messageText ? (
        <View style={[styles.previewBanner, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText style={[styles.previewLabel, { color: colors.textSecondary }]}>Mensaje a reenviar</ThemedText>
          <ThemedText style={[styles.previewText, { color: colors.text }]} numberOfLines={2}>{messageText}</ThemedText>
        </View>
      ) : null}

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'channels' && styles.tabItemActive]}
          onPress={() => { setTab('channels'); setQuery(''); }}
          activeOpacity={0.7}
        >
          <Hash size={14} color={tab === 'channels' ? colors.primary : colors.textSecondary} strokeWidth={2} />
          <ThemedText style={[styles.tabLabel, { color: tab === 'channels' ? colors.primary : colors.textSecondary }]}>
            Canales{selectedChannels.size > 0 ? ` (${selectedChannels.size})` : ''}
          </ThemedText>
          {tab === 'channels' && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'dms' && styles.tabItemActive]}
          onPress={() => { setTab('dms'); setQuery(''); }}
          activeOpacity={0.7}
        >
          <MessageCircle size={14} color={tab === 'dms' ? colors.primary : colors.textSecondary} strokeWidth={2} />
          <ThemedText style={[styles.tabLabel, { color: tab === 'dms' ? colors.primary : colors.textSecondary }]}>
            Mensajes{selectedDMs.size > 0 ? ` (${selectedDMs.size})` : ''}
          </ThemedText>
          {tab === 'dms' && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === 'groups' && styles.tabItemActive]}
          onPress={() => { setTab('groups'); setQuery(''); }}
          activeOpacity={0.7}
        >
          <Users size={14} color={tab === 'groups' ? colors.primary : colors.textSecondary} strokeWidth={2} />
          <ThemedText style={[styles.tabLabel, { color: tab === 'groups' ? colors.primary : colors.textSecondary }]}>
            Grupos{selectedGroups.size > 0 ? ` (${selectedGroups.size})` : ''}
          </ThemedText>
          {tab === 'groups' && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <Search size={16} color={colors.textSecondary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={tab === 'channels' ? (t('forward.search_channels') || 'Search channel...') : tab === 'groups' ? (t('forward.search_groups') || 'Search group...') : (t('forward.search_people') || 'Search person...')}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={15} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {tab === 'channels' ? (
        <FlatList
          data={filteredChannels}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ChannelRow
              channel={item}
              selected={selectedChannels.has(item.id)}
              onToggle={toggleChannel}
            />
          )}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon={Search} title={t('dm.no_users_found')} />}
        />
      ) : tab === 'groups' ? (
        <FlatList
          data={filteredGroups}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <GroupRow
              group={item}
              selected={selectedGroups.has(item.id)}
              onToggle={toggleGroup}
            />
          )}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon={Users} title={t('explore.groups.no_groups') || 'No groups yet.'} />}
        />
      ) : (
        <FlatList
          data={filteredDMs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              selected={selectedDMs.has(item.id)}
              onToggle={toggleDM}
            />
          )}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptyState icon={Search} title={t('dm.no_users_found')} />}
        />
      )}

      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: totalSelected > 0 ? colors.primary : colors.border },
          ]}
          onPress={handleSend}
          disabled={totalSelected === 0}
          activeOpacity={0.8}
        >
          <Send size={20} color="#fff" strokeWidth={2} />
          <ThemedText style={styles.sendText}>
            Enviar{totalSelected > 0 ? ` (${totalSelected})` : ''}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: '700',
    lineHeight: 20,
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  previewBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  previewLabel: { fontSize: typography.sizes.xs, lineHeight: 16 },
  previewText: { fontSize: typography.sizes.sm, lineHeight: 20, fontWeight: '500' },
  previewAudioRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.sm + 2,
    position: 'relative',
  },
  tabItemActive: {},
  tabLabel: { fontSize: typography.sizes.sm, fontWeight: '600', lineHeight: 18 },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    paddingVertical: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  channelIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    includeFontPadding: false,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
    borderWidth: 1.5,
  },
  info: { flex: 1 },
  name: { fontSize: typography.sizes.md, fontWeight: '600', lineHeight: 20 },
  role: { fontSize: typography.sizes.xs, lineHeight: 16, marginTop: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 4,
    borderRadius: 12,
  },
  sendText: {
    color: '#fff',
    fontSize: typography.sizes.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupIconText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    includeFontPadding: false,
  },
});
