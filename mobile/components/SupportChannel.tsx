import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, FlatList, Modal, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Image, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { TicketCheck, Plus, ChevronRight, X, Send, Clock, CheckCircle, Circle, Info, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { uploadChannelPhoto } from '@/config/cloudinary';
import { ThemedText } from './themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { useTranslation } from '@/hooks/useTranslation';
import {
  useTickets, useTicketReplies, createTicket,
  addTicketReply, updateTicketStatus,
} from '@/hooks/useTickets';
import type { Ticket, TicketStatus } from '@/types';

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: '#FF9500',
  in_progress: '#007AFF',
  resolved: '#34C759',
};

function StatusBadge({ status, t }: { status: TicketStatus; t: (k: string) => string }) {
  const label =
    status === 'open' ? t('support.status_open')
    : status === 'in_progress' ? t('support.status_in_progress')
    : t('support.status_resolved');
  const color = STATUS_COLORS[status];
  return (
    <View style={[badgeStyles.root, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <View style={[badgeStyles.dot, { backgroundColor: color }]} />
      <ThemedText style={[badgeStyles.text, { color }]}>{label}</ThemedText>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '600' },
});

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function TicketRow({ ticket, onPress, colors, t }: {
  ticket: Ticket;
  onPress: () => void;
  colors: any;
  t: (k: string) => string;
}) {
  return (
    <TouchableOpacity
      style={[rowStyles.root, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={rowStyles.body}>
        <View style={rowStyles.top}>
          <ThemedText style={[rowStyles.title, { color: colors.text }]} numberOfLines={1}>
            {ticket.title}
          </ThemedText>
          <StatusBadge status={ticket.status} t={t} />
        </View>
        <ThemedText style={[rowStyles.desc, { color: colors.textSecondary }]} numberOfLines={2}>
          {ticket.description}
        </ThemedText>
        <View style={rowStyles.meta}>
          {ticket.userPhoto ? (
            <Image source={{ uri: ticket.userPhoto }} style={rowStyles.avatar} />
          ) : (
            <View style={[rowStyles.avatarFallback, { backgroundColor: colors.primary }]}>
              <ThemedText style={rowStyles.avatarLetter}>{(ticket.userName || '?')[0].toUpperCase()}</ThemedText>
            </View>
          )}
          <ThemedText style={[rowStyles.metaText, { color: colors.textSecondary }]}>
            {ticket.userName}
          </ThemedText>
          <ThemedText style={[rowStyles.dot, { color: colors.textSecondary }]}>·</ThemedText>
          <ThemedText style={[rowStyles.metaText, { color: colors.textSecondary }]}>
            {formatDate(ticket.createdAt)}
          </ThemedText>
        </View>
      </View>
      <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginHorizontal: 16, marginVertical: 5, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  body: { flex: 1, gap: 5 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 15, fontWeight: '600' },
  desc: { fontSize: 13, lineHeight: 18 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  metaText: { fontSize: 12 },
  dot: { fontSize: 12 },
  avatar: { width: 16, height: 16, borderRadius: 8 },
  avatarFallback: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 9, color: '#FFF', fontWeight: '700' },
});

function ReplyBubble({ reply, colors }: { reply: any; colors: any }) {
  return (
    <View style={[replyStyles.root, reply.isStaff ? replyStyles.staffSide : replyStyles.userSide]}>
      {reply.isStaff && (
        <View style={[replyStyles.staffBadge, { backgroundColor: colors.primary + '18' }]}>
          <ThemedText style={[replyStyles.staffLabel, { color: colors.primary }]}>Staff</ThemedText>
        </View>
      )}
      <View style={[
        replyStyles.bubble,
        { backgroundColor: reply.isStaff ? colors.primary : colors.card, borderColor: colors.border },
      ]}>
        {!reply.isStaff && (
          <ThemedText style={[replyStyles.author, { color: colors.primary }]}>
            {reply.authorName}
          </ThemedText>
        )}
        <ThemedText style={[replyStyles.text, { color: reply.isStaff ? '#fff' : colors.text }]}>
          {reply.text}
        </ThemedText>
        <ThemedText style={[replyStyles.time, { color: reply.isStaff ? 'rgba(255,255,255,0.65)' : colors.textSecondary }]}>
          {formatDate(reply.createdAt)}
        </ThemedText>
      </View>
    </View>
  );
}

const replyStyles = StyleSheet.create({
  root: { marginVertical: 4, marginHorizontal: 16, maxWidth: '80%' },
  userSide: { alignSelf: 'flex-start' },
  staffSide: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  staffBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-end', marginBottom: 2 },
  staffLabel: { fontSize: 10, fontWeight: '700' },
  bubble: { borderRadius: 14, padding: 10, borderWidth: StyleSheet.hairlineWidth, gap: 3 },
  author: { fontSize: 12, fontWeight: '700' },
  text: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 11, marginTop: 2 },
});

function TicketDetailModal({ ticket, onClose, colors, t, isStaff, currentUser }: {
  ticket: Ticket;
  onClose: () => void;
  colors: any;
  t: (k: string) => string;
  isStaff: boolean;
  currentUser: any;
}) {
  const insets = useSafeAreaInsets();
  const { replies, loading: repliesLoading } = useTicketReplies(ticket.id);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleSendReply = async () => {
    const txt = replyText.trim();
    if (!txt || !currentUser) return;
    setSending(true);
    try {
      await addTicketReply({
        ticketId: ticket.id,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email || 'Usuario',
        authorPhoto: currentUser.photoURL ?? null,
        text: txt,
        isStaff,
      });
      setReplyText('');
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: TicketStatus) => {
    try {
      await updateTicketStatus(ticket.id, status);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el estado.');
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[detailStyles.screen, { backgroundColor: colors.background }]}>
        <View style={[detailStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X size={22} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <ThemedText style={[detailStyles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {t('support.ticket_detail')}
          </ThemedText>
          <StatusBadge status={ticket.status} t={t} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={insets.top + 60}
        >
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={detailStyles.scrollContent}
            onContentSizeChange={() => { }}
          >
            <View style={[detailStyles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ThemedText style={[detailStyles.ticketTitle, { color: colors.text }]}>
                {ticket.title}
              </ThemedText>
              <View style={detailStyles.metaRow}>
                <ThemedText style={[detailStyles.metaLabel, { color: colors.textSecondary }]}>
                  {t('support.created_by')}:
                </ThemedText>
                <ThemedText style={[detailStyles.metaValue, { color: colors.text }]}>
                  {ticket.userName} · {formatDate(ticket.createdAt)}
                </ThemedText>
              </View>
              <View style={[detailStyles.descBox, { backgroundColor: colors.backgroundSecondary || colors.background }]}>
                <ThemedText style={[detailStyles.descLabel, { color: colors.textSecondary }]}>
                  {t('support.your_description')}
                </ThemedText>
                <ThemedText style={[detailStyles.descText, { color: colors.text }]}>
                  {ticket.description}
                </ThemedText>
              </View>
            </View>

            {isStaff && (
              <View style={detailStyles.statusActions}>
                {ticket.status !== 'in_progress' && (
                  <TouchableOpacity
                    style={[detailStyles.statusBtn, { backgroundColor: '#007AFF' + '18', borderColor: '#007AFF' + '44' }]}
                    onPress={() => handleStatusChange('in_progress')}
                  >
                    <Clock size={14} color="#007AFF" strokeWidth={2} />
                    <ThemedText style={[detailStyles.statusBtnText, { color: '#007AFF' }]}>
                      {t('support.mark_in_progress')}
                    </ThemedText>
                  </TouchableOpacity>
                )}
                {ticket.status !== 'resolved' && (
                  <TouchableOpacity
                    style={[detailStyles.statusBtn, { backgroundColor: '#34C759' + '18', borderColor: '#34C759' + '44' }]}
                    onPress={() => handleStatusChange('resolved')}
                  >
                    <CheckCircle size={14} color="#34C759" strokeWidth={2} />
                    <ThemedText style={[detailStyles.statusBtnText, { color: '#34C759' }]}>
                      {t('support.mark_resolved')}
                    </ThemedText>
                  </TouchableOpacity>
                )}
                {ticket.status === 'resolved' && (
                  <TouchableOpacity
                    style={[detailStyles.statusBtn, { backgroundColor: '#FF9500' + '18', borderColor: '#FF9500' + '44' }]}
                    onPress={() => handleStatusChange('open')}
                  >
                    <Circle size={14} color="#FF9500" strokeWidth={2} />
                    <ThemedText style={[detailStyles.statusBtnText, { color: '#FF9500' }]}>
                      {t('support.mark_open')}
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ThemedText style={[detailStyles.sectionTitle, { color: colors.textSecondary }]}>
              {replies.length === 0
                ? t('support.no_replies')
                : replies.length === 1
                  ? t('support.reply_count_one')
                  : t('support.reply_count').replace('{{count}}', String(replies.length))}
            </ThemedText>
            {repliesLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
            ) : (
              replies.map(r => <ReplyBubble key={r.id} reply={r} colors={colors} />)
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={[detailStyles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TextInput
              style={[detailStyles.replyInput, { backgroundColor: colors.backgroundSecondary || colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('support.reply_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[detailStyles.sendBtn, { backgroundColor: replyText.trim() ? colors.primary : colors.border }]}
              onPress={handleSendReply}
              disabled={!replyText.trim() || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Send size={18} color="#fff" strokeWidth={2} />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  scrollContent: { padding: 16, gap: 12 },
  infoCard: { borderRadius: 14, padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
  ticketTitle: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaLabel: { fontSize: 13 },
  metaValue: { fontSize: 13, fontWeight: '500' },
  descBox: { borderRadius: 10, padding: 12, marginTop: 4 },
  descLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  descText: { fontSize: 14, lineHeight: 20 },
  statusActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  statusBtnText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '600', marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  replyInput: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

function NewTicketModal({ onClose, onCreated, colors, t, currentUser }: {
  onClose: () => void;
  onCreated: () => void;
  colors: any;
  t: (k: string) => string;
  currentUser: any;
}) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !currentUser) return;
    setSubmitting(true);
    try {
      await createTicket({
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'Usuario',
        userPhoto: currentUser.photoURL ?? null,
        title: title.trim(),
        description: description.trim(),
      });
      onCreated();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not create the ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[newStyles.screen, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[newStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X size={22} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <ThemedText style={[newStyles.headerTitle, { color: colors.text }]}>
            {t('support.new_ticket')}
          </ThemedText>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={newStyles.content} keyboardShouldPersistTaps="handled">
          <ThemedText style={[newStyles.label, { color: colors.textSecondary }]}>
            {t('support.ticket_title')}
          </ThemedText>
          <TextInput
            style={[newStyles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder={t('support.ticket_title_placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            returnKeyType="next"
          />

          <ThemedText style={[newStyles.label, { color: colors.textSecondary }]}>
            {t('support.ticket_description')}
          </ThemedText>
          <TextInput
            style={[newStyles.textarea, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
            placeholder={t('support.ticket_description_placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />

          <TouchableOpacity
            style={[
              newStyles.submitBtn,
              { backgroundColor: title.trim() && description.trim() ? colors.primary : colors.border },
            ]}
            onPress={handleSubmit}
            disabled={!title.trim() || !description.trim() || submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <ThemedText style={newStyles.submitText}>{t('support.submit')}</ThemedText>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const newStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  content: { padding: 20, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  textarea: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, height: 160, marginBottom: 4 },
  submitBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

function ChannelInfoModal({ onClose, colors, t, isAdmin }: {
  onClose: () => void;
  colors: any;
  t: (k: string) => string;
  isAdmin: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'channels', '4'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setPhotoURL(data.photoURL ?? null);
        setName(data.name ?? '');
        setDescription(data.description ?? '');
        setMemberCount(data.memberCount ?? null);
      }
    });
    return unsub;
  }, []);

  const handleSaveDesc = async () => {
    try {
      await updateDoc(doc(db, 'channels', '4'), { description: editDesc.trim() });
    } catch { }
    setIsEditingDesc(false);
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const url = await uploadChannelPhoto(result.assets[0].uri, '4');
      await updateDoc(doc(db, 'channels', '4'), { photoURL: url });
      setPhotoURL(url);
    } catch {
      Alert.alert(t('common.error') || 'Error', t('chat.info.image_error') || 'Could not upload the image.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[infoStyles.screen, { backgroundColor: colors.background }]}>
        <View style={[infoStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X size={22} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <ThemedText style={[infoStyles.headerTitle, { color: colors.text }]}>
            {t('support.channel_info')}
          </ThemedText>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={infoStyles.content}>
          <View style={infoStyles.photoWrap}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={infoStyles.photo} />
            ) : (
              <View style={[infoStyles.photoPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                <TicketCheck size={48} color={colors.primary} strokeWidth={1.5} />
              </View>
            )}
            {isAdmin && (
              <TouchableOpacity
                style={[infoStyles.cameraBtn, { backgroundColor: colors.primary }]}
                onPress={handlePickPhoto}
                disabled={uploading}
                activeOpacity={0.8}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Camera size={18} color="#fff" strokeWidth={2} />}
              </TouchableOpacity>
            )}
          </View>

          <ThemedText style={[infoStyles.channelName, { color: colors.text }]}>{name}</ThemedText>

          <View style={[infoStyles.descCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ThemedText style={[infoStyles.descLabel, { color: colors.textSecondary }]}>
              {t('support.channel_description') || 'Description'}
            </ThemedText>
            {isAdmin && isEditingDesc ? (
              <>
                <TextInput
                  style={[infoStyles.descInput, { color: colors.text, borderColor: colors.border }]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  multiline
                  maxLength={300}
                  autoFocus
                  placeholder={t('chat.info.description_placeholder') || 'Add a description\u2026'}
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={infoStyles.descBtns}>
                  <TouchableOpacity onPress={() => setIsEditingDesc(false)} style={[infoStyles.descBtn, { backgroundColor: colors.border + '80' }]}>
                    <ThemedText style={{ fontSize: 13 }}>{t('common.cancel') || 'Cancel'}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveDesc} style={[infoStyles.descBtn, { backgroundColor: colors.primary }]}>
                    <ThemedText style={{ fontSize: 13, color: '#fff', fontWeight: '600' }}>{t('common.save') || 'Save'}</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity activeOpacity={isAdmin ? 0.6 : 1} onPress={() => {
                if (!isAdmin) return;
                setEditDesc(description);
                setIsEditingDesc(true);
              }}>
                {description ? (
                  <ThemedText style={[infoStyles.descText, { color: colors.text }]}>{description}</ThemedText>
                ) : isAdmin ? (
                  <ThemedText style={[infoStyles.descText, { color: colors.primary + 'CC' }]}>
                    {t('chat.info.add_description') || '+ Add description'}
                  </ThemedText>
                ) : null}
              </TouchableOpacity>
            )}
          </View>

          <View style={[infoStyles.compactInfo, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[infoStyles.infoRow, { borderBottomColor: colors.border }]}>
              <ThemedText style={[infoStyles.infoLabel, { color: colors.textSecondary }]}>{t('chat.info.type') || 'Type'}</ThemedText>
              <ThemedText style={[infoStyles.infoValue, { color: colors.text }]}>{t('chat.info.public_channel') || 'Public channel'}</ThemedText>
            </View>
            <View style={infoStyles.infoRow}>
              <ThemedText style={[infoStyles.infoLabel, { color: colors.textSecondary }]}>{t('chat.info.members_label') || 'Members'}</ThemedText>
              <ThemedText style={[infoStyles.infoValue, { color: colors.text }]}>{memberCount !== null ? String(memberCount) : (t('chat.info.all_users') || 'All users')}</ThemedText>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const infoStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  content: { alignItems: 'center', padding: 24, gap: 16 },
  photoWrap: { position: 'relative', marginBottom: 4 },
  photo: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  channelName: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  descCard: { width: '100%', borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  descLabel: { fontSize: 12, fontWeight: '600' },
  descText: { fontSize: 14, lineHeight: 20 },
  descInput: { fontSize: 14, lineHeight: 20, borderWidth: 1, borderRadius: 8, padding: 8, minHeight: 64, textAlignVertical: 'top', marginTop: 4 },
  descBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  descBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  compactInfo: { width: '100%', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '500' },
});

type FilterStatus = 'all' | TicketStatus;

export function SupportChannel() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { firebaseUser, isTeacherOrAdmin, isAdmin } = useCurrentUser();
  const isStaff = isTeacherOrAdmin;
  const insets = useSafeAreaInsets();

  const uid = firebaseUser?.uid ?? '';
  const { tickets, loading } = useTickets(uid, isStaff);

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const selectedTicket = selectedTicketId ? tickets.find(t => t.id === selectedTicketId) ?? null : null;
  const filtered = filter === 'all' ? tickets : tickets.filter(tk => tk.status === filter);

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: t('support.filter_all') },
    { key: 'open', label: t('support.filter_open') },
    { key: 'in_progress', label: t('support.filter_in_progress') },
    { key: 'resolved', label: t('support.filter_resolved') },
  ];

  const countFor = (status: TicketStatus) => tickets.filter(tk => tk.status === status).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: t('support.title') || 'Title',
          headerShown: true,
          headerBackTitle: '',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowInfo(true)}
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 2 }}
            >
              <Info size={22} color={colors.text} strokeWidth={1.8} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map(f => {
            const count = f.key !== 'all' ? countFor(f.key as TicketStatus) : tickets.length;
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.pill, active && { backgroundColor: colors.primary }]}
                onPress={() => setFilter(f.key)}
                activeOpacity={0.75}
              >
                <ThemedText style={[styles.pillText, { color: active ? '#fff' : colors.textSecondary }]}>
                  {f.label}
                </ThemedText>
                {count > 0 && (
                  <View style={[styles.pillBadge, { backgroundColor: active ? 'rgba(255,255,255,0.3)' : colors.primary + '22' }]}>
                    <ThemedText style={[styles.pillBadgeText, { color: active ? '#fff' : colors.primary }]}>
                      {count > 99 ? '99+' : count}
                    </ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TicketRow ticket={item} onPress={() => setSelectedTicketId(item.id)} colors={colors} t={t} />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 90 },
            filtered.length === 0 && styles.emptyContainer,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <TicketCheck size={52} color={colors.textSecondary} strokeWidth={1.2} />
              <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
                {filter !== 'all'
                  ? t('support.no_tickets_staff')
                  : isStaff ? t('support.no_tickets_staff') : t('support.no_tickets')}
              </ThemedText>
              {!isStaff && filter === 'all' && (
                <ThemedText style={[styles.emptySub, { color: colors.textSecondary }]}>
                  {t('support.no_tickets_sub')}
                </ThemedText>
              )}
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 20 }]}
        onPress={() => setShowNewTicket(true)}
        activeOpacity={0.85}
      >
        <Plus size={22} color="#fff" strokeWidth={2.5} />
        <ThemedText style={styles.fabText}>{t('support.new_ticket')}</ThemedText>
      </TouchableOpacity>

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicketId(null)}
          colors={colors}
          t={t}
          isStaff={isStaff}
          currentUser={firebaseUser}
        />
      )}
      {showNewTicket && (
        <NewTicketModal
          onClose={() => setShowNewTicket(false)}
          onCreated={() => { }}
          colors={colors}
          t={t}
          currentUser={firebaseUser}
        />
      )}
      {showInfo && (
        <ChannelInfoModal
          onClose={() => setShowInfo(false)}
          colors={colors}
          t={t}
          isAdmin={isAdmin}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 6,
    backgroundColor: 'rgba(120,120,128,0.12)',
  },
  pillText: { fontSize: 13, fontWeight: '600' },
  pillBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  pillBadgeText: { fontSize: 11, fontWeight: '700' },
  list: { paddingTop: 10 },
  emptyContainer: { flexGrow: 1 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 13,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
