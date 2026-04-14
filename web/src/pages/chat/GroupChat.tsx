import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../../config/firebase';
import { doc, setDoc, getDoc, getDocs, serverTimestamp, collection, query, where, orderBy } from 'firebase/firestore';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import MessageBubble from '../../components/chat/MessageBubble';
import AudioRecorder from '../../components/chat/AudioRecorder';
import { PollModal } from '../../components/chat/PollModal';
import { uploadAudio, uploadChatImage, uploadChatFile } from '../../config/cloudinary';
import { CornerDownRight, X, Mic, ChevronsDown, ArrowLeft, Plus, Image, FileText, BarChart3, Users, LogOut, UserPlus, UserRound, Phone, Video, Bell, BellOff, Star, Trash2, Flag, Camera, ChevronRight, Bookmark, Download, Link as LinkIcon } from 'lucide-react';
import type { PollData } from '../../types';
import { useCall } from '../../contexts/CallContext';
import { createGroupCall, type CallType } from '../../services/firebase/groupCallService';
import {
  subscribeToGroupMessages,
  subscribeToGroupInfo,
  sendGroupMessage,
  markGroupAsRead,
  toggleGroupReaction,
  deleteGroupMessageForMe,
  deleteGroupMessageForAll,
  leaveGroup,
  addMembersToGroup,
  updateGroupInfo,
  clearGroupChatForUser,
  reportGroup,
  deleteGroupConversation,
  kickMemberFromGroup,
  type GroupConversation,
  type GroupMessage,
} from '../../services/firebase/groupDMService';
import { getFriends } from '../../services/firebase/friendsService';
import { saveMessage, unsaveMessage, subscribeToSavedMessages, type SavedMessage } from '../../services/firebase/savedItemsService';
import { MESSAGE_TONE_NAMES, previewTone } from '../../utils/toneGenerator';
import SharePostModal from '../../components/SharePostModal';
import ContactPickerModal, { type ContactData } from '../../components/ContactPickerModal';
import { useTranslation } from '../../hooks/useTranslation';

