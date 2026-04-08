import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, arrayUnion, arrayRemove, writeBatch, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { X, Bell, BellOff, Trash2, Phone, Video, MessageSquare, Shield, AlertTriangle, ChevronRight, UserPlus, UserCheck, Heart, Star, Image as ImageIcon, ArrowLeft, FileText, Download, Link as LinkIcon, Bookmark, Music } from 'lucide-react';
import { getFriendRequest, areFriends, sendFriendRequest, acceptFriendRequest } from '../../services/firebase/friendsService';
import { auth } from '../../config/firebase';
import { subscribeToSavedMessages, type SavedMessage } from '../../services/firebase/savedItemsService';
import { MESSAGE_TONE_NAMES, previewTone } from '../../utils/toneGenerator';

type MuteDuration = 'off' | '8h' | '1w' | 'always';

const muteDurationLabel: Record<MuteDuration, string> = {
  off: 'Activas',
  '8h': 'Silenciadas 8h',
  '1w': 'Silenciadas 1 sem.',
  always: 'Silenciadas',
};

const URL_REGEX = /https?:\/\/[^\s]+/g;

interface SharedFile { messageId: string; url: string; name: string; size: number; type: 'image' | 'file' | 'audio'; }
interface SharedLink { messageId: string; url: string; text: string; }

function roleBadgeLabel(role: string): string {
  if (role === 'teacher') return 'Profesor/a';
  if (role === 'admin') return 'Admin';
  return 'Alumno/a';
}

function roleBadgeColor(role: string): string {
  if (role === 'teacher') return '#007AFF';
  if (role === 'admin') return '#AF52DE';
  return '#34C759';
}

interface MutualGroup { id: string; name: string; photo: string | null; memberCount: number; memberPreview: string; }

interface DMInfoPanelProps {
  otherUserId: string;
  conversationId?: string;
  currentUserId: string;
  userRole?: string;
  colors: any;
  onClose: () => void;
  onClearChat?: () => void;
  onDeleteChat?: () => void;
  onCall?: (type: 'audio' | 'video') => void;
}

