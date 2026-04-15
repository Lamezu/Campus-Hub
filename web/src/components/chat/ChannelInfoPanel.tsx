import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, getDocs, collection, updateDoc, arrayRemove, increment, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { X, Bell, BellOff, Trash2, LogOut, Camera } from 'lucide-react';
import { uploadProfilePhoto } from '../../config/firebaseStorage';
import { useTranslation } from '../../hooks/useTranslation';

interface MemberInfo {
  uid: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  role: string;
}

interface ChannelInfoPanelProps {
  chatId: string;
  isGroup: boolean;
  currentUserId: string;
  userRole: string;
  colors: any;
  onClose: () => void;
  onClearChat: () => void;
  onLeave: () => void;
}

export default function ChannelInfoPanel({ chatId, isGroup, currentUserId, userRole, colors, onClose, onClearChat, onLeave }: ChannelInfoPanelProps) {
  const { t } = useTranslation();
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelPhoto, setChannelPhoto] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [muted, setMuted] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showClearOptions, setShowClearOptions] = useState(false);
  const [closing, setClosing] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);
  const [panelWidth, setPanelWidth] = useState(320);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startWidth: number }>({ active: false, startX: 0, startWidth: 320 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const delta = dragRef.current.startX - e.clientX;
      setPanelWidth(Math.min(600, Math.max(260, dragRef.current.startWidth + delta)));
    };
    const onUp = () => { dragRef.current.active = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const canEditPhoto = userRole === 'admin';
  const isAdmin = userRole === 'admin';
  const groupId = isGroup ? chatId.slice(3) : null;

  useEffect(() => {
    setMuted(localStorage.getItem(`muted_${chatId}_${currentUserId}`) === 'true');
  }, [chatId, currentUserId]);

  useEffect(() => {
    async function load() {
      setLoadingMembers(true);
      try {
        if (isGroup && groupId) {
          const snap = await getDoc(doc(db, 'studyGroups', groupId));
          if (snap.exists()) {
            const data = snap.data();
            setChannelName(data.name ?? '');
            setChannelDescription(data.description ?? '');
            setChannelPhoto(data.photoURL ?? null);
            const memberIds: string[] = data.memberIds ?? [];
            const profiles = await Promise.all(
              memberIds.map(async uid => {
                const u = await getDoc(doc(db, 'users', uid));
                if (u.exists()) {
                  const d = u.data();
                  return { uid, displayName: d.displayName ?? d.email ?? uid, photoURL: d.photoURL ?? null, bio: d.bio ?? d.description ?? '', role: d.role ?? '' };
                }
                return { uid, displayName: uid, photoURL: null, bio: '', role: '' };
              })
            );
            setMembers(profiles);
          }
        } else {
          const snap = await getDoc(doc(db, 'channels', chatId));
          if (snap.exists()) {
            const data = snap.data();
            setChannelName(data.name ?? chatId);
            setChannelDescription(data.description ?? '');
            setChannelPhoto(data.photoURL ?? null);
          }
          const membersSnap = await getDocs(collection(db, 'channels', chatId, 'members'));
          const profiles = await Promise.all(
            membersSnap.docs.map(async memberDoc => {
              const uid = memberDoc.id;
              const u = await getDoc(doc(db, 'users', uid));
              if (u.exists()) {
                const d = u.data();
                return { uid, displayName: d.displayName ?? d.email ?? uid, photoURL: d.photoURL ?? null, bio: d.bio ?? d.description ?? '', role: d.role ?? '' };
              }
              return { uid, displayName: uid, photoURL: null, bio: '', role: '' };
            })
          );
          setMembers(profiles);
        }
      } catch {}
      setLoadingMembers(false);
    }
    load();
  }, [chatId, isGroup, groupId]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(`muted_${chatId}_${currentUserId}`, String(next));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadProfilePhoto(file, `channel_${chatId}`);
      if (isGroup && groupId) {
        await updateDoc(doc(db, 'studyGroups', groupId), { photoURL: url });
      } else {
        await updateDoc(doc(db, 'channels', chatId), { photoURL: url });
      }
      setChannelPhoto(url);
    } catch {}
    setUploadingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearForMe = () => {
    setShowClearOptions(false);
    onClearChat();
    close();
  };

  const clearForEveryone = async () => {
    setShowClearOptions(false);
    if (!window.confirm(t('chat.info.clear_all_confirm'))) return;
    const collPath = isGroup && groupId
      ? collection(db, 'studyGroups', groupId, 'messages')
      : collection(db, 'channels', chatId, 'messages');
    try {
      const snap = await getDocs(collPath);
      const BATCH_SIZE = 500;
      for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch {}
    onClearChat();
    close();
  };

  const handleLeave = async () => {
    if (!window.confirm(t('chat.info.leave_channel_confirm'))) return;
    if (isGroup && groupId) {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        memberIds: arrayRemove(currentUserId),
        memberCount: increment(-1),
      }).catch(() => {});
    }
    onLeave();
  };

  const close = () => {
    setClosing(true);
    setTimeout(onClose, 240);
  };

  const rowHover = (e: React.MouseEvent<HTMLButtonElement>, enter: boolean, danger?: boolean) => {
    e.currentTarget.style.backgroundColor = enter ? (danger ? '#ed424512' : colors.backgroundSecondary) : 'transparent';
  };

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
      `}</style>
      <div className={`ch-backdrop${closing ? ' out' : ''}`} onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 998, backgroundColor: 'rgba(0,0,0,0.35)' }} />
      <div className={`ch-panel${closing ? ' out' : ''}`} style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 999,
        width: isMobile ? '100%' : panelWidth, backgroundColor: colors.background,
        borderLeft: isMobile ? 'none' : `1px solid ${colors.border}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
        overflowY: 'auto',
      }}>
        {!isMobile && (
          <div
            onMouseDown={e => { dragRef.current = { active: true, startX: e.clientX, startWidth: panelWidth }; document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none'; }}
            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, cursor: 'ew-resize', zIndex: 10 }}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{t('chat.info.title')}</span>
          <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }}>
            <X size={20} color={colors.textSecondary} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 20px', borderBottom: `1px solid ${colors.border}`, gap: 12 }}>
          <div style={{ position: 'relative', cursor: canEditPhoto ? 'pointer' : 'default' }} onClick={() => canEditPhoto && fileInputRef.current?.click()}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: colors.backgroundSecondary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {channelPhoto
                ? <img src={channelPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 32, fontWeight: 800, color: colors.text }}>{channelName[0]?.toUpperCase() ?? '#'}</span>
              }
            </div>
            {canEditPhoto && (
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${colors.background}` }}>
                {uploadingPhoto
                  ? <div className="loading-spinner" style={{ width: 12, height: 12 }} />
                  : <Camera size={12} color="#fff" />
                }
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>{channelName}</div>
            {channelDescription && <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>{channelDescription}</div>}
          </div>
        </div>

        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary, marginBottom: 12 }}>
            {t('chat.info.members')}{!loadingMembers && ` · ${members.length}`}
          </div>
          {loadingMembers ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
              <div className="loading-spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {members.map(m => (
                <div key={m.uid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: colors.backgroundSecondary, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {m.photoURL
                      ? <img src={m.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{m.displayName[0]?.toUpperCase() ?? '?'}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.displayName}</div>
                    {(m.bio || m.role) && (
                      <div style={{ fontSize: 12, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.bio || m.role}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${colors.border}` }}>
          <button
            onClick={toggleMute}
            onMouseEnter={e => rowHover(e, true)}
            onMouseLeave={e => rowHover(e, false)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, textAlign: 'left' }}
          >
            {muted ? <BellOff size={18} color={colors.textSecondary} /> : <Bell size={18} color={colors.textSecondary} />}
            <span style={{ fontSize: 14, color: colors.text }}>{muted ? t('dm.unmute') : t('dm.mute')}</span>
          </button>
        </div>

        <div style={{ padding: '8px 12px' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => isAdmin ? setShowClearOptions(v => !v) : clearForMe()}
              onMouseEnter={e => rowHover(e, true, true)}
              onMouseLeave={e => rowHover(e, false)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, textAlign: 'left' }}
            >
              <Trash2 size={18} color="#ed4245" />
              <span style={{ fontSize: 14, color: '#ed4245' }}>{t('dm.info.clear_chat')}</span>
            </button>
            {isAdmin && showClearOptions && (
              <>
                <div onClick={() => setShowClearOptions(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 8, zIndex: 20, backgroundColor: colors.card ?? colors.background, border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden', minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                  <button
                    onClick={clearForMe}
                    style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: '#ed4245' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ed424512')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {t('chat.info.only_for_me')}
                  </button>
                  <div style={{ height: 1, backgroundColor: colors.border }} />
                  <button
                    onClick={clearForEveryone}
                    style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: '#ed4245', fontWeight: 600 }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ed424512')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {t('chat.info.for_everyone')}
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={handleLeave}
            onMouseEnter={e => rowHover(e, true, true)}
            onMouseLeave={e => rowHover(e, false)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, textAlign: 'left' }}
          >
            <LogOut size={18} color="#ed4245" />
            <span style={{ fontSize: 14, color: '#ed4245' }}>{t('chat.info.leave_channel')}</span>
          </button>
        </div>
      </div>
    </>
  );
}