function getLuminance(hex: string): number {
  if (!hex || !hex.startsWith('#')) return 1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function replyPreviewText(msg: GroupMessage, t: (key: string, options?: any) => string): string {
  if (msg.text?.trim()) return msg.text.trim().substring(0, 40);
  const type = msg.attachments?.[0]?.type;
  if (type === 'image') return `📷 ${t('chat.image')}`;
  if (type === 'audio') return `🎵 ${t('chat.voice_message')}`;
  if (type === 'file') return `📎 ${msg.attachments![0].name || t('common.file')}`;
  if (type === 'contact') return `👤 ${msg.attachments![0].name || t('common.contact')}`;
  return '';
}

function replyAttachmentType(msg: GroupMessage): string | undefined {
  const type = msg.attachments?.[0]?.type as string | undefined;
  if (type === 'image' || type === 'audio' || type === 'file' || type === 'contact') return type;
  return undefined;
}

interface ThemeStyle { bg: string; border: string; text: string; }

function MessageInput({
  onSend, onSendAudio, onSendAttachment, onSendPoll, onSendContact,
  disabled, replyingTo, onCancelReply, themeStyle, showRecorder, setShowRecorder,
}: {
  onSend: (text: string) => void;
  onSendAudio: (blob: Blob, duration: number) => void;
  onSendAttachment: (file: File, type: 'image' | 'file') => void;
  onSendPoll: (poll: Omit<PollData, 'votes'>) => void;
  onSendContact: (contact: ContactData) => void;
  disabled?: boolean;
  replyingTo?: any;
  onCancelReply?: () => void;
  themeStyle?: ThemeStyle;
  showRecorder: boolean;
  setShowRecorder: (v: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const { colors } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (text.trim() && !disabled) { onSend(text.trim()); setText(''); textareaRef.current?.focus(); }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const { t: tMsg } = useTranslation();
  const attachItems = [
    { label: tMsg('chat.photos'), icon: <Image size={22} color="#5856D6" />, bg: '#5856D622', action: () => { setShowAttachMenu(false); imageInputRef.current?.click(); } },
    { label: tMsg('chat.document'), icon: <FileText size={22} color="#007AFF" />, bg: '#007AFF22', action: () => { setShowAttachMenu(false); fileInputRef.current?.click(); } },
    { label: tMsg('chat.poll_label'), icon: <BarChart3 size={22} color="#FF2D55" />, bg: '#FF2D5522', action: () => { setShowAttachMenu(false); setShowPoll(true); } },
    { label: tMsg('chat.contact_label'), icon: <UserRound size={22} color="#34C759" />, bg: '#34C75922', action: () => { setShowAttachMenu(false); setShowContactPicker(true); } },
  ];

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {showAttachMenu && (
        <>
          <div onClick={() => setShowAttachMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div className="animate-slide-up" style={{ position: 'absolute', bottom: '100%', left: 8, zIndex: 50, backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '12px 16px', display: 'flex', gap: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.18)', marginBottom: 6 }}>
            {attachItems.map(item => (
              <button key={item.label} onClick={item.action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</div>
                <span style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 500 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onSendAttachment(f, 'image'); e.target.value = ''; }} />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onSendAttachment(f, 'file'); e.target.value = ''; }} />
      <PollModal visible={showPoll} onClose={() => setShowPoll(false)} onSend={onSendPoll} />
      <ContactPickerModal visible={showContactPicker} onClose={() => setShowContactPicker(false)} onSelect={contact => { onSendContact(contact); setShowContactPicker(false); }} />
      {replyingTo && (
        <div className="animate-slide-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', backgroundColor: themeStyle ? themeStyle.border : colors.backgroundSecondary, borderTop: `1px solid ${themeStyle ? themeStyle.border : colors.border}`, fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CornerDownRight size={16} color={themeStyle ? themeStyle.text : colors.primary} />
            <span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.primary, fontWeight: '600' }}>{replyingTo.senderName}</span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.textSecondary, opacity: 0.7, marginLeft: '8px' }}>{replyPreviewText(replyingTo, tMsg)}</span>
            </span>
          </div>
          <button onClick={onCancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeStyle ? themeStyle.text : colors.textSecondary, display: 'flex', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
      )}
      <div className="chat-input-container" style={themeStyle ? { backgroundColor: themeStyle.bg, borderTop: `1px solid ${themeStyle.border}` } : {}}>
        {showRecorder ? (
          <AudioRecorder onSend={(blob, duration) => { onSendAudio(blob, duration); setShowRecorder(false); }} onCancel={() => setShowRecorder(false)} />
        ) : (
          <>
            <button onClick={() => setShowAttachMenu(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showAttachMenu ? colors.primary : colors.textSecondary, flexShrink: 0, transition: 'color 0.2s ease' }} title={tMsg('chat.attach')}>
              <Plus size={22} strokeWidth={2} style={{ transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)', transform: showAttachMenu ? 'rotate(45deg)' : 'rotate(0deg)' }} />
            </button>
            <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown} placeholder={replyingTo ? tMsg('chat.reply_to', { name: replyingTo.senderName }) : tMsg('chat.type_message')} className="chat-textarea" style={themeStyle ? { color: themeStyle.text, backgroundColor: 'transparent' } : {}} disabled={disabled} rows={1} />
            <button onClick={() => setShowRecorder(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, padding: '8px', display: 'flex', alignItems: 'center' }} title={tMsg('chat.record_audio')}>
              <Mic size={20} />
            </button>
            <button onClick={handleSend} disabled={!text.trim() || disabled} className="chat-send-button btn-press">
              <div className="chat-send-icon" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

type MuteDuration = 'off' | '8h' | '1w' | 'always';
type InfoSubPanel = null | 'starred' | 'addMember' | 'mute' | 'tone' | 'report' | 'media';

function GroupInfoPanel({
  group, currentUserId, colors, onClose, onLeave, onDeleteGroup,
}: {
  group: GroupConversation;
  currentUserId: string;
  colors: any;
  onClose: () => void;
  onLeave: () => void;
  onDeleteGroup: () => void;
}) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [panelWidth, setPanelWidth] = useState(360);
  const dragRef = useRef<{ active: boolean; startX: number; startWidth: number }>({ active: false, startX: 0, startWidth: 360 });
  const [subPanel, setSubPanel] = useState<InfoSubPanel>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [mute, setMute] = useState<MuteDuration>('off');
  const [tone, setTone] = useState<string>(t('settings.alert_tones.default'));

  const [starred, setStarred] = useState<SavedMessage[]>([]);

  const [friends, setFriends] = useState<{ id: string; name: string; photo: string | null }[]>([]);
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [addingLoading, setAddingLoading] = useState(false);

  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);

  const [sharedFiles, setSharedFiles] = useState<{ messageId: string; url: string; name: string; size: number; type: 'image' | 'file' | 'audio' }[]>([]);
  const [sharedLinks, setSharedLinks] = useState<{ messageId: string; url: string; text: string }[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [sharedMediaCount, setSharedMediaCount] = useState(0);

  const isCreator = group.createdBy === currentUserId;
  const settingsKey = `group_${group.id}`;
  const close = () => { setClosing(true); setTimeout(onClose, 240); };

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const delta = dragRef.current.startX - e.clientX;
      setPanelWidth(Math.min(600, Math.max(280, dragRef.current.startWidth + delta)));
    };
    const onUp = () => { dragRef.current.active = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    getDoc(doc(db, 'users', currentUserId, 'contactSettings', settingsKey)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setMute(d.mute ?? 'off');
      setTone(d.alertTone ?? t('settings.alert_tones.default'));
    }).catch(() => {});

    getDocs(collection(db, 'groupConversations', group.id, 'messages')).then(snap => {
      let count = 0;
      snap.docs.forEach(d => {
        const atts = d.data().attachments;
        if (Array.isArray(atts)) count += atts.filter((a: any) => a.type === 'image' || a.type === 'file' || a.type === 'audio').length;
      });
      setSharedMediaCount(count);
    }).catch(() => {});
  }, [currentUserId, settingsKey, group.id, t]);

  const saveSetting = async (partial: Record<string, any>) => {
    await setDoc(doc(db, 'users', currentUserId, 'contactSettings', settingsKey), { ...partial, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  };

  const handleMute = async (val: MuteDuration) => {
    setMute(val);
    setSubPanel(null);
    await saveSetting({ mute: val, muted: val !== 'off' });
  };

  const handleTone = async (val: string) => {
    setTone(val);
    previewTone(val);
    await saveSetting({ alertTone: val });
  };

  const loadStarred = () => {
    const channelId = `group/${group.id}`;
    subscribeToSavedMessages(currentUserId, msgs => {
      setStarred(msgs.filter(m => m.originalChannelId === channelId));
    });
  };

  const loadFriends = async () => {
    const all = await getFriends(currentUserId).catch(() => []);
    setFriends((all as any[]).filter((f: any) => !group.members.includes(f.id)).map((f: any) => ({ id: f.id, name: f.displayName || f.name || t('common.user'), photo: f.photoURL || null })));
  };

  const handleOpenAddMember = () => { loadFriends(); setSubPanel('addMember'); };
  const handleOpenStarred = () => { loadStarred(); setSubPanel('starred'); };

  const openMediaPanel = async () => {
    setSubPanel('media');
    if (sharedFiles.length > 0 || sharedLinks.length > 0) return;
    setLoadingMedia(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'groupConversations', group.id, 'messages'),
        orderBy('createdAt', 'desc')
      ));
      const files: typeof sharedFiles = [];
      const links: typeof sharedLinks = [];
      const URL_REGEX = /https?:\/\/[^\s]+/g;
      snap.docs.forEach(d => {
        const data = d.data();
        if (Array.isArray(data.attachments)) {
          data.attachments.forEach((a: any) => {
            if (a.type === 'image' || a.type === 'file' || a.type === 'audio') {
              files.push({ messageId: d.id, url: a.url, name: a.name || t('common.file'), size: a.size || 0, type: a.type });
            }
          });
        }
        if (data.text) {
          const found = (data.text as string).match(URL_REGEX);
          if (found) found.forEach((url: string) => links.push({ messageId: d.id, url, text: data.text.length > 60 ? data.text.slice(0, 60) + '…' : data.text }));
        }
      });
      setSharedFiles(files);
      setSharedLinks(links);
    } catch {} finally { setLoadingMedia(false); }
  };

  const downloadFile = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch { window.open(url, '_blank'); }
  };

  const toggleAdd = (id: string) => {
    setAddingIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleAddMembers = async () => {
    if (addingIds.size === 0) return;
    setAddingLoading(true);
    const toAdd = friends.filter(f => addingIds.has(f.id));
    await addMembersToGroup(group.id, toAdd).catch(() => {});
    setAddingIds(new Set());
    setAddingLoading(false);
    setSubPanel(null);
  };

  const handleClearChat = async () => {
    if (!window.confirm(t('dm.group.clear_chat_confirm'))) return;
    await clearGroupChatForUser(group.id, currentUserId).catch(() => {});
  };

  const handleSendReport = async () => {
    if (!reportReason.trim()) return;
    await reportGroup(group.id, currentUserId, reportReason.trim()).catch(() => {});
    setReportSent(true);
  };

  const handleKickMember = async (memberId: string, memberName: string) => {
    if (!window.confirm(t('dm.group.kick_member_confirm', { name: memberName }))) return;
    await kickMemberFromGroup(group.id, memberId).catch(() => {});
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(t('dm.group.delete_group_confirm'))) return;
    await deleteGroupConversation(group.id).catch(() => {});
    onDeleteGroup();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadChatImage(file, `group_${group.id}_photo`);
      await updateGroupInfo(group.id, group.name, url);
    } catch {} finally { setUploadingPhoto(false); e.target.value = ''; }
  };

  const memberList = group.members.map(id => ({
    id, name: group.memberNames[id] || t('common.user'),
    photo: group.memberPhotos[id] || null,
    isCreator: id === group.createdBy,
  }));

  const muteDurationLabel: Record<MuteDuration, string> = {
    off: t('dm.info.mute_duration.off'),
    '8h': t('dm.info.mute_duration.8h'),
    '1w': t('dm.info.mute_duration.1w'),
    always: t('dm.info.mute_duration.always'),
  };

  const actionRow = (icon: React.ReactNode, label: string, onClick: () => void, color = colors.text, badge?: string) => (
    <button
      key={label}
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <span style={{ color, display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color }}>{label}</span>
      {badge && <span style={{ fontSize: 13, color: colors.textSecondary, marginRight: 4 }}>{badge}</span>}
      <ChevronRight size={16} color={colors.textSecondary} />
    </button>
  );

  return (
    <>
      <style>{`
        @keyframes ch-backdrop-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes ch-backdrop-out { from { opacity: 1 } to { opacity: 0 } }
        @keyframes ch-slide-in  { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes ch-slide-out { from { transform: translateX(0) } to { transform: translateX(100%) } }
        .ch-backdrop      { animation: ch-backdrop-in  0.22s ease both; }
        .ch-backdrop.out  { animation: ch-backdrop-out 0.22s ease both; }
        .ch-panel         { animation: ch-slide-in  0.28s cubic-bezier(0.32,0.72,0,1) both; }
        .ch-panel.out     { animation: ch-slide-out 0.24s cubic-bezier(0.32,0.72,0,1) both; }
        .ch-panel-scroll::-webkit-scrollbar { width: 5px; }
        .ch-panel-scroll::-webkit-scrollbar-track { background: transparent; }
        .ch-panel-scroll::-webkit-scrollbar-thumb { background: rgba(128,128,128,0.35); border-radius: 4px; }
        .ch-panel-scroll::-webkit-scrollbar-thumb:hover { background: rgba(128,128,128,0.6); }
      `}</style>
      <div className={`ch-backdrop${closing ? ' out' : ''}`} onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 998, backgroundColor: 'rgba(0,0,0,0.35)' }} />
      <div className={`ch-panel${closing ? ' out' : ''}`} style={{ position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 999, width: isMobile ? '100%' : panelWidth, backgroundColor: colors.background, borderLeft: isMobile ? 'none' : `1px solid ${colors.border}`, boxShadow: '-4px 0 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!isMobile && (
          <div onMouseDown={e => { dragRef.current = { active: true, startX: e.clientX, startWidth: panelWidth }; document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none'; }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, cursor: 'ew-resize', zIndex: 10 }} />
        )}
        <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{t('chat.group_info_title')}</span>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}>
            <X size={20} color={colors.textSecondary} />
          </button>
        </div>

        <div className="ch-panel-scroll" style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 24px', gap: 12, borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 84, height: 84, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                {group.photoURL
                  ? <img src={group.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Users size={36} color="#fff" />}
              </div>
              {isCreator && (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', backgroundColor: colors.primary, border: `2px solid ${colors.background}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  {uploadingPhoto
                    ? <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                    : <Camera size={13} color="#fff" strokeWidth={2.5} />}
                </button>
              )}
            </div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 20, color: colors.text }}>{group.name || t('common.group')}</p>
            <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>{t('chat.members_count', { count: String(group.members.length) })}</p>
          </div>

          <div style={{ borderBottom: `1px solid ${colors.border}` }}>
            {actionRow(<Image size={20} />, t('dm.info.files_links_docs'), openMediaPanel, colors.text, sharedMediaCount > 0 ? String(sharedMediaCount) : undefined)}
            {actionRow(<Bookmark size={20} />, t('dm.group.starred_messages'), handleOpenStarred)}
            {actionRow(
              mute !== 'off' ? <BellOff size={20} /> : <Bell size={20} />,
              t('dm.group.mute_notifications'),
              () => setSubPanel('mute'),
              colors.text,
              mute !== 'off' ? muteDurationLabel[mute] : undefined,
            )}
            {actionRow(<Bell size={20} />, t('dm.group.alert_tone'), () => setSubPanel('tone'), colors.text, tone !== t('settings.alert_tones.default') ? tone : undefined)}
          </div>

          <div style={{ padding: '16px 20px 8px' }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('dm.group.members_short')}
            </p>
            {memberList.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                  {m.photo ? <img src={m.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text }}>{m.name}{m.id === currentUserId ? ` (${t('common.you').toLowerCase()})` : ''}</p>
                </div>
                {m.isCreator && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: colors.primary, backgroundColor: `${colors.primary}22`, padding: '2px 8px', borderRadius: 20 }}>
                    Admin
                  </span>
                )}
                {isCreator && !m.isCreator && (
                  <button
                    onClick={() => handleKickMember(m.id, m.name)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', color: '#FF3B30', flexShrink: 0 }}
                    title={t('dm.group.kick_member_confirm', { name: m.name })}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FF3B3012')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <X size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            ))}
            {isCreator && (
              <button
                onClick={handleOpenAddMember}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', marginTop: 4 }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <UserPlus size={18} color={colors.primary} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: colors.primary }}>{t('dm.group.add_member')}</span>
              </button>
            )}
          </div>

          <div style={{ padding: '8px 0 40px', borderTop: `1px solid ${colors.border}`, marginTop: 8 }}>
            <button
              onClick={handleClearChat}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#FF9500', fontSize: 15, fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Trash2 size={20} />
              {t('dm.group.clear_chat')}
            </button>
            <button
              onClick={() => setSubPanel('report')}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#FF9500', fontSize: 15, fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Flag size={20} />
              {t('dm.group.report_group')}
            </button>
            {!isCreator && (
              <button
                onClick={onLeave}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', fontSize: 15, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <LogOut size={20} />
                {t('dm.group.leave_group')}
              </button>
            )}
            {isCreator && (
              <button
                onClick={handleDeleteGroup}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', fontSize: 15, fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Trash2 size={20} />
                {t('dm.group.delete_group')}
              </button>
            )}
          </div>

        </div>

        {subPanel === 'media' && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, zIndex: 5, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
              <button onClick={() => setSubPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                <ArrowLeft size={20} color={colors.text} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{t('dm.info.files_links_docs')}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingMedia ? (
                <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>{t('common.loading')}</div>
              ) : (
                <>
                  {sharedFiles.length > 0 && (
                      <div>
                        <div style={{ padding: '12px 20px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary }}>
                          {t('dm.info.files_count', { count: sharedFiles.length })}
                        </div>
                        {sharedFiles.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${colors.border}` }}>
                            <a href={f.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textDecoration: 'none' }}>
                              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                                {f.type === 'image'
                                  ? <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <FileText size={20} color={colors.primary} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                                <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{(f.size / 1024).toFixed(0)} KB</div>
                              </div>
                            </a>
                            <button
                              onClick={() => downloadFile(f.url, f.name)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 8, flexShrink: 0 }}
                              title={t('common.download')}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <Download size={16} color={colors.textSecondary} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {sharedLinks.length > 0 && (
                      <div>
                        <div style={{ padding: '12px 20px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary }}>
                          {t('dm.info.links_count', { count: sharedLinks.length })}
                        </div>
                        {sharedLinks.map((l, i) => (
                          <a key={i} href={l.url} target="_blank" rel="noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', textDecoration: 'none', borderBottom: `1px solid ${colors.border}` }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <LinkIcon size={18} color={colors.primary} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: colors.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url}</div>
                              <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.text}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                    {sharedFiles.length === 0 && sharedLinks.length === 0 && (
                      <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>{t('dm.info.no_shared_files')}</div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

        {subPanel === 'starred' && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, zIndex: 5, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
              <button onClick={() => setSubPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, display: 'flex', padding: 4 }}><ArrowLeft size={22} /></button>
              <span style={{ fontWeight: 700, fontSize: 17, color: colors.text }}>{t('dm.group.starred_messages')}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {starred.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: colors.textSecondary, fontSize: 14 }}>{t('dm.group.no_starred')}</div>
              ) : starred.map(m => (
                <div key={m.id} style={{ padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: colors.primary, marginBottom: 4 }}>{m.senderName}</div>
                  <div style={{ fontSize: 14, color: colors.text, lineHeight: '20px' }}>{m.text || (m.attachments?.[0] ? '📎 ' + t('common.attachment') : '')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {subPanel === 'addMember' && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, zIndex: 5, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
              <button onClick={() => setSubPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, display: 'flex', padding: 4 }}><ArrowLeft size={22} /></button>
              <span style={{ fontWeight: 700, fontSize: 17, color: colors.text, flex: 1 }}>{t('dm.group.add_member')}</span>
              <button
                onClick={handleAddMembers}
                disabled={addingIds.size === 0 || addingLoading}
                style={{ padding: '6px 14px', borderRadius: 20, border: 'none', backgroundColor: addingIds.size > 0 ? colors.primary : 'transparent', color: addingIds.size > 0 ? '#fff' : colors.textSecondary, fontWeight: 700, fontSize: 14, cursor: addingIds.size > 0 ? 'pointer' : 'default' }}
              >{t('common.add')}</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {friends.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: colors.textSecondary, fontSize: 14 }}>{t('dm.group.no_friends_to_add')}</div>
              ) : friends.map(f => (
                <button
                  key={f.id}
                  onClick={() => toggleAdd(f.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {f.photo ? <img src={f.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : f.name[0]?.toUpperCase()}
                  </div>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: colors.text }}>{f.name}</span>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${addingIds.has(f.id) ? colors.primary : colors.border}`, backgroundColor: addingIds.has(f.id) ? colors.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {addingIds.has(f.id) && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {subPanel === 'mute' && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, zIndex: 5, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
              <button onClick={() => setSubPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, display: 'flex', padding: 4 }}><ArrowLeft size={22} /></button>
              <span style={{ fontWeight: 700, fontSize: 17, color: colors.text }}>{t('dm.group.mute_notifications')}</span>
            </div>
            {(['off', '8h', '1w', 'always'] as MuteDuration[]).map(d => (
              <button key={d} onClick={() => handleMute(d)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `1px solid ${colors.border}` }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: 15, color: colors.text }}>{muteDurationLabel[d]}</span>
                {mute === d && <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: colors.primary, display: 'inline-block' }} />}
              </button>
            ))}
          </div>
        )}

        {subPanel === 'tone' && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, zIndex: 5, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0, position: 'sticky', top: 0, backgroundColor: colors.background, zIndex: 1 }}>
              <button onClick={() => setSubPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, display: 'flex', padding: 4 }}><ArrowLeft size={22} /></button>
              <span style={{ fontWeight: 700, fontSize: 17, color: colors.text }}>{t('dm.group.alert_tone')}</span>
            </div>
            {MESSAGE_TONE_NAMES.map(name => (
              <button key={name} onClick={() => handleTone(name)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: 15, color: colors.text }}>{name}</span>
                {tone === name && <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: colors.primary, display: 'inline-block' }} />}
              </button>
            ))}
          </div>
        )}

        {subPanel === 'report' && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, zIndex: 5, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
              <button onClick={() => setSubPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, display: 'flex', padding: 4 }}><ArrowLeft size={22} /></button>
              <span style={{ fontWeight: 700, fontSize: 17, color: colors.text }}>{t('dm.group.report_group')}</span>
            </div>
            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
              {reportSent ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: colors.textSecondary, fontSize: 15 }}>{t('dm.group.report_sent')}</div>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: 14, color: colors.textSecondary, lineHeight: '20px' }}>{t('dm.group.report_desc')}</p>
                  <textarea
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    placeholder={t('dm.group.report_placeholder')}
                    rows={5}
                    style={{ padding: '12px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none' }}
                  />
                  <button
                    onClick={handleSendReport}
                    disabled={!reportReason.trim()}
                    style={{ padding: '13px', borderRadius: 12, border: 'none', backgroundColor: reportReason.trim() ? '#FF3B30' : colors.backgroundSecondary, color: reportReason.trim() ? '#fff' : colors.textSecondary, fontWeight: 700, fontSize: 15, cursor: reportReason.trim() ? 'pointer' : 'default' }}
                  >{t('dm.group.send_report')}</button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}

