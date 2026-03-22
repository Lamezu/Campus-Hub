import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, StatusBar, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Check, Send, Mic, Search, X, Hash, MessageCircle } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { auth } from '@/config/firebase';
import { CHANNELS } from '@/constants/channelData';
import {
  subscribeToConversations,
  getConversationId,
  sendMessage as dmSendMessage,
  sendAudioMessage as dmSendAudioMessage,
} from '@/services/dmService';
import { messageService } from '@/services/shared';
import type { DMConversation, Channel } from '@/types';

type ForwardTab = 'channels' | 'dms';

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
          {channel.name}
        </ThemedText>
        <ThemedText style={[styles.role, { color: colors.textSecondary }]} numberOfLines={1}>
          {channel.description}
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

export default function ForwardScreen() {
  const { colors, theme } = useTheme();
  const {
    messageText, audioUrl, audioDuration,
    imageUrl, imageWidth, imageHeight,
    fileUrl, fileName, fileSize,
    contactUserId, contactName, contactRole, contactBio, contactPhoto,
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
  }>();

  const isContact = !!contactUserId;
  const title = isContact ? 'Compartir contacto' : 'Reenviar a...';

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

  const [tab, setTab] = useState<ForwardTab>('channels');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [selectedDMs, setSelectedDMs] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const totalSelected = selectedChannels.size + selectedDMs.size;

  const filteredChannels = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CHANNELS;
    return CHANNELS.filter(c =>
      c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [query]);

  const filteredDMs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allConversations;
    return allConversations.filter(c => c.participantName.toLowerCase().includes(q));
  }, [allConversations, query]);

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

  const handleSend = async () => {
    if (totalSelected === 0) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const meId = currentUser.uid;
    const senderName = currentUser.displayName ?? 'Tú';
    const senderPhoto = currentUser.photoURL ?? null;

    let singleChannelId: string | null = null;
    let singleChannelMsgId: string | null = null;
    let singleDMParticipantId: string | null = null;
    let singleDMMsgId: string | null = null;

    const tasks: Promise<any>[] = [];
    const isSingleChannel = selectedChannels.size === 1 && selectedDMs.size === 0;
    const isSingleDM = selectedDMs.size === 1 && selectedChannels.size === 0;

    if (selectedChannels.size > 0) {
      const text = isContact
        ? `👤 ${contactName ?? 'Usuario'}${contactBio ? ` — ${contactBio}` : ''}`
        : messageText ?? '';
      selectedChannels.forEach(channelId => {
        const attachments = isContact ? [{
          type: 'contact',
          url: contactPhoto ?? '',
          name: contactName ?? 'Usuario',
          size: 0,
          bio: contactBio ?? '',
          userId: contactUserId
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

    await Promise.all(tasks);

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
            Mensajes directos{selectedDMs.size > 0 ? ` (${selectedDMs.size})` : ''}
          </ThemedText>
          {tab === 'dms' && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <Search size={16} color={colors.textSecondary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={tab === 'channels' ? 'Buscar canal...' : 'Buscar persona...'}
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
          ListEmptyComponent={
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>Sin resultados</ThemedText>
          }
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
          ListEmptyComponent={
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>Sin resultados</ThemedText>
          }
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
  emptyText: {
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: typography.sizes.sm,
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
});
