import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import {
  Settings, ChevronLeft, Reply, Trash2, Copy, Forward,
  Plus, ChevronDown, MoreVertical, Type, Bold, Italic,
  Check, Search, Camera, Loader2, CheckCircle2,
  Megaphone, Compass, CalendarRange, LifeBuoy, Phone, Video,
  MonitorUp, Radio
} from 'lucide-react';
import { ChatBackgroundEditor } from '@/components/chat/ChatBackgroundEditor';
import { uploadChannelPhoto } from '@/config/cloudinary';
import { AlertModal } from '@/components/AlertModal';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput, type MessageInputHandle } from '@/components/MessageInput';
import { EventChannelView } from '@/components/chat/EventChannelView';
import { SoporteChannelView } from '@/components/chat/SoporteChannelView';
import { ChannelInfoModal } from '@/components/chat/ChannelInfoModal';
import { ForwardModal } from '@/components/ForwardModal';
import { ContactInfoModal } from '@/components/dm/ContactInfoModal';
import { spacing, chatThemes, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { MOCK_CHANNELS } from '@/constants/mockData';
import { auth, db } from '@/config/firebase';
import { useTranslation } from '@/contexts/LanguageContext';
import { useCall } from '@/contexts/CallContext';
import { createConference, subscribeToActiveConferenceForGroup } from '@/services/studyGroupConferenceService';
import type { GroupCall } from '@/services/groupCallService';
import { markChannelRead } from '@/services/channelReadService';
import { notificationService } from '@/services/notificationService';
import { useAlert } from '@/contexts/AlertContext';
import * as starredService from '@/services/starredMessagesService';
import type { Message, ReplyPreview, User } from '@/types';
import { useCurrentUser } from '@/contexts/UserContext';
import { ChatLoadingOverlay } from '@/components/chat/ChatLoadingOverlay';

const MESSAGES_PER_PAGE = 50;
export default function ChatScreen() {
  const { t } = useTranslation();
  const { colors, chatSettings, setChatSettings } = useTheme();
  const { showAlert } = useAlert();
  const { id } = useParams<{ id: string }>();
  const [isStudyGroup, setIsStudyGroup] = useState(id?.startsWith('sg_') || false);
  const cleanId = id?.replace(/^(sg_|group_|channel_|group_)/, '') || '';
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveConference, setActiveConferenceId, activeConference } = useCall();
  const { isAdmin, isTeacherOrAdmin } = useCurrentUser();
  const collectionName = isStudyGroup ? 'studyGroups' : 'channels';
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [menuMessage, setMenuMessage] = useState<Message | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [dynamicChannelName, setDynamicChannelName] = useState<string | null>(null);
  const [channelPhoto, setChannelPhoto] = useState<string | null>(null);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [activeGroupConference, setActiveGroupConference] = useState<GroupCall | null>(null);
  const [allUsersCount, setAllUsersCount] = useState<number>(0);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [editingBgImage, setEditingBgImage] = useState<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastDocRef = useRef<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);

  const getDisplayName = (name: string | null) => {
    if (!name) return t('chat_ui.channel_fallback', { id: id ?? '' });
    const systemChannels: Record<string, string> = {
      'general': 'messages.channels.general',
      'anuncios oficiales': 'messages.channels.official_announcements',
      'eventos y actividad': 'messages.channels.events',
      'ayuda y soporte': 'messages.channels.help'
    };
    const lower = name.toLowerCase();
    return systemChannels[lower] ? t(systemChannels[lower]) : name;
  };

  const channelName = getDisplayName(dynamicChannelName);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      if (snap.exists()) setUserProfile(snap.data());
    });
  }, [currentUser]);

  useEffect(() => {
    if (!cleanId) return;

    const mockChannel = MOCK_CHANNELS.find(ch => ch.id === cleanId);
    if (mockChannel) {
      setDynamicChannelName(mockChannel.name);
    }

    const tryFetchName = async () => {
      const sgSnap = await getDoc(doc(db, 'studyGroups', cleanId));
      if (sgSnap.exists()) {
        const data = sgSnap.data();
        setDynamicChannelName(data.name);
        setChannelPhoto(data.photoURL || null);
        setChannelMembers(data.memberIds || []);
        setIsStudyGroup(true);
        if (id && !id.startsWith('sg_')) {
          navigate(`/chat/sg_${cleanId}`, { replace: true });
        }
        return;
      }

      const chSnap = await getDoc(doc(db, 'channels', cleanId));
      if (chSnap.exists()) {
        const data = chSnap.data();
        setDynamicChannelName(data.name || data.displayName || mockChannel?.name || null);
        setChannelPhoto(data.photoURL || null);
        setChannelMembers(data.memberIds || []);
      }
    };

    tryFetchName();
  }, [cleanId]);

  useEffect(() => {
    if (!cleanId) return;
    const messagesRef = collection(db, collectionName, cleanId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGES_PER_PAGE));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData: Message[] = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || '',
            senderId: data.senderId || '',
            senderName: data.senderName || t('chat_ui.unknown_sender'),
            senderPhoto: data.senderPhoto || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            edited: data.edited || false,
            editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
            attachments: data.attachments || null,
            reactions: data.reactions || {},
            replyTo: data.replyTo || null,
            deletedForUsers: data.deletedForUsers || [],
            poll: data.poll || null,
          };
        })
        .filter(msg => !currentUser || !msg.deletedForUsers?.includes(currentUser.uid));

      setMessages(messagesData);
      setLoading(false);
      setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
      if (snapshot.docs.length > 0) {
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
      if (currentUser && cleanId) {
        markChannelRead(cleanId, currentUser.uid);
      }
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
    if (currentUser) {
      starredService.getStarredIdsForChannel(currentUser.uid, cleanId)
        .then(setStarredIds)
        .catch(console.error);
    }
    return () => unsubscribe();
  }, [cleanId, currentUser, collectionName]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlightId');
    if (highlightId && messages.length > 0) {
      const handleHighlight = (messageId: string) => {
        setHighlightedMessageId(messageId);
        const element = document.getElementById(`msg-${messageId}`);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedMessageId(null), 2000);
      };
      handleHighlight(highlightId);
      const newParams = new URLSearchParams(location.search);
      newParams.delete('highlightId');
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [location.search, messages.length]);

  useEffect(() => {
    if (!id || !currentUser) return;
    markChannelRead(id, currentUser.uid);
    notificationService.setCurrentView({ type: 'channel', id });
    return () => {
      notificationService.setCurrentView(null);
    };
  }, [id, currentUser, isStudyGroup]);

  const getChannelInfo = () => {
    const systemChannels: Record<string, { icon: any; verified: boolean; readOnly?: boolean; viewType?: 'events' | 'support'; description?: string }> = {
      'general': { icon: Compass, verified: false },
      'anuncios oficiales': { icon: Megaphone, verified: true, readOnly: true },
      'eventos y actividad': { icon: CalendarRange, verified: true, readOnly: true, viewType: 'events' },
      'ayuda y soporte': { icon: LifeBuoy, verified: true, readOnly: false, viewType: 'support' }
    };
    const nameToTest = (dynamicChannelName || MOCK_CHANNELS.find(c => c.id === cleanId)?.name || '').toLowerCase();
    const idToTest = cleanId.toLowerCase();
    for (const key in systemChannels) {
      if (nameToTest.includes(key) || idToTest.includes(key)) {
        return { ...systemChannels[key], isSystem: true };
      }
    }
    return { icon: null, verified: false, isSystem: false, readOnly: false };
  };

  const channelInfo = getChannelInfo();
  const isSystemChannel = channelInfo.isSystem;
  const isReadOnlyChannel = channelInfo.readOnly && !isAdmin;


  useEffect(() => {
    if (!isStudyGroup || !cleanId || !currentUser) return;
    const unsub = subscribeToActiveConferenceForGroup(cleanId, currentUser.uid, (conf) => {
      setActiveGroupConference(conf);
    });
    return unsub;
  }, [isStudyGroup, cleanId, currentUser]);

  useEffect(() => {
    if (!channelInfo.isSystem) return;
    getDocs(query(collection(db, 'users'))).then(snap => {
      setAllUsersCount(snap.docs.length);
    });
  }, [channelInfo.isSystem]);

  const sendChannelNotifications = async (messageId: string, text: string) => {
    if (!currentUser || !cleanId) return;
    let targets = [...channelMembers];
    if (isSystemChannel) {
      const usnap = await getDocs(query(collection(db, 'users'), limit(1000)));
      const allUserIds = usnap.docs.map(u => u.id);
      targets = [...targets, ...allUserIds];
    } else if (targets.length === 0) {
      const usnap = await getDocs(query(collection(db, 'users'), limit(100)));
      targets = usnap.docs.map(u => u.id);
    }
    const uniqueTargets = Array.from(new Set(targets.filter(t => t && t !== currentUser.uid)));
    const senderName = userProfile?.displayName || currentUser.displayName || t('profile.username_placeholder');
    const channelNameDisplay = dynamicChannelName || MOCK_CHANNELS.find(c => c.id === cleanId)?.name || t('chat_ui.channel_label');
    const notifyPromises = uniqueTargets.map(mId =>
      notificationService.addNotification(mId, {
        title: t('notifications.channel_message_title'),
        titleKey: 'notifications.channel_message_title',
        body: text,
        category: isStudyGroup ? 'group' : 'channel',
        meta: {
          channelId: cleanId,
          groupId: isStudyGroup ? cleanId : undefined,
          senderName,
          channelName: channelNameDisplay
        }
      })
    );
    await Promise.all(notifyPromises).catch(() => { });
  };

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const messagesRef = collection(db, collectionName, cleanId, 'messages');
      const docRef = await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || t('profile.username_placeholder'),
        senderPhoto: userProfile?.photoURL || currentUser.photoURL || null,
        text,
        createdAt: serverTimestamp(),
        edited: false,
        reactions: {},
        replyTo: replyData ?? null,
        deletedForUsers: [],
      });
      await sendChannelNotifications(docRef.id, text);
    } catch (error) {
      console.error(error);
      showAlert({ title: t('common.error'), message: t('chat_ui.error_send'), type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleSendAudio = async (url: string, duration: number) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const messagesRef = collection(db, collectionName, cleanId, 'messages');
      const docRef = await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || t('profile.username_placeholder'),
        senderPhoto: userProfile?.photoURL || currentUser.photoURL || null,
        text: '',
        attachments: [{ url, type: 'audio', duration }],
        createdAt: serverTimestamp(),
        edited: false,
        reactions: {},
        replyTo: replyData ?? null,
        deletedForUsers: [],
      });
      await sendChannelNotifications(docRef.id, t('chat_ui.voice_message'));
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async (url: string, type: 'image' | 'video' | 'file', fileName?: string, fileSize?: number) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    try {
      const messagesRef = collection(db, collectionName, cleanId, 'messages');
      const docRef = await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || t('profile.username_placeholder'),
        senderPhoto: userProfile?.photoURL || currentUser.photoURL || null,
        text: '',
        attachments: [{
          url,
          type,
          name: fileName || (type === 'video' ? 'video.mp4' : type === 'image' ? 'image.jpg' : 'file'),
          size: fileSize || 0
        }],
        createdAt: serverTimestamp(),
        edited: false,
        reactions: {},
        replyTo: null,
        deletedForUsers: [],
      });
      
      let notifText = t('chat_ui.image');
      if (type === 'video') notifText = t('chat_ui.video');
      if (type === 'file') notifText = t('chat_ui.file');
      
      await sendChannelNotifications(docRef.id, notifText);
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleSendPoll = async (poll: any) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    try {
      const messagesRef = collection(db, collectionName, cleanId, 'messages');
      const pollData = {
        question: poll.question,
        options: poll.options.map((opt: string, i: number) => ({ id: i.toString(), text: opt, votes: [] })),
        multipleAnswers: poll.multipleAnswers,
        closed: false,
        totalVotes: 0,
      };
      const docRef = await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || t('profile.username_placeholder'),
        senderPhoto: userProfile?.photoURL || currentUser.photoURL || null,
        text: '',
        poll: pollData,
        createdAt: serverTimestamp(),
        edited: false,
        reactions: {},
        replyTo: null,
        deletedForUsers: [],
      });
      await sendChannelNotifications(docRef.id, t('chat_ui.poll_notification', { question: poll.question }));
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleToggleStar = async (msg: Message) => {
    if (!currentUser || !cleanId) return;
    const isStarred = starredIds.has(msg.id);
    try {
      if (isStarred) {
        await starredService.unstarMessage(currentUser.uid, msg.id);
        setStarredIds(prev => {
          const next = new Set(prev);
          next.delete(msg.id);
          return next;
        });
      } else {
        if (isStudyGroup) {
          await starredService.starMessage(currentUser.uid, msg, 'group', undefined, undefined, cleanId);
        } else {
          await starredService.starMessage(currentUser.uid, msg, 'channel', undefined, cleanId);
        }
        setStarredIds(prev => new Set(prev).add(msg.id));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleReply = (message: Message) => {
    const firstAttachment = message.attachments?.[0];
    setReplyingTo({
      id: message.id,
      text: message.text || '',
      senderName: message.senderName,
      isAudio: firstAttachment?.type === 'audio',
      type: (firstAttachment?.type as any) || (message.poll ? 'poll' : 'text'),
      attachmentName: firstAttachment?.name ?? undefined
    });
  };

  const handleReaction = async (emoji: string, msg: Message) => {
    if (!currentUser || !id) return;
    const existing = msg.reactions?.[emoji] ?? [];
    const hasReacted = existing.includes(currentUser.uid);
    await updateDoc(doc(db, collectionName, cleanId, 'messages', msg.id), {
      [`reactions.${emoji}`]: hasReacted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
    });
  };

  const deleteMessage = async (messageId: string, forAll = false) => {
    if (!id || !currentUser) return;
    try {
      if (forAll) {
        await deleteDoc(doc(db, collectionName, cleanId, 'messages', messageId));
      } else {
        await updateDoc(doc(db, collectionName, cleanId, 'messages', messageId), {
          deletedForUsers: arrayUnion(currentUser.uid),
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleReplyPreviewPress = (messageId: string) => {
    setHighlightedMessageId(messageId);
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightedMessageId(null), 2000);
  };

  const handleForward = (msg: Message) => {
    setForwardingMessage(msg);
  };

  const handleUserClick = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setSelectedContact({ uid, ...snap.data() } as User);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!currentUser || !cleanId) return;
    try {
      const msgRef = doc(db, collectionName, cleanId, 'messages', messageId);
      const msgSnap = await getDoc(msgRef);
      if (!msgSnap.exists()) return;
      const pollData = msgSnap.data().poll;
      if (!pollData) return;
      const isMultiple = pollData.multipleAnswers;
      let updatedOptions;
      if (isMultiple) {
        updatedOptions = pollData.options.map((opt: any) => {
          if (opt.id === optionId || opt.id === parseInt(optionId)) {
            const votes = opt.votes || [];
            const hasVoted = votes.includes(currentUser.uid);
            return {
              ...opt,
              votes: hasVoted
                ? votes.filter((uid: string) => uid !== currentUser.uid)
                : [...votes, currentUser.uid]
            };
          }
          return opt;
        });
      } else {
        updatedOptions = pollData.options.map((opt: any) => ({
          ...opt,
          votes: (opt.votes || []).filter((uid: string) => uid !== currentUser.uid)
        }));
        const optionIndex = pollData.options.findIndex((o: any) => o.id === optionId || o.id === parseInt(optionId));
        if (optionIndex !== -1) {
          if (!updatedOptions[optionIndex].votes) updatedOptions[optionIndex].votes = [];
          updatedOptions[optionIndex].votes.push(currentUser.uid);
        }
      }
      const totalVotes = updatedOptions.reduce((acc: number, opt: any) => acc + (opt.votes?.length || 0), 0);
      await updateDoc(msgRef, {
        poll: {
          ...pollData,
          options: updatedOptions,
          totalVotes
        }
      });
    } catch (error) {
      console.error(error);
    }
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const customBackground = chatSettings.customBackground;
  const backgroundActive = !!(customBackground || chatThemes[chatSettings.themeId]?.backgroundImage);
  const backgroundUrl = customBackground?.url || chatThemes[chatSettings.themeId]?.backgroundImage;

  const handleBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      const url = await uploadChannelPhoto(file, `global_bg_${Date.now()}`);
      setEditingBgImage(url);
    } catch (error) {
      console.error(error);
    } finally {
      setUploadingBg(false);
      if (bgInputRef.current) bgInputRef.current.value = '';
    }
  };

  const handleSaveEditedBg = (url: string, x: number, y: number, scale: number) => {
    const newBg = { url, x, y, scale };
    const saved = chatSettings.savedCustomBackgrounds || [];
    const filtered = saved.filter(b => b.url !== url);
    const updatedSaved = [newBg, ...filtered].slice(0, 10);
    setChatSettings({
      customBackground: newBg,
      savedCustomBackgrounds: updatedSaved
    });
    setEditingBgImage(null);
    setShowSettings(false);
  };

  const removeBackground = () => {
    if (!customBackground) return;
    showAlert({
      title: t('chat_ui.delete_bg_title'),
      message: t('chat_ui.delete_bg_msg'),
      type: 'confirm',
      showCancelButton: true,
      confirmText: t('chat_ui.delete_btn'),
      onConfirm: () => {
        const saved = chatSettings.savedCustomBackgrounds || [];
        const updatedSaved = saved.filter(b => b.url !== customBackground.url);
        setChatSettings({
          customBackground: null,
          themeId: 'default',
          savedCustomBackgrounds: updatedSaved
        });
      }
    });
  };


  return (
    <ThemedView style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', backgroundColor: colors.background, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          padding: `${spacing.sm}px ${spacing.md}px`,
          backgroundColor: colors.card,
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          zIndex: 10,
          height: 64,
          boxSizing: 'border-box'
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.text,
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ChevronLeft size={24} />
          </button>
          <div
            onClick={() => setShowChannelInfo(true)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              overflow: 'hidden',
              paddingRight: 12
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.backgroundSecondary, flexShrink: 0 }}>
              {channelPhoto ? (
                <img src={channelPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              ) : (
                <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                  {channelName?.[0]}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {channelInfo.icon && <channelInfo.icon size={18} color={colors.primary} />}
                <ThemedText style={{ fontSize: 16, fontWeight: 800, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channelName}</ThemedText>
                {channelInfo.verified && <CheckCircle2 size={16} color="#007AFF" fill="#007AFF15" />}
              </div>
              {channelInfo.viewType === 'support' && channelInfo.description ? (
                <ThemedText style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600 }}>{channelInfo.description}</ThemedText>
              ) : channelInfo.viewType !== 'events' ? (
                <ThemedText style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600 }}>
                  {t('chat_ui.members_count', {
                    count: isSystemChannel
                      ? (allUsersCount || 15)
                      : channelMembers.length
                  })}
                </ThemedText>
              ) : null}
            </div>
          </div>
          {(id?.startsWith('sg_') || id?.startsWith('group_')) && (isTeacherOrAdmin || activeGroupConference) && channelInfo.viewType !== 'events' && channelInfo.viewType !== 'support' && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              { }
              {activeGroupConference && !activeConference && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  backgroundColor: '#22c55e18',
                  border: '1px solid #22c55e40',
                  borderRadius: 20,
                  padding: '4px 10px 4px 7px',
                  marginRight: 4
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', backgroundColor: '#22c55e',
                    animation: 'livePulse 1.5s ease-in-out infinite'
                  }} />
                  <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
                    {t('conference.live_label')}
                  </span>
                </div>
              )}
              {(activeGroupConference || isTeacherOrAdmin) && (
                <button
                  title={activeGroupConference && !activeConference
                    ? t('conference.join_btn')
                    : t('conference.start_btn')
                  }
                  onClick={async () => {
                    if (!currentUser || !id) return;
                    if (activeGroupConference && !activeConference) {
                      setActiveConferenceId(activeGroupConference.id);
                      setActiveConference({
                        callId: activeGroupConference.id,
                        groupName: activeGroupConference.groupName,
                        groupPhoto: activeGroupConference.groupPhoto ?? null,
                        myUid: currentUser.uid,
                        myName: userProfile?.displayName || currentUser.displayName || 'User',
                        myPhoto: userProfile?.photoURL || currentUser.photoURL || null,
                        isInitiator: false, type: activeGroupConference.type
                      } as any);
                      return;
                    }
                    const members = channelMembers.length > 0 ? channelMembers : [currentUser.uid];
                    const participantData: Record<string, any> = {};
                    members.forEach(m => {
                      participantData[m] = {
                        name: m === currentUser.uid ? (userProfile?.displayName || currentUser.displayName || 'User') : 'Member',
                        photo: m === currentUser.uid ? (userProfile?.photoURL || currentUser.photoURL || null) : null
                      };
                    });
                    const callType = 'video';
                    const callId = await createConference(
                      cleanId, channelName || t('conference.group_fallback'), channelPhoto,
                      currentUser.uid,
                      userProfile?.displayName || currentUser.displayName || t('profile.username_placeholder'),
                      userProfile?.photoURL || currentUser.photoURL || null,
                      callType, members, participantData
                    );
                    setActiveConferenceId(callId);
                    setActiveConference({
                      callId, groupName: channelName || t('conference.group_fallback'), groupPhoto: channelPhoto,
                      myUid: currentUser.uid,
                      myName: userProfile?.displayName || currentUser.displayName || t('profile.username_placeholder'),
                      myPhoto: userProfile?.photoURL || currentUser.photoURL || null,
                      isInitiator: true, type: callType
                    } as any);
                  }}
                  style={{
                    backgroundColor: activeGroupConference && !activeConference ? '#22c55e' : colors.primary + '15',
                    border: 'none',
                    cursor: 'pointer',
                    color: activeGroupConference && !activeConference ? '#fff' : colors.primary,
                    height: 38,
                    padding: '0 16px',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                    fontWeight: 700,
                    fontSize: 13
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = activeGroupConference && !activeConference ? '#1da850' : colors.primary + '25';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = activeGroupConference && !activeConference ? '#22c55e' : colors.primary + '15';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <Video size={18} />
                  <span>{activeGroupConference && !activeConference ? t('conference.join_btn') : 'Conferencia'}</span>
                </button>
              )}
            </div>
          )}
          <style>{`
          @keyframes livePulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.7); }
          }
        `}</style>
          {channelInfo.viewType !== 'events' && channelInfo.viewType !== 'support' && (
            <>
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: colors.text,
                  width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Search size={22} color={isSearchOpen ? colors.primary : colors.text} />
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: colors.text,
                  width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Settings size={22} />
              </button>
            </>
          )}
        </div>

        {isSearchOpen && (
          <div style={{
            padding: `8px ${spacing.md}px`,
            backgroundColor: colors.backgroundSecondary,
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            animation: 'slideDown 0.2s ease-out'
          }}>
            <Search size={16} color={colors.textSecondary} />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat_ui.search_placeholder')}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: colors.text, fontSize: 14, padding: '4px 0'
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
                <Plus size={16} style={{ transform: 'rotate(45deg)' }} />
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {channelInfo.viewType === 'events' ? (
            <EventChannelView />
          ) : channelInfo.viewType === 'support' ? (
            <SoporteChannelView />
          ) : (
            <>
              {backgroundUrl && (
                <div style={{
                  position: 'absolute', inset: 0,
                  zIndex: 0,
                  backgroundImage: `url(${backgroundUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transform: customBackground ? `translate(${customBackground.x * 100}%, ${customBackground.y * 100}%) scale(${customBackground.scale})` : 'none',
                  pointerEvents: 'none'
                }} />
              )}

              <div
                ref={scrollRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column-reverse',
                  padding: `${spacing.md}px 0`,
                  position: 'relative',
                  zIndex: 1
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {filteredMessages.length === 0 && !loading && (
                    <div style={{ padding: spacing.xl, textAlign: 'center', opacity: 0.6 }}>
                      <ThemedText style={{ color: backgroundActive ? '#FFFFFF' : colors.text }}>
                        {searchQuery ? t('chat_ui.no_messages_found') : t('chat_ui.empty_state')}
                      </ThemedText>
                    </div>
                  )}
                  {[...filteredMessages].reverse().map((msg) => (
                    <div key={msg.id} id={`msg-${msg.id}`}>
                      <MessageBubble
                        message={msg}
                        isOwnMessage={msg.senderId === currentUser?.uid}
                        currentUserId={currentUser?.uid}
                        onReply={handleReply}
                        onLongPress={() => { }}
                        onDoubleTap={() => handleReaction('❤️', msg)}
                        onReplyPreviewPress={handleReplyPreviewPress}
                        highlighted={highlightedMessageId === msg.id}
                        onDelete={deleteMessage}
                        onReact={(id, emoji) => handleReaction(emoji, messages.find(m => m.id === id)!)}
                        onForward={handleForward}
                        channelId={id}
                        isSystem={isSystemChannel}
                        searchQuery={searchQuery}
                        onToggleStar={handleToggleStar}
                        isStarred={starredIds.has(msg.id)}
                        onVotePoll={(optId) => handleVotePoll(msg.id, optId)}
                        channelName={channelName || ''}
                        isReadOnlyChannel={isReadOnlyChannel}
                        backgroundActive={backgroundActive}
                        onUserClick={handleUserClick}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {showSettings && (
          <div style={{
            position: 'absolute', top: 60, right: 20, width: 350,
            backgroundColor: colors.card, border: `1px solid ${colors.border}`,
            borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 1000,
            padding: spacing.md,
            maxHeight: '80vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>{t('chat_ui.customize_title')}</ThemedText>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>

            {chatSettings.savedCustomBackgrounds && chatSettings.savedCustomBackgrounds.length > 0 && (
              <div style={{ marginBottom: spacing.lg }}>
                <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, display: 'block', marginBottom: spacing.sm }}>{t('chat_ui.your_backgrounds')}</ThemedText>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {chatSettings.savedCustomBackgrounds.map((bg, idx) => {
                    const isActive = customBackground?.url === bg.url;
                    return (
                      <button
                        key={idx}
                        onClick={() => setChatSettings({ customBackground: bg })}
                        style={{
                          aspectRatio: '1', borderRadius: 8,
                          backgroundColor: '#000',
                          backgroundImage: `url(${bg.url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          border: isActive ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                          cursor: 'pointer', position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {isActive && (
                          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={14} color="#FFF" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginBottom: spacing.lg }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, display: 'block', marginBottom: spacing.sm }}>{t('chat_ui.gallery_themes')}</ThemedText>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {Object.values(chatThemes).map(theme => {
                  const isPresetActive = !customBackground && chatSettings.themeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      onClick={() => {
                        setChatSettings({ themeId: theme.id, customBackground: null });
                      }}
                      title={theme.name}
                      style={{
                        aspectRatio: '1', borderRadius: 8, backgroundColor: theme.background,
                        backgroundImage: theme.backgroundImage ? `url(${theme.backgroundImage})` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        border: isPresetActive ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                        cursor: 'pointer', position: 'relative'
                      }}
                    >
                      {isPresetActive && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={14} color="#FFF" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: spacing.lg }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, display: 'block', marginBottom: spacing.sm }}>{t('chat_ui.custom_background')}</ThemedText>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => bgInputRef.current?.click()}
                  disabled={uploadingBg}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, backgroundColor: colors.backgroundSecondary,
                    border: customBackground ? `2px solid ${colors.primary}` : 'none',
                    color: colors.text, fontSize: 13, fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  {uploadingBg ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  {customBackground ? t('chat_ui.change_image') : t('chat_ui.upload_image')}
                </button>
                {customBackground && (
                  <button
                    onClick={removeBackground}
                    style={{
                      padding: '10px', borderRadius: 10, backgroundColor: colors.danger + '15',
                      border: 'none', color: colors.danger, cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <input type="file" ref={bgInputRef} onChange={handleBgChange} accept="image/*" style={{ display: 'none' }} />
            </div>

            <div style={{ padding: spacing.sm, borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
                <Type size={18} color={colors.primary} />
                <ThemedText style={{ fontSize: 14, fontWeight: 'bold' }}>{t('chat_ui.text_settings')}</ThemedText>
              </div>

              <div style={{ marginBottom: spacing.md }}>
                <ThemedText style={{ fontSize: 12, opacity: 0.6, display: 'block', marginBottom: 4 }}>{t('chat_ui.font_size')}</ThemedText>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[12, 14, 16, 18, 20].map(size => (
                    <button
                      key={size}
                      onClick={() => setChatSettings({ fontSize: size })}
                      style={{
                        flex: 1, padding: '4px', borderRadius: 6, border: 'none',
                        backgroundColor: chatSettings.fontSize === size ? colors.primary : 'transparent',
                        color: chatSettings.fontSize === size ? '#FFF' : colors.text,
                        cursor: 'pointer', fontSize: 11, fontWeight: 'bold',
                        transition: 'all 0.15s'
                      }}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setChatSettings({ fontWeight: chatSettings.fontWeight === 'bold' ? '400' : 'bold' })}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px', borderRadius: 8, border: 'none',
                    backgroundColor: chatSettings.fontWeight === 'bold' ? `${colors.primary}20` : 'transparent',
                    color: chatSettings.fontWeight === 'bold' ? colors.primary : colors.text,
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  <Bold size={16} />
                  <span style={{ fontSize: 12, fontWeight: 'bold' }}>{t('chat_ui.bold_symbol')}</span>
                </button>
                <button
                  onClick={() => setChatSettings({ fontStyle: chatSettings.fontStyle === 'italic' ? 'normal' : 'italic' })}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px', borderRadius: 8, border: 'none',
                    backgroundColor: chatSettings.fontStyle === 'italic' ? `${colors.primary}20` : 'transparent',
                    color: chatSettings.fontStyle === 'italic' ? colors.primary : colors.text,
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  <Italic size={16} />
                  <span style={{ fontSize: 12, fontStyle: 'italic' }}>{t('chat_ui.italic_symbol')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {editingBgImage && (
          <ChatBackgroundEditor
            imageUri={editingBgImage}
            onClose={() => setEditingBgImage(null)}
            onSave={handleSaveEditedBg}
          />
        )}

        {!channelInfo.viewType && (
          <div style={{ backgroundColor: colors.background, paddingBottom: 8 }}>
            <MessageInput
              ref={messageInputRef}
              onSend={handleSendMessage}
              onSendAudio={handleSendAudio}
              onSendMedia={handleSendMedia}
              onSendFile={(url, name, size) => handleSendMedia(url, 'file', name, size)}
              onSendPoll={handleSendPoll}
              replyTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              disabled={sending || isReadOnlyChannel}
              isReadOnly={isReadOnlyChannel}
            />
          </div>
        )}
        {loading && <ChatLoadingOverlay />}
      </div>

      {id && (
        <ChannelInfoModal
          isOpen={showChannelInfo}
          onClose={() => setShowChannelInfo(false)}
          channelId={id}
          channelName={channelName}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown { 
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      {forwardingMessage && (
        <ForwardModal
          message={forwardingMessage}
          onClose={() => setForwardingMessage(null)}
        />
      )}

      {selectedContact && (
        <ContactInfoModal
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
          user={selectedContact}
        />
      )}
    </ThemedView>
  );
}