export default function GroupChat() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const isDesktop = useWindowSize();
  const chatTheme = colors.chat;

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [group, setGroup] = useState<GroupConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [forwardMessage, setForwardMessage] = useState<any>(null);

  const { setActiveGroupCall, setActiveGroupCallId } = useCall();
  const { t } = useTranslation();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    import('firebase/firestore').then(({ doc, getDoc }) => {
      import('../../config/firebase').then(({ db }) => {
        getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
          if (snap.exists()) setUserData(snap.data());
        }).catch(() => {});
      });
    });
  }, [currentUser]);

  useEffect(() => {
    if (!groupId) return;
    return subscribeToGroupInfo(groupId, g => {
      setGroup(g);
      if (!g) navigate('/messages');
    });
  }, [groupId, navigate]);

  useEffect(() => {
    if (!groupId || !currentUser) return;
    const unsub = subscribeToGroupMessages(groupId, currentUser.uid, msgs => {
      setMessages(msgs);
      setLoading(false);
      markGroupAsRead(groupId, currentUser.uid).catch(() => {});
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
    });
    return unsub;
  }, [groupId, currentUser]);

  useEffect(() => {
    if (!currentUser || !groupId) return;
    const channelId = `group/${groupId}`;
    const unsub = subscribeToSavedMessages(currentUser.uid, msgs => {
      setSavedIds(new Set(msgs.filter(m => m.originalChannelId === channelId).map(m => m.id)));
    });
    return () => unsub();
  }, [currentUser, groupId]);

  const handleSave = async (message: any) => {
    if (!currentUser || !groupId) return;
    const channelId = `group/${groupId}`;
    if (savedIds.has(message.id)) {
      await unsaveMessage(currentUser.uid, message.id).catch(() => {});
    } else {
      await saveMessage(currentUser.uid, {
        id: message.id,
        text: message.text,
        senderName: message.senderName,
        senderId: message.senderId,
        originalChannelId: channelId,
        chatType: 'group',
        attachments: message.attachments,
      }, channelId).catch(() => {});
    }
  };

  const handleSend = async (text: string) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      let replyData: { id: string; senderName: string; text: string; attachmentType?: string } | null = null;
      if (replyingTo) {
        const attachmentType = replyAttachmentType(replyingTo);
        replyData = {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          text: replyingTo.text || '',
        };
        if (attachmentType !== undefined) {
          replyData.attachmentType = attachmentType;
        }
      }
      await sendGroupMessage(groupId, currentUser.uid, userData?.displayName || currentUser.displayName || t('common.user'), userData?.photoURL || currentUser.photoURL || null, text, null, replyData);
      setReplyingTo(null);
    } catch {} finally { setSending(false); }
  };

  const handleSendAudio = async (blob: Blob, duration: number) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      const url = await uploadAudio(blob, `group_${groupId}_${Date.now()}`);
      await sendGroupMessage(groupId, currentUser.uid, userData?.displayName || currentUser.displayName || t('common.user'), userData?.photoURL || currentUser.photoURL || null, '', [{ url, type: 'audio', name: 'audio.webm', size: blob.size, duration }]);
      setShowRecorder(false);
    } catch {} finally { setSending(false); }
  };

  const handleSendAttachment = async (file: File, type: 'image' | 'file') => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      const url = type === 'image' ? await uploadChatImage(file, `group_${groupId}_${Date.now()}`) : await uploadChatFile(file, `group_${groupId}_${Date.now()}`);
      await sendGroupMessage(groupId, currentUser.uid, userData?.displayName || currentUser.displayName || t('common.user'), userData?.photoURL || currentUser.photoURL || null, '', [{ url, type, name: file.name, size: file.size }]);
    } catch {} finally { setSending(false); }
  };

  const handleSendPoll = async (poll: Omit<PollData, 'totalVotes'>) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      const pollData = {
        question: poll.question,
        options: (poll.options as any[]).map((opt: any, i: number) => ({
          id: String(i),
          text: typeof opt === 'string' ? opt : opt.text,
          votes: [],
        })),
        multipleAnswers: poll.multipleAnswers,
        totalVotes: 0,
        closed: false,
      };
      await sendGroupMessage(groupId, currentUser.uid, userData?.displayName || currentUser.displayName || t('common.user'), userData?.photoURL || currentUser.photoURL || null, poll.question, null, null, pollData);
    } catch {} finally { setSending(false); }
  };

  const handleSendContact = async (contact: ContactData) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      await sendGroupMessage(groupId, currentUser.uid, userData?.displayName || currentUser.displayName || t('common.user'), userData?.photoURL || currentUser.photoURL || null, `👤 ${contact.name}`, [{ type: 'contact', url: contact.photo ?? '', name: contact.name, size: 0, bio: contact.bio, userId: contact.userId }]);
    } catch {} finally { setSending(false); }
  };

  const handleReact = async (message: any, emoji: string) => {
    if (!groupId || !currentUser) return;
    await toggleGroupReaction(groupId, message.id, emoji, currentUser.uid).catch(() => {});
  };

  const handleDelete = async (message: any, forEveryone: boolean) => {
    if (!groupId || !currentUser) return;
    if (!window.confirm(forEveryone ? t('chat.delete_confirm_for_all') : t('chat.delete_confirm_for_me'))) return;
    if (forEveryone) {
      await deleteGroupMessageForAll(groupId, message.id).catch(() => {});
    } else {
      await deleteGroupMessageForMe(groupId, message.id, currentUser.uid).catch(() => {});
    }
  };

  const handleStartGroupCall = async (type: CallType) => {
    if (!currentUser || !group) return;
    const participantData: Record<string, { name: string; photo: string | null }> = {};
    for (const uid of group.members) {
      participantData[uid] = { name: group.memberNames[uid] || t('common.user'), photo: group.memberPhotos[uid] || null };
    }
    try {
      const callId = await createGroupCall(
        group.id,
        group.name,
        group.photoURL,
        currentUser.uid,
        userData?.displayName || currentUser.displayName || t('common.user'),
        userData?.photoURL || currentUser.photoURL || null,
        type,
        group.members,
        participantData
      );
      setActiveGroupCall({
        callId,
        isInitiator: true,
        type,
        groupName: group.name,
        groupPhoto: group.photoURL,
        myUid: currentUser.uid,
        myName: userData?.displayName || currentUser.displayName || t('common.user'),
        myPhoto: userData?.photoURL || currentUser.photoURL || null,
      });
      setActiveGroupCallId(callId);
    } catch {}
  };

  const handleLeave = async () => {
    if (!groupId || !currentUser) return;
    if (!window.confirm(t('chat.leave_group_confirm'))) return;
    await leaveGroup(groupId, currentUser.uid).catch(() => {});
    navigate('/messages');
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 120);
  };

  const handleScrollToMessage = (messageId: string) => {
    const el = messagesContainerRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const isCustomTheme = chatTheme.id?.startsWith('custom_');
  const isNonDefaultTheme = colors.chatSettings.themeId !== 'default';
  const useThemeStyling = isDesktop && isNonDefaultTheme;
  const themeIsLight = getLuminance(chatTheme.background) > 0.55;
  const themeTextColor = themeIsLight ? '#1C1C1E' : '#FFFFFF';
  const themeBorderColor = themeIsLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const desktopThemeStyle: ThemeStyle | undefined = (useThemeStyling && !isCustomTheme)
    ? { bg: chatTheme.background, border: themeBorderColor, text: themeTextColor }
    : undefined;

  const backgroundStyles: React.CSSProperties = isCustomTheme
    ? { position: 'relative' }
    : isDesktop
      ? { backgroundColor: chatTheme.background }
      : {
          backgroundImage: chatTheme.backgroundImage ? `url(${chatTheme.backgroundImage})` : 'none',
          backgroundColor: chatTheme.background,
          backgroundSize: 'cover', backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed',
        };

  const customBgOverlay = isCustomTheme && chatTheme.backgroundImage ? (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
      <img src={chatTheme.backgroundImage} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${chatTheme.offsetX || 0}px, ${chatTheme.offsetY || 0}px) scale(${chatTheme.scale || 1})`, transformOrigin: 'center', pointerEvents: 'none' }} />
    </div>
  ) : null;

  const groupName = group?.name || t('common.group');
  const memberCount = group?.members.length ?? 0;

  if (loading) {
    return (
      <div className="chat-loading-container animate-fade-in" style={{ ...backgroundStyles, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {customBgOverlay}
        <div className="chat-header" style={{ backgroundColor: desktopThemeStyle ? desktopThemeStyle.bg : 'var(--background)', borderBottom: `1px solid ${desktopThemeStyle ? desktopThemeStyle.border : 'var(--border)'}` }}>
          <button className="chat-back-button" style={{ color: desktopThemeStyle ? desktopThemeStyle.text : colors.text }} onClick={() => navigate('/messages')}>←</button>
          <h1 className="chat-header-title" style={{ color: desktopThemeStyle ? desktopThemeStyle.text : colors.text }}>{groupName}</h1>
        </div>
        <div className="chat-loading-content"><div className="loading-spinner" /></div>
      </div>
    );
  }

  return (
    <div className="chat-loading-container animate-fade-in" style={{ ...backgroundStyles, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {customBgOverlay}

      <div className="chat-header" style={{ backgroundColor: desktopThemeStyle ? desktopThemeStyle.bg : 'var(--background)', borderBottom: `1px solid ${desktopThemeStyle ? desktopThemeStyle.border : 'var(--border)'}`, zIndex: 10, position: 'relative' }}>
        <button className="chat-back-button" style={{ color: desktopThemeStyle ? desktopThemeStyle.text : colors.text }} onClick={() => navigate('/messages')}>
          <ArrowLeft size={22} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setShowInfoPanel(v => !v)}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {group?.photoURL
              ? <img src={group.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Users size={18} color="#fff" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: desktopThemeStyle ? desktopThemeStyle.text : colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {groupName}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: desktopThemeStyle ? desktopThemeStyle.text : colors.textSecondary, opacity: 0.7 }}>
              {t('chat.members_count', { count: String(memberCount) })}
            </p>
          </div>
        </div>

        <button
          onClick={() => handleStartGroupCall('audio')}
          className="chat-back-button"
          style={{ color: desktopThemeStyle ? desktopThemeStyle.text : colors.text }}
          title={t('call.audio_call')}
        >
          <Phone size={20} />
        </button>
        <button
          onClick={() => handleStartGroupCall('video')}
          className="chat-back-button"
          style={{ color: desktopThemeStyle ? desktopThemeStyle.text : colors.text }}
          title={t('call.video_call')}
        >
          <Video size={20} />
        </button>
        <button className="chat-back-button" onClick={() => setShowInfoPanel(v => !v)} style={{ color: desktopThemeStyle ? desktopThemeStyle.text : colors.text }}>
          <Users size={20} color={showInfoPanel ? colors.primary : undefined} />
        </button>
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="chat-messages-container"
        style={{ flex: 1, overflowY: 'auto', backgroundColor: 'transparent', position: 'relative', zIndex: 1 }}
      >
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <p className="chat-empty-text" style={{ backgroundColor: 'rgba(255,255,255,0.8)', padding: '12px', borderRadius: '8px' }}>
              {t('chat.no_messages_group')}
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg as any}
              isOwnMessage={msg.senderId === currentUser?.uid}
              isAdmin={userData?.role === 'admin'}
              chatId={groupId}
              isConversation={false}
              chatCollection="groupConversations"
              isSaved={savedIds.has(msg.id)}
              onReply={m => setReplyingTo(m)}
              onDelete={handleDelete}
              onForward={(msg: any) => setForwardMessage(msg)}
              onReact={handleReact}
              onCopy={text => navigator.clipboard.writeText(text)}
              onScrollToMessage={handleScrollToMessage}
              onAudioReply={m => { setReplyingTo(m); setShowRecorder(true); }}
              onSave={handleSave}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <button
        onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
        className="btn-press"
        style={{
          position: 'absolute', bottom: '80px', right: '16px', width: '44px', height: '44px',
          borderRadius: '50%', backgroundColor: colors.backgroundSecondary, color: colors.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)', border: `1px solid ${colors.border}`,
          zIndex: 5, opacity: showScrollButton ? 1 : 0,
          transform: showScrollButton ? 'scale(1)' : 'scale(0.7)',
          pointerEvents: showScrollButton ? 'auto' : 'none',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        <ChevronsDown size={22} strokeWidth={2.5} />
      </button>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <MessageInput
          onSend={handleSend}
          onSendAudio={handleSendAudio}
          onSendAttachment={handleSendAttachment}
          onSendPoll={handleSendPoll}
          onSendContact={handleSendContact}
          disabled={sending}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          themeStyle={desktopThemeStyle}
          showRecorder={showRecorder}
          setShowRecorder={setShowRecorder}
        />
      </div>

      {showInfoPanel && group && (
        <GroupInfoPanel
          group={group}
          currentUserId={currentUser?.uid ?? ''}
          colors={colors}
          onClose={() => setShowInfoPanel(false)}
          onLeave={handleLeave}
          onDeleteGroup={() => { setShowInfoPanel(false); navigate('/messages'); }}
        />
      )}
      <SharePostModal
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
      />
    </div>
  );
}