export default function DMInfoPanel({ otherUserId, conversationId, currentUserId, userRole = 'student', colors, onClose, onClearChat, onDeleteChat, onCall }: DMInfoPanelProps) {
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [role, setRole] = useState('student');
  const [bio, setBio] = useState('');

  const [mute, setMute] = useState<MuteDuration>('off');
  const [alertTone, setAlertTone] = useState<string>('Predeterminado');
  const [isBestFriend, setIsBestFriend] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendStatus, setFriendStatus] = useState<'none' | 'sent' | 'received'>('none');
  const [sharedMediaCount, setSharedMediaCount] = useState(0);
  const [mutualGroups, setMutualGroups] = useState<MutualGroup[]>([]);
  const [showAllGroups, setShowAllGroups] = useState(false);

  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showAlertToneMenu, setShowAlertToneMenu] = useState(false);
  const [showClearOptions, setShowClearOptions] = useState(false);
  const [activeSubPanel, setActiveSubPanel] = useState<null | 'media' | 'saved'>(null);

  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([]);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [closing, setClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [panelWidth, setPanelWidth] = useState(340);

  const isAdmin = userRole === 'admin';
  const dragRef = useRef<{ active: boolean; startX: number; startWidth: number }>({ active: false, startX: 0, startWidth: 340 });

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
    if (!otherUserId || !currentUserId) return;
    getDoc(doc(db, 'users', otherUserId)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setName(d.displayName ?? d.email ?? 'Usuario');
      setPhoto(d.photoURL ?? null);
      setRole(d.role ?? 'student');
      setBio(d.bio ?? d.description ?? '');
    }).catch(() => {});

    getDoc(doc(db, 'users', currentUserId, 'contactSettings', otherUserId)).then(snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      setMute(d.mute ?? 'off');
      setAlertTone(d.alertTone ?? 'Predeterminado');
      setIsBestFriend(d.isBestFriend ?? false);
    }).catch(() => {});

    areFriends(currentUserId, otherUserId).then(async friend => {
      if (friend) { setIsFriend(true); return; }
      const req = await getFriendRequest(currentUserId, otherUserId).catch(() => null);
      if (!req) { setFriendStatus('none'); return; }
      setFriendStatus(req.fromUserId === currentUserId ? 'sent' : 'received');
    }).catch(() => {});

    if (conversationId) {
      getDocs(query(collection(db, 'conversations', conversationId, 'messages'), where('attachments', '!=', null))).then(snap => {
        let count = 0;
        snap.docs.forEach(d => {
          const atts = d.data().attachments;
          if (Array.isArray(atts)) count += atts.filter((a: any) => a.type === 'image' || a.type === 'file').length;
        });
        setSharedMediaCount(count);
      }).catch(() => {});
    }

    Promise.all([
      getDocs(query(collection(db, 'studyGroups'), where('memberIds', 'array-contains', currentUserId))),
    ]).then(async ([sgSnap]) => {
      const mutual: MutualGroup[] = [];
      for (const d of sgSnap.docs) {
        const data = d.data();
        if (!Array.isArray(data.memberIds) || !data.memberIds.includes(otherUserId)) continue;
        const others = (data.memberIds as string[]).filter((id: string) => id !== currentUserId && id !== otherUserId).slice(0, 2);
        const profiles = await Promise.all(others.map((id: string) => getDoc(doc(db, 'users', id))));
        let preview = profiles.filter(p => p.exists()).map(p => p.data()?.displayName?.split(' ')[0] || 'Usuario').join(', ');
        if (!preview) preview = 'Tú y este contacto';
        mutual.push({ id: d.id, name: data.name ?? 'Grupo', photo: data.photoURL ?? null, memberCount: data.memberIds.length, memberPreview: preview });
      }
      setMutualGroups(mutual);
    }).catch(() => {});
  }, [otherUserId, currentUserId, conversationId]);

  const close = () => { setClosing(true); setTimeout(onClose, 240); };

  const updateContactSetting = async (partial: Record<string, any>) => {
    const ref = doc(db, 'users', currentUserId, 'contactSettings', otherUserId);
    await setDoc(ref, { ...partial, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
  };

  const handleMute = async (val: MuteDuration) => {
    setMute(val); setShowMuteMenu(false);
    await updateContactSetting({ mute: val, muted: val !== 'off' });
  };

  const handleToneChange = async (val: string) => {
    setAlertTone(val);
    setShowAlertToneMenu(false);
    previewTone(val);
    await updateContactSetting({ alertTone: val });
  };

  const downloadFile = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(url, '_blank');
    }
  };

  const openMediaPanel = async () => {
    setActiveSubPanel('media');
    if (sharedFiles.length > 0 || sharedLinks.length > 0) return;
    if (!conversationId) return;
    setLoadingMedia(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('createdAt', 'desc')
      ));
      const files: SharedFile[] = [];
      const links: SharedLink[] = [];
      snap.docs.forEach(d => {
        const data = d.data();
        if (Array.isArray(data.attachments)) {
          data.attachments.forEach((a: any) => {
            if (a.type === 'image' || a.type === 'file' || a.type === 'audio') {
              files.push({ messageId: d.id, url: a.url, name: a.name || 'Archivo', size: a.size || 0, type: a.type });
            }
          });
        }
        if (data.text) {
          const found = (data.text as string).match(URL_REGEX);
          if (found) found.forEach(url => links.push({ messageId: d.id, url, text: data.text.length > 60 ? data.text.slice(0, 60) + '…' : data.text }));
        }
      });
      setSharedFiles(files);
      setSharedLinks(links);
    } catch {} finally { setLoadingMedia(false); }
  };

  const openSavedPanel = () => {
    setActiveSubPanel('saved');
    if (savedMessages.length > 0) return;
    setLoadingSaved(true);
    const unsub = subscribeToSavedMessages(currentUserId, msgs => {
      setSavedMessages(msgs.filter(m => m.originalChannelId === conversationId));
      setLoadingSaved(false);
      unsub();
    });
  };

  const handleFriendAction = async () => {
    if (friendStatus === 'received') {
      const req = await getFriendRequest(currentUserId, otherUserId).catch(() => null);
      if (req) await acceptFriendRequest(req.id).catch(() => {});
      setIsFriend(true); setFriendStatus('none');
    } else if (!isFriend && friendStatus === 'none') {
      const me = auth.currentUser;
      await sendFriendRequest(currentUserId, otherUserId, me?.displayName ?? 'Tú', me?.photoURL ?? null).catch(() => {});
      setFriendStatus('sent');
    } else if (isFriend) {
      const next = !isBestFriend;
      setIsBestFriend(next);
      await updateContactSetting({ isBestFriend: next });
    }
  };

  const clearForMe = async () => {
    setShowClearOptions(false);
    if (!conversationId) return;
    try {
      const snap = await getDocs(collection(db, 'conversations', conversationId, 'messages'));
      for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 500).forEach(d => {
          batch.update(d.ref, { deletedForUsers: arrayUnion(currentUserId) });
        });
        await batch.commit();
      }
    } catch {}
    onClearChat?.();
    close();
  };

  const clearForEveryone = async () => {
    setShowClearOptions(false);
    if (!window.confirm('¿Eliminar todos los mensajes para ambos participantes?')) return;
    if (!conversationId) return;
    try {
      const snap = await getDocs(collection(db, 'conversations', conversationId, 'messages'));
      for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch {}
    onClearChat?.(); close();
  };

  const handleBlock = async () => {
    if (!window.confirm(`¿Bloquear a ${name.split(' ')[0]}?`)) return;
    await updateDoc(doc(db, 'users', currentUserId), { blockedUsers: arrayUnion(otherUserId), friends: arrayRemove(otherUserId) }).catch(() => {});
    close();
  };

  const handleReport = async () => {
    if (!window.confirm(`¿Reportar a ${name.split(' ')[0]}?`)) return;
    await addDoc(collection(db, 'reports'), { reporterId: currentUserId, reportedId: otherUserId, createdAt: serverTimestamp(), status: 'pending' }).catch(() => {});
    window.alert('Reporte enviado. Gracias por ayudarnos a mantener la comunidad segura.');
  };

  const rowHover = (e: React.MouseEvent<HTMLElement>, enter: boolean, danger?: boolean) => {
    (e.currentTarget as HTMLElement).style.backgroundColor = enter ? (danger ? '#ed424512' : colors.backgroundSecondary) : 'transparent';
  };

  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  const displayedGroups = showAllGroups ? mutualGroups : mutualGroups.slice(0, 3);

  const friendBtnLabel = isFriend
    ? (isBestFriend ? 'Quitar de mejores amigos' : 'Añadir a mejores amigos')
    : friendStatus === 'received' ? 'Aceptar solicitud'
    : friendStatus === 'sent' ? 'Solicitud enviada'
    : 'Enviar solicitud de amistad';

  const FriendIcon = isFriend
    ? (isBestFriend ? Heart : UserCheck)
    : friendStatus === 'received' ? UserCheck
    : UserPlus;

  const friendColor = isFriend ? colors.primary
    : friendStatus === 'received' ? '#34C759'
    : friendStatus === 'sent' ? colors.textSecondary
    : colors.primary;

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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>Info. del contacto</span>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}>
            <X size={20} color={colors.textSecondary} />
          </button>
        </div>

        <div className="ch-panel-scroll" style={{ flex: 1, overflowY: activeSubPanel ? 'hidden' : 'auto', position: 'relative' }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 20px 24px', borderBottom: `1px solid ${colors.border}`, gap: 10 }}>
          <div style={{ width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 34, fontWeight: 800, color: colors.text }}>{initials}</span>}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, textAlign: 'center' }}>{name}</div>
          <div style={{ padding: '4px 12px', borderRadius: 20, backgroundColor: roleBadgeColor(role) + '22' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: roleBadgeColor(role) }}>{roleBadgeLabel(role)}</span>
          </div>
          {!!bio && <div style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: '18px' }}>{bio}</div>}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {[
              { icon: <MessageSquare size={22} color={colors.primary} strokeWidth={1.8} />, label: 'Mensaje', action: close, always: true },
              { icon: <Phone size={22} color={colors.primary} strokeWidth={1.8} />, label: 'Llamar', action: () => { close(); onCall?.('audio'); }, always: false },
              { icon: <Video size={22} color={colors.primary} strokeWidth={1.8} />, label: 'Video', action: () => { close(); onCall?.('video'); }, always: false },
            ].filter(btn => btn.always || !!onCall).map(btn => (
              <button key={btn.label} onClick={btn.action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 14, backgroundColor: colors.backgroundSecondary, border: 'none', cursor: 'pointer', minWidth: 72 }}>
                {btn.icon}
                <span style={{ fontSize: 12, color: colors.text, fontWeight: 500 }}>{btn.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderBottom: `1px solid ${colors.border}` }}>
          <button
            onClick={handleFriendAction}
            disabled={friendStatus === 'sent'}
            onMouseEnter={e => rowHover(e, true)}
            onMouseLeave={e => rowHover(e, false)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: friendStatus === 'sent' ? 'default' : 'pointer', textAlign: 'left' }}
          >
            <FriendIcon size={18} color={friendColor} strokeWidth={1.8} {...(isFriend && isBestFriend ? { fill: colors.primary } : {})} />
            <span style={{ fontSize: 14, color: friendColor }}>{friendBtnLabel}</span>
          </button>
        </div>

        {conversationId && (
          <div style={{ borderBottom: `1px solid ${colors.border}` }}>
            <button onClick={openMediaPanel} onMouseEnter={e => rowHover(e, true)} onMouseLeave={e => rowHover(e, false)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <ImageIcon size={18} color={colors.textSecondary} strokeWidth={1.8} />
              <span style={{ flex: 1, fontSize: 14, color: colors.text }}>Archivos, enlaces y docs</span>
              <span style={{ fontSize: 13, color: colors.textSecondary }}>{sharedMediaCount}</span>
              <ChevronRight size={15} color={colors.textSecondary} />
            </button>
            <button onClick={openSavedPanel} onMouseEnter={e => rowHover(e, true)} onMouseLeave={e => rowHover(e, false)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', borderTop: `1px solid ${colors.border}` }}>
              <Star size={18} color={colors.textSecondary} strokeWidth={1.8} />
              <span style={{ flex: 1, fontSize: 14, color: colors.text }}>Destacados</span>
              <ChevronRight size={15} color={colors.textSecondary} />
            </button>
          </div>
        )}

        <div style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowMuteMenu(v => !v); setShowAlertToneMenu(false); }}
              onMouseEnter={e => rowHover(e, true)} onMouseLeave={e => rowHover(e, false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              {mute === 'off' ? <Bell size={18} color={colors.textSecondary} strokeWidth={1.8} /> : <BellOff size={18} color={colors.textSecondary} strokeWidth={1.8} />}
              <span style={{ flex: 1, fontSize: 14, color: colors.text }}>Notificaciones</span>
              <span style={{ fontSize: 13, color: colors.textSecondary }}>{muteDurationLabel[mute]}</span>
              <ChevronRight size={15} color={colors.textSecondary} />
            </button>
            {showMuteMenu && (
              <>
                <div onClick={() => setShowMuteMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                <div style={{ position: 'absolute', right: 12, top: '100%', zIndex: 20, backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden', minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
                  {(['off', '8h', '1w', 'always'] as MuteDuration[]).map(val => (
                    <button key={val} onClick={() => handleMute(val)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: mute === val ? colors.primary : colors.text, fontWeight: mute === val ? 600 : 400 }}
                      onMouseEnter={e => (e.currentTarget.style.background = colors.backgroundSecondary)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {muteDurationLabel[val]}
                      {mute === val && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.primary, display: 'inline-block' }} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowAlertToneMenu(v => !v); setShowMuteMenu(false); }}
              onMouseEnter={e => rowHover(e, true)} onMouseLeave={e => rowHover(e, false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <Music size={18} color={colors.textSecondary} strokeWidth={1.8} />
              <span style={{ flex: 1, fontSize: 14, color: colors.text }}>Tono de alerta</span>
              <span style={{ fontSize: 13, color: colors.textSecondary }}>{alertTone}</span>
              <ChevronRight size={15} color={colors.textSecondary} />
            </button>
            {showAlertToneMenu && (
              <>
                <div onClick={() => setShowAlertToneMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                <div style={{ position: 'absolute', right: 12, top: '100%', zIndex: 20, backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden', minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
                  {MESSAGE_TONE_NAMES.map(val => (
                    <button key={val} onClick={() => handleToneChange(val)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: alertTone === val ? colors.primary : colors.text, fontWeight: alertTone === val ? 600 : 400 }}
                      onMouseEnter={e => (e.currentTarget.style.background = colors.backgroundSecondary)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {val}
                      {alertTone === val && <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.primary, display: 'inline-block' }} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ padding: '12px 20px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary }}>
            {mutualGroups.length} {mutualGroups.length === 1 ? 'grupo en común' : 'grupos en común'}
          </div>
          {displayedGroups.map(group => (
            <button key={group.id} onMouseEnter={e => rowHover(e, true)} onMouseLeave={e => rowHover(e, false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundSecondary, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {group.photo ? <img src={group.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16, fontWeight: 700, color: colors.textSecondary }}>{group.name[0]?.toUpperCase()}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>{group.memberCount} miembros · {group.memberPreview}</div>
              </div>
              <ChevronRight size={15} color={colors.textSecondary} />
            </button>
          ))}
          {mutualGroups.length > 3 && (
            <button onClick={() => setShowAllGroups(v => !v)} onMouseEnter={e => rowHover(e, true)} onMouseLeave={e => rowHover(e, false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 20px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 14, color: colors.primary, fontWeight: 500 }}>
                {showAllGroups ? 'Ver menos' : `Ver todos (${mutualGroups.length})`}
              </span>
            </button>
          )}
        </div>

        {conversationId && <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => isAdmin ? setShowClearOptions(v => !v) : clearForMe()}
              onMouseEnter={e => rowHover(e, true, true)} onMouseLeave={e => rowHover(e, false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, textAlign: 'left' }}
            >
              <Trash2 size={18} color="#FF9500" />
              <span style={{ fontSize: 14, color: '#FF9500' }}>Vaciar chat</span>
            </button>
            {isAdmin && showClearOptions && (
              <>
                <div onClick={() => setShowClearOptions(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 8, zIndex: 20, backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden', minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                  <button onClick={clearForMe} style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: '#FF9500' }} onMouseEnter={e => (e.currentTarget.style.background = '#FF950012')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Solo para mí</button>
                  <div style={{ height: 1, backgroundColor: colors.border }} />
                  <button onClick={clearForEveryone} style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: '#FF9500', fontWeight: 600 }} onMouseEnter={e => (e.currentTarget.style.background = '#FF950012')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>Para todos</button>
                </div>
              </>
            )}
          </div>
        </div>}

        {onDeleteChat && (
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}` }}>
            <button
              onClick={() => { if (!window.confirm('¿Eliminar este chat? Dejará de aparecer en tu lista.')) return; close(); onDeleteChat(); }}
              onMouseEnter={e => rowHover(e, true, true)} onMouseLeave={e => rowHover(e, false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, textAlign: 'left' }}
            >
              <Trash2 size={18} color="#FF3B30" />
              <span style={{ fontSize: 14, color: '#FF3B30' }}>Eliminar chat</span>
            </button>
          </div>
        )}

        <div style={{ padding: '8px 12px' }}>
          <button onClick={handleBlock} onMouseEnter={e => rowHover(e, true, true)} onMouseLeave={e => rowHover(e, false)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, textAlign: 'left' }}>
            <Shield size={18} color="#FF3B30" />
            <span style={{ fontSize: 14, color: '#FF3B30' }}>Bloquear a {name.split(' ')[0]}</span>
          </button>
          <button onClick={handleReport} onMouseEnter={e => rowHover(e, true, true)} onMouseLeave={e => rowHover(e, false)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, textAlign: 'left' }}>
            <AlertTriangle size={18} color="#FF3B30" />
            <span style={{ fontSize: 14, color: '#FF3B30' }}>Reportar a {name.split(' ')[0]}</span>
          </button>
        </div>

        </div>

        {activeSubPanel === 'media' && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, zIndex: 5, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
              <button onClick={() => setActiveSubPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                <ArrowLeft size={20} color={colors.text} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>Archivos, enlaces y docs</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingMedia ? (
                <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>Cargando…</div>
              ) : (
                <>
                  {sharedFiles.length > 0 && (
                    <div>
                      <div style={{ padding: '12px 20px 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary }}>
                        Archivos ({sharedFiles.length})
                      </div>
                      {sharedFiles.map((f, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${colors.border}` }}>
                          <a href={f.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textDecoration: 'none' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                              {f.type === 'image'
                                ? <img src={f.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <FileText size={20} color={colors.primary} />
                              }
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                              <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{(f.size / 1024).toFixed(0)} KB</div>
                            </div>
                          </a>
                          <button
                            onClick={() => downloadFile(f.url, f.name)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 8, flexShrink: 0 }}
                            title="Descargar"
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
                        Enlaces ({sharedLinks.length})
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
                    <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>No hay archivos ni enlaces compartidos</div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeSubPanel === 'saved' && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, zIndex: 5, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
              <button onClick={() => setActiveSubPanel(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
                <ArrowLeft size={20} color={colors.text} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>Destacados</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingSaved ? (
                <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>Cargando…</div>
              ) : savedMessages.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>No tienes mensajes guardados de esta conversación</div>
              ) : (
                savedMessages.map((msg, i) => (
                  <div key={i} style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Bookmark size={14} color={colors.primary} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: colors.primary }}>{msg.senderName}</span>
                      <span style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 'auto' }}>
                        {new Date(msg.savedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    {msg.text ? (
                      <div style={{ fontSize: 13, color: colors.text, lineHeight: '18px' }}>{msg.text}</div>
                    ) : msg.attachments?.[0] ? (
                      <div style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic' }}>
                        {msg.attachments[0].type === 'image' ? '🖼 Imagen' : msg.attachments[0].type === 'audio' ? '🎵 Audio' : '📄 Archivo'}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
