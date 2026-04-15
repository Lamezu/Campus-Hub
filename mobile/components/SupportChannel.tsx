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
    <View style={[badgeStyles.root, { backgroundColor: color + '15', borderColor: color + '30' }]}>
      <View style={[badgeStyles.dot, { backgroundColor: color }]} />
      <ThemedText style={[badgeStyles.text, { color }]}>{label}</ThemedText>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  text: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
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
      style={[rowStyles.root, { backgroundColor: colors.card + '90', borderColor: colors.border + '15' }]}
      onPress={onPress}
      activeOpacity={0.7}
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
        <View style={rowStyles.footer}>
          <View style={rowStyles.meta}>
            <View style={rowStyles.avatarBox}>
              {ticket.userPhoto ? (
                <Image source={{ uri: ticket.userPhoto }} style={rowStyles.avatar} />
              ) : (
                <View style={[rowStyles.avatarFallback, { backgroundColor: colors.primary + '15' }]}>
                  <ThemedText style={[rowStyles.avatarLetter, { color: colors.primary }]}>{(ticket.userName || '?')[0].toUpperCase()}</ThemedText>
                </View>
              )}
            </View>
            <ThemedText style={[rowStyles.metaText, { color: colors.textSecondary }]}>
              {ticket.userName}
            </ThemedText>
            <ThemedText style={[rowStyles.dot, { color: colors.textSecondary }]}>·</ThemedText>
            <ThemedText style={[rowStyles.metaText, { color: colors.textSecondary }]}>
              {formatDate(ticket.createdAt)}
            </ThemedText>
          </View>
          <View style={[rowStyles.arrow, { backgroundColor: colors.primary + '11' }]}>
            <ChevronRight size={14} color={colors.primary} strokeWidth={3} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const rowStyles = StyleSheet.create({
  root: { borderRadius: 28, padding: 20, marginHorizontal: 20, marginVertical: 6, borderWidth: 1 },
  body: { flex: 1, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  desc: { fontSize: 14, lineHeight: 22, opacity: 0.7, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 13, fontWeight: '700', opacity: 0.6 },
  dot: { fontSize: 12, opacity: 0.4 },
  avatarBox: { width: 20, height: 20, borderRadius: 10, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%' },
  avatarFallback: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 10, fontWeight: '900' },
  arrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

function ReplyBubble({ reply, colors, currentUserId }: { reply: any; colors: any; currentUserId: string }) {
  const isOwn = reply.authorId === currentUserId;
  return (
    <View style={[replyStyles.root, isOwn ? replyStyles.ownSide : replyStyles.otherSide]}>
      {!isOwn && reply.isStaff && (
        <View style={[replyStyles.staffBadge, { backgroundColor: colors.primary + '20' }]}>
          <ThemedText style={[replyStyles.staffLabel, { color: colors.primary }]}>CAMPUS TEAM</ThemedText>
        </View>
      )}
      <View style={[
        replyStyles.bubble,
        { backgroundColor: isOwn ? colors.primary : colors.card + '90', borderColor: colors.border + '15' },
        isOwn ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: 4 }
      ]}>
        {!isOwn && (
          <ThemedText style={[replyStyles.author, { color: colors.primary }]}>
            {reply.isStaff ? 'Soporte Campus Hub' : reply.authorName}
          </ThemedText>
        )}
        <ThemedText style={[replyStyles.text, { color: isOwn ? '#fff' : colors.text }]}>
          {reply.text}
        </ThemedText>
        <View style={replyStyles.timeRow}>
          <ThemedText style={[replyStyles.time, { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
            {formatDate(reply.createdAt)}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const replyStyles = StyleSheet.create({
  root: { marginVertical: 8, marginHorizontal: 20, maxWidth: '85%' },
  otherSide: { alignSelf: 'flex-start' },
  ownSide: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  staffBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: 6 },
  staffLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  bubble: { borderRadius: 24, padding: 16, borderWidth: 1, gap: 6 },
  author: { fontSize: 13, fontWeight: '800', marginBottom: 4 },
  text: { fontSize: 15, lineHeight: 24, fontWeight: '500' },
  timeRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  time: { fontSize: 11, fontWeight: '600', opacity: 0.5 },
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

  // Staff acting on their own ticket should be treated as a regular user
  const isActingAsStaff = isStaff && ticket.userId !== currentUser?.uid;

  const handleSendReply = async () => {
    const txt = replyText.trim();
    if (!txt || !currentUser) return;
    setSending(true);
    try {
      await addTicketReply({
        ticketId: ticket.id,
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email || t('support.unknown_user'),
        authorPhoto: currentUser.photoURL ?? null,
        text: txt,
        isStaff: isActingAsStaff,
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
      Alert.alert(t('common.error') || 'Error', t('support.update_status_error') || 'Could not update the ticket status.');
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
            <View style={[detailStyles.infoCard, { backgroundColor: colors.card + '90', borderColor: colors.border + '15' }]}>
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
              <View style={[detailStyles.descBox, { backgroundColor: colors.primary + '08' }]}>
                <ThemedText style={[detailStyles.descLabel, { color: colors.primary }]}>
                  {t('support.your_description')}
                </ThemedText>
                <ThemedText style={[detailStyles.descText, { color: colors.text }]}>
                  {ticket.description}
                </ThemedText>
              </View>
            </View>

            {isActingAsStaff && (
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
              replies.map(r => <ReplyBubble key={r.id} reply={r} colors={colors} currentUserId={currentUser?.uid ?? ''} />)
            )}
            <View style={{ height: 20 }} />
          </ScrollView>

          <View style={[detailStyles.inputRow, { backgroundColor: colors.card + 'F0', borderTopColor: colors.border + '15', paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TextInput
              style={[detailStyles.replyInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border + '15' }]}
              placeholder={t('support.reply_placeholder')}
              placeholderTextColor={colors.textSecondary}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[detailStyles.sendBtn, { backgroundColor: replyText.trim() ? colors.primary : colors.border + '30' }]}
              onPress={handleSendReply}
              disabled={!replyText.trim() || sending}
              activeOpacity={0.8}
            >
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Send size={18} color="#fff" strokeWidth={2.5} />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const detailStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  scrollContent: { padding: 16, gap: 16 },
  infoCard: { borderRadius: 28, padding: 20, borderWidth: 1, gap: 12 },
  ticketTitle: { fontSize: 20, fontWeight: '900', lineHeight: 28, letterSpacing: -0.5 },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  metaLabel: { fontSize: 12, fontWeight: '600' },
  metaValue: { fontSize: 12, fontWeight: '800' },
  descBox: { borderRadius: 20, padding: 18, marginTop: 4 },
  descLabel: { fontSize: 10, fontWeight: '900', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  descText: { fontSize: 15, lineHeight: 24, fontWeight: '500' },
  statusActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  statusBtnText: { fontSize: 13, fontWeight: '800' },
  sectionTitle: { fontSize: 12, fontWeight: '900', marginHorizontal: 20, marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1.5, opacity: 0.5 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderTopWidth: 1 },
  replyInput: { flex: 1, borderRadius: 24, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 12, fontSize: 15, maxHeight: 120, fontWeight: '600' },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
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
        userName: currentUser.displayName || currentUser.email || t('support.unknown_user'),
        userPhoto: currentUser.photoURL ?? null,
        title: title.trim(),
        description: description.trim(),
      });
      onCreated();
      onClose();
    } catch {
      Alert.alert(t('common.error') || 'Error', t('support.create_error') || 'Could not create the ticket. Please try again.');
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
            style={[newStyles.input, { backgroundColor: colors.card + '90', color: colors.text, borderColor: colors.border + '15' }]}
            placeholder={t('support.ticket_title_placeholder') || 'Escribe un título breve...'}
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
            style={[newStyles.textarea, { backgroundColor: colors.card + '90', color: colors.text, borderColor: colors.border + '15' }]}
            placeholder={t('support.ticket_description_placeholder') || 'Explica tu problema con detalle...'}
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
              { backgroundColor: title.trim() && description.trim() ? colors.primary : colors.border + '30' },
            ]}
            onPress={handleSubmit}
            disabled={!title.trim() || !description.trim() || submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <ThemedText style={newStyles.submitText}>{t('support.submit') || 'Enviar Ticket'}</ThemedText>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const newStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  content: { padding: 24, gap: 12 },
  label: { fontSize: 12, fontWeight: '800', marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.7 },
  input: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 16, fontSize: 15, fontWeight: '600' },
  textarea: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 16, fontSize: 15, height: 180, marginBottom: 4, fontWeight: '600' },
  submitBtn: { borderRadius: 20, paddingVertical: 18, alignItems: 'center', marginTop: 24 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});

const infoStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 16, borderBottomWidth: 1 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  content: { alignItems: 'center', padding: 24, gap: 20 },
  photoWrap: { position: 'relative', marginBottom: 8, padding: 4 },
  photoContainer: { width: 130, height: 130, borderRadius: 65, overflow: 'hidden', backgroundColor: 'rgba(128,128,128,0.1)' },
  photo: { width: '100%', height: '100%', borderRadius: 65, borderWidth: 4, borderColor: '#fff' },
  photoPlaceholder: { width: '100%', height: '100%', borderRadius: 65, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff' },
  cameraBtn: { position: 'absolute', bottom: 6, right: 6, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
  channelName: { fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -1 },
  descCard: { width: '100%', borderRadius: 24, padding: 20, borderWidth: 1, gap: 10 },
  descLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  descText: { fontSize: 15, lineHeight: 24, opacity: 0.8 },
  descInput: { fontSize: 15, lineHeight: 24, borderWidth: 1, borderRadius: 16, padding: 16, minHeight: 100, textAlignVertical: 'top' },
  descBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  descBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  compactInfo: { width: '100%', borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 20, borderBottomWidth: 1 },
  infoLabel: { fontSize: 14, fontWeight: '700', opacity: 0.7 },
  infoValue: { fontSize: 14, fontWeight: '800' },
  infoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
});

function ChannelInfoModal({ onClose, colors, t, isStaff }: {
  onClose: () => void;
  colors: any;
  t: (k: string) => string;
  isStaff: boolean;
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
          <TouchableOpacity 
            style={infoStyles.photoWrap}
            activeOpacity={isStaff ? 0.7 : 1}
            onPress={isStaff ? handlePickPhoto : undefined}
            disabled={uploading}
          >
            <View style={infoStyles.photoContainer}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={infoStyles.photo} />
              ) : (
                <View style={[infoStyles.photoPlaceholder, { backgroundColor: colors.primary + '15' }]}>
                  <TicketCheck size={48} color={colors.primary} strokeWidth={1.5} />
                </View>
              )}
            </View>
            {isStaff && (
              <View style={[infoStyles.cameraBtn, { backgroundColor: colors.primary }]}>
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Camera size={18} color="#fff" strokeWidth={2.5} />}
              </View>
            )}
          </TouchableOpacity>

          <ThemedText style={[infoStyles.channelName, { color: colors.text }]}>{name}</ThemedText>

          <View style={[infoStyles.descCard, { backgroundColor: colors.card + '90', borderColor: colors.border + '15' }]}>
            <ThemedText style={[infoStyles.descLabel, { color: colors.primary }]}>
              {t('support.channel_description') || 'Descripción del canal'}
            </ThemedText>
            {isStaff && isEditingDesc ? (
              <>
                <TextInput
                  style={[infoStyles.descInput, { color: colors.text, borderColor: colors.primary + '30', backgroundColor: colors.background }]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  multiline
                  maxLength={300}
                  autoFocus
                  placeholder={t('chat.info.description_placeholder') || 'Añade una descripción\u2026'}
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={infoStyles.descBtns}>
                  <TouchableOpacity onPress={() => setIsEditingDesc(false)} style={[infoStyles.descBtn, { backgroundColor: colors.border + '15' }]}>
                    <ThemedText style={{ fontSize: 13, fontWeight: '700' }}>{t('common.cancel') || 'Cancelar'}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveDesc} style={[infoStyles.descBtn, { backgroundColor: colors.primary }]}>
                    <ThemedText style={{ fontSize: 13, color: '#fff', fontWeight: '800' }}>{t('common.save') || 'Guardar'}</ThemedText>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity activeOpacity={isStaff ? 0.6 : 1} onPress={() => {
                if (!isStaff) return;
                setEditDesc(description);
                setIsEditingDesc(true);
              }}>
                {description ? (
                  <ThemedText style={[infoStyles.descText, { color: colors.text }]}>{description}</ThemedText>
                ) : isStaff ? (
                  <ThemedText style={[infoStyles.descText, { color: colors.primary, fontWeight: '700' }]}>
                    {t('chat.info.add_description') || '+ Añadir descripción'}
                  </ThemedText>
                ) : null}
              </TouchableOpacity>
            )}
          </View>

          <View style={[infoStyles.compactInfo, { backgroundColor: colors.card + '90', borderColor: colors.border + '15' }]}>
            <View style={[infoStyles.infoRow, { borderBottomColor: colors.border + '10' }]}>
              <ThemedText style={[infoStyles.infoLabel, { color: colors.textSecondary }]}>{t('chat.info.type') || 'Tipo'}</ThemedText>
              <View style={[infoStyles.infoBadge, { backgroundColor: colors.primary + '15' }]}>
                <ThemedText style={[infoStyles.infoValue, { color: colors.primary }]}>{t('chat.info.public_channel') || 'Canal público'}</ThemedText>
              </View>
            </View>
            <View style={infoStyles.infoRow}>
              <ThemedText style={[infoStyles.infoLabel, { color: colors.textSecondary }]}>{t('chat.info.members_label') || 'Miembros'}</ThemedText>
              <ThemedText style={[infoStyles.infoValue, { color: colors.text }]}>
                {t('chat.info.all_users') || 'Todos los usuarios'}
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}



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
                style={[
                  styles.pill, 
                  { 
                    backgroundColor: active ? colors.primary : colors.card + '80',
                    borderColor: active ? colors.primary : colors.border + '15'
                  }
                ]}
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
        <Plus size={22} color="#fff" strokeWidth={3} />
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
          isStaff={isStaff}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterBar: { paddingVertical: 12, borderBottomWidth: 1 },
  filters: { paddingHorizontal: 16, gap: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1 },
  pillText: { fontSize: 13, fontWeight: '800' },
  pillBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  pillBadgeText: { fontSize: 10, fontWeight: '900' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingVertical: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyWrap: { alignItems: 'center', gap: 12, paddingHorizontal: 40, marginTop: -40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', letterSpacing: -0.3 },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22, opacity: 0.7 },
  fab: {
    position: 'absolute', right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 22, paddingVertical: 16,
    borderRadius: 30, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
});
