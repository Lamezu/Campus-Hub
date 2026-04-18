import React, { useEffect, useState, useRef } from 'react';
import { X, UserPlus, LogOut, Shield, Camera, Loader2, Trash2, ChevronLeft, Search, Bell, Star, Check, Music } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAlert } from '@/contexts/AlertContext';
import { uploadChannelPhoto } from '@/config/cloudinary';
import { addMembersToGroup, leaveGroup, updateGroupInfo, getGroupSettings, updateGroupSettings, clearGroupMessagesForUser } from '@/services/groupDMService';
import { ThemedText } from '../themed-text';
import { spacing } from '@/constants/styles';
import type { GroupConversation, User, MuteDuration, StarredMessage } from '@/types';
import { NewGroupModal } from './NewGroupModal';
import { useNavigate } from 'react-router-dom';
import { getStarredMessagesForGroup, unstarMessage } from '@/services/starredMessagesService';
import { playTone } from '@/utils/toneGenerator';
import { useTranslation } from '@/contexts/LanguageContext';

interface GroupInfoSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  group: GroupConversation;
}

export function GroupInfoSidebar({ isOpen, onClose, group }: GroupInfoSidebarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [search, setSearch] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [memberDetails, setMemberDetails] = useState<Record<string, User>>({});
  const [creatorName, setCreatorName] = useState('Alguien');
  const [view, setView] = useState<'main' | 'notifications' | 'starred'>('main');
  const [settings, setSettings] = useState<any>(null);
  const [starredMessages, setStarredMessages] = useState<StarredMessage[]>([]);
  const [loadingStarred, setLoadingStarred] = useState(false);
  
  const currentUser = auth.currentUser;
  const isAdmin = group.createdBy === currentUser?.uid;

  useEffect(() => {
    if (!isOpen) return;
    
    // Fetch group settings
    if (currentUser) {
      getGroupSettings(currentUser.uid, group.id).then(s => {
        setSettings(s);
        setIsMuted(s.isMuted);
      });
    }

    // Fetch creator name
    getDoc(doc(db, 'users', group.createdBy)).then(snap => {
      if (snap.exists()) setCreatorName(snap.data().displayName);
    });

    if (!group.members.length) return;
    
    const fetchMemberDetails = async () => {
      const details: Record<string, User> = {};
      await Promise.all(group.members.map(async (uid) => {
        try {
          const uDoc = await getDoc(doc(db, 'users', uid));
          if (uDoc.exists()) {
            details[uid] = { uid: uDoc.id, ...uDoc.data() } as User;
          }
        } catch (e) {
          console.error(`Error fetching user ${uid}:`, e);
        }
      }));
      setMemberDetails(details);
    };

    fetchMemberDetails();
  }, [isOpen, group.members, group.id, group.createdBy]);

  useEffect(() => {
    if (view === 'starred' && currentUser) {
      setLoadingStarred(true);
      getStarredMessagesForGroup(currentUser.uid, group.id).then(msgs => {
        setStarredMessages(msgs);
        setLoadingStarred(false);
      });
    }
  }, [view, group.id, currentUser]);

  const handleToggleMute = async () => {
    if (!currentUser) return;
    const nextValue = !isMuted;
    
    const updates: any = { 
      isMuted: nextValue,
      mute: nextValue ? 'always' : 'off'
    };
    
    setIsMuted(nextValue);
    setSettings((prev: any) => ({ ...prev, ...updates }));
    await updateGroupSettings(currentUser.uid, group.id, updates);
  };

  const handleMuteChange = async (duration: MuteDuration) => {
    if (!currentUser) return;
    let mutedUntil: number | null = null;
    if (duration === '8h') mutedUntil = Date.now() + 8 * 60 * 60 * 1000;
    else if (duration === '1w') mutedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const updates = { 
      mute: duration, 
      mutedUntil, 
      isMuted: duration !== 'off' 
    };
    setSettings((prev: any) => ({ ...prev, ...updates }));
    setIsMuted(duration !== 'off');
    await updateGroupSettings(currentUser.uid, group.id, updates);
  };

  const handleToneChange = async (tone: string) => {
    if (!currentUser) return;
    setSettings((prev: any) => ({ ...prev, alertTone: tone }));
    
    playTone(tone === 'none' ? 'silent' : tone);
    await updateGroupSettings(currentUser.uid, group.id, { alertTone: tone });
  };

  const handleUnstar = async (msgId: string) => {
    if (!currentUser) return;
    await unstarMessage(currentUser.uid, msgId);
    setStarredMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;
    setUpdating(true);
    try {
      const url = await uploadChannelPhoto(file, `group_photo_${group.id}`);
      await updateGroupInfo(group.id, group.name, url);
    } catch (error) {
       console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  const filteredMembers = Object.keys(group.memberNames).filter(uid => 
    group.memberNames[uid].toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div style={{
        width: isOpen ? 380 : 0,
        opacity: isOpen ? 1 : 0,
        height: '100%',
        backgroundColor: colors.background,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: isOpen ? `1px solid ${colors.border}` : 'none',
        position: 'relative',
        zIndex: 100,
        boxShadow: isOpen ? '-4px 0 16px rgba(0,0,0,0.1)' : 'none',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.background, zIndex: 10 }}>
          <button onClick={view === 'main' ? onClose : () => setView('main')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
          <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>
            {view === 'starred' ? t('chat_ui.channel_info.starred_messages') : view === 'notifications' ? t('settings.notifications') : t('chat_ui.channel_info.title')}
          </ThemedText>
          <div style={{ width: 32 }} />
        </div>

        {view === 'main' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }} className="custom-scrollbar">
          {/* Profile Section */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <div style={{ position: 'relative', marginBottom: 16, cursor: isAdmin ? 'pointer' : 'default' }} onClick={() => isAdmin && fileInputRef.current?.click()}>
              <div style={{ width: 110, height: 110, borderRadius: 36, overflow: 'hidden', border: `4px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, position: 'relative' }}>
                {updating ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 2 }}>
                    <Loader2 size={32} className="animate-spin" color="#fff" />
                  </div>
                ) : null}
                {group.photoURL ? (
                  <img src={group.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={40} color="#fff" />
                  </div>
                )}
              </div>
              {isAdmin && (
                <button style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, border: `2px solid ${colors.background}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                  <Camera size={16} />
                </button>
              )}
              <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/*" style={{ display: 'none' }} />
            </div>
            <ThemedText style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{group.name}</ThemedText>
            <ThemedText style={{ color: colors.textSecondary, fontSize: 14 }}>Grupo • {group.members.length} participantes</ThemedText>
          </div>

          {/* Large Action Buttons */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button 
              onClick={() => setShowAddMembers(true)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', borderRadius: 16, backgroundColor: colors.backgroundSecondary, border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }}
            >
              <UserPlus size={22} color={colors.primary} />
              <ThemedText style={{ fontSize: 12, fontWeight: 700 }}>Añadir</ThemedText>
            </button>
            <button 
              onClick={handleToggleMute}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', borderRadius: 16, backgroundColor: colors.backgroundSecondary, border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }}
            >
              <Bell size={22} color={isMuted ? colors.textSecondary : colors.primary} fill={isMuted ? 'none' : colors.primary + '33'} />
              <ThemedText style={{ fontSize: 12, fontWeight: 700 }}>{isMuted ? t('settings.mute_options.always') : t('chat_ui.channel_info.mute_notifs')}</ThemedText>
            </button>
          </div>

          {/* Menu Group 1 */}
          <div style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${colors.border}`, marginBottom: 24 }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }} 
              onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} 
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => setView('notifications')}
            >
              <Bell size={20} color={colors.textSecondary} />
              <ThemedText style={{ flex: 1, fontWeight: 600 }}>Notificaciones</ThemedText>
              <ChevronLeft size={18} color={colors.textSecondary} style={{ transform: 'rotate(180deg)' }} />
            </div>
            <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 48 }} />
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }} 
              onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} 
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => setView('starred')}
            >
              <Star size={20} color={colors.textSecondary} />
              <ThemedText style={{ flex: 1, fontWeight: 600 }}>Mensajes destacados</ThemedText>
              <ChevronLeft size={18} color={colors.textSecondary} style={{ transform: 'rotate(180deg)' }} />
            </div>
            <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 48 }} />
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', color: '#FF9500' }} 
              onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} 
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => {
                showAlert({
                  title: 'Vaciar chat',
                  message: '¿Estás seguro de que quieres vaciar los mensajes de este grupo para ti? Esta acción no se puede deshacer.',
                  type: 'confirm',
                  showCancelButton: true,
                  onConfirm: async () => {
                    if (currentUser) {
                      await clearGroupMessagesForUser(group.id, currentUser.uid);
                      showAlert({ title: 'Chat vaciado', message: 'Los mensajes se han eliminado para ti.', type: 'info' });
                    }
                  }
                });
              }}
            >
              <Trash2 size={20} color="#FF9500" />
              <ThemedText style={{ flex: 1, fontWeight: 600, color: '#FF9500' }}>Vaciar chat</ThemedText>
            </div>
          </div>

          {/* Members Section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <ThemedText style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>Participantes</ThemedText>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, marginLeft: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', backgroundColor: colors.backgroundSecondary, borderRadius: 10, flex: 1 }}>
                  <Search size={14} color={colors.textSecondary} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: 13 }} />
                </div>
              </div>
            </div>
            
            <div style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', maxHeight: 320 }}>
              <div 
                onClick={() => setShowAddMembers(true)}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', color: colors.primary, cursor: 'pointer', 
                  borderBottom: `1px solid ${colors.border}`, flexShrink: 0, transition: 'background-color 0.2s' 
                }} 
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} 
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserPlus size={18} />
                </div>
                <ThemedText style={{ fontWeight: 700, color: colors.primary }}>Añadir participantes</ThemedText>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }} className="custom-scrollbar">
                {filteredMembers.map((userId, i) => {
                  const name = group.memberNames[userId] || 'Usuario';
                  const photo = group.memberPhotos[userId];
                  const details = memberDetails[userId];
                  const isMemberAdmin = group.createdBy === userId;

                  return (
                    <React.Fragment key={userId}>
                      {i > 0 && <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 64 }} />}
                      <div 
                         style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: userId !== currentUser?.uid ? 'pointer' : 'default' }} 
                        onMouseEnter={e => { if (userId !== currentUser?.uid) e.currentTarget.style.backgroundColor = colors.backgroundSecondary; }} 
                        onMouseLeave={e => { if (userId !== currentUser?.uid) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        onClick={() => {
                          if (userId !== currentUser?.uid) navigate(`/dm/${userId}`);
                        }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.backgroundSecondary }}>
                          {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '15' }}><ThemedText style={{ fontWeight: 800, color: colors.primary }}>{name[0]}</ThemedText></div>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                             <ThemedText style={{ fontWeight: 700, fontSize: 14 }}>{name} {userId === currentUser?.uid && '(Tú)'}</ThemedText>
                             {isMemberAdmin && <div style={{ padding: '2px 6px', borderRadius: 4, backgroundColor: `${colors.primary}15` }}><ThemedText style={{ fontSize: 9, color: colors.primary, fontWeight: 800, textTransform: 'uppercase' }}>Admin</ThemedText></div>}
                          </div>
                          <ThemedText style={{ fontSize: 11, color: colors.textSecondary, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {details?.bio || (details?.role === 'teacher' ? 'Profesor' : details?.role === 'admin' ? 'Administrador' : 'Estudiante')}
                          </ThemedText>
                          {details?.lastActive && (
                            <ThemedText style={{ fontSize: 10, opacity: 0.6, display: 'block' }}>
                              Visto {(() => {
                                const raw = details.lastActive as any;
                                const ms = raw?.toDate ? raw.toDate().getTime() : new Date(raw).getTime();
                                if (Date.now() - ms < 300000) return 'hace un momento';
                                return `a las ${new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                              })()}
                            </ThemedText>
                          )}
                        </div>
                        {isAdmin && userId !== currentUser?.uid && (
                          <button 
                            style={{ background: 'none', border: 'none', color: colors.danger, padding: 8, opacity: 0.6 }} 
                            onClick={(e) => {
                              e.stopPropagation();
                              showAlert({
                                title: 'Eliminar participante',
                                message: `¿Estás seguro de que quieres eliminar a ${name} del grupo?`,
                                type: 'confirm',
                                showCancelButton: true,
                                onConfirm: async () => {
                                  await leaveGroup(group.id, userId);
                                }
                              });
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Menu Group 2 */}
          <div style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${colors.border}`, marginBottom: 24 }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', color: colors.danger }} 
              onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} 
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => {
                showAlert({
                  title: 'Salir del grupo',
                  message: '¿Estás seguro de que quieres salir de este grupo?',
                  type: 'confirm',
                  showCancelButton: true,
                  onConfirm: async () => {
                     if (currentUser) {
                       await leaveGroup(group.id, currentUser.uid);
                       onClose();
                       navigate('/tabs/messages');
                     }
                  }
                });
              }}
            >
              <LogOut size={20} />
              <ThemedText style={{ flex: 1, fontWeight: 600, color: colors.danger }}>Salir del grupo</ThemedText>
            </div>
            <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 48 }} />
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', color: colors.danger }} 
              onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} 
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              onClick={() => showAlert({ title: 'Reportar grupo', message: 'Gracias por tu reporte. Nuestro equipo lo revisará en breve.', type: 'info' })}
            >
              <Shield size={20} />
              <ThemedText style={{ flex: 1, fontWeight: 600, color: colors.danger }}>Reportar grupo</ThemedText>
            </div>
          </div>

          {/* Footer Info */}
          <div style={{ padding: '0 20px 40px', textAlign: 'center', opacity: 0.5 }}>
            <ThemedText style={{ fontSize: 11, display: 'block' }}>
              Grupo creado por {creatorName}
            </ThemedText>
            <ThemedText style={{ fontSize: 11, display: 'block' }}>
              el {(() => {
                const raw = group.createdAt as any;
                const date = raw?.toDate ? raw.toDate() : new Date(raw);
                return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
              })()}
            </ThemedText>
          </div>
        </div>
      )}

      {view === 'starred' && (
        <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
          {loadingStarred ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}><Loader2 size={32} className="animate-spin" color={colors.primary} /></div>
          ) : starredMessages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, gap: 12, padding: 40, textAlign: 'center' }}>
              <Star size={48} />
              <ThemedText style={{ fontWeight: 700 }}>{t('chat_ui.channel_info.starred_view.no_starred')}</ThemedText>
              <ThemedText style={{ fontSize: 13 }}>{t('chat_ui.channel_info.starred_view.no_starred_desc')}</ThemedText>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {starredMessages.map((item) => (
                <div 
                  key={item.id} 
                  style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', transition: 'background-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <ThemedText style={{ fontWeight: 700, color: colors.primary, fontSize: 14 }}>{item.senderName}</ThemedText>
                      <ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>{new Date(item.createdAt).toLocaleString()}</ThemedText>
                    </div>
                    <button 
                      onClick={() => handleUnstar(item.id)} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFD60A' }}
                    >
                      <Star size={18} fill="#FFD60A" />
                    </button>
                  </div>
                  <ThemedText style={{ fontSize: 14, lineHeight: '1.4' }}>{item.text || (item.attachments?.[0]?.type === 'image' ? '📷 Imagen' : 'Mensaje')}</ThemedText>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'notifications' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }} className="custom-scrollbar">
          <ThemedText style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 12, marginLeft: 8 }}>{t('chat_ui.channel_info.mute_notifs')}</ThemedText>
          <div style={{ backgroundColor: colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: 24 }}>
            {[
              { id: '8h', label: t('settings.mute_options.8h'), desc: t('settings.mute_options.8h_desc') },
              { id: '1w', label: t('settings.mute_options.1w'), desc: t('settings.mute_options.1w_desc') },
              { id: 'always', label: t('settings.mute_options.always'), desc: t('settings.mute_options.always_desc') },
              { id: 'off', label: t('settings.mute_options.none'), desc: t('settings.mute_options.none_desc') }
            ].map((opt, i, arr) => (
              <React.Fragment key={opt.id}>
                <div onClick={() => handleMuteChange(opt.id as MuteDuration)} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: 700, fontSize: 15 }}>{opt.label}</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>{opt.desc}</ThemedText>
                  </div>
                  {(settings?.mute || 'off') === opt.id && <Check size={20} color={colors.primary} />}
                </div>
                {i < arr.length - 1 && <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />}
              </React.Fragment>
            ))}
          </div>

          <ThemedText style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 12, marginLeft: 8 }}>{t('settings.notifications_desc')}</ThemedText>
          <div style={{ backgroundColor: colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: 24 }}>
            {['default', 'classic', 'soft', 'melody', 'bell', 'pulse', 'none'].map((tone, i, arr) => (
              <React.Fragment key={tone}>
                <div onClick={() => handleToneChange(t(`settings.tones.${tone}`))} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <Music size={18} color={colors.textSecondary} />
                  <ThemedText style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{t(`settings.tones.${tone}`)}</ThemedText>
                  {(settings?.alertTone || t('settings.tones.default')) === t(`settings.tones.${tone}`) && <Check size={20} color={colors.primary} />}
                </div>
                {i < arr.length - 1 && <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 48 }} />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 10px; }
      `}</style>

      <NewGroupModal 
        isOpen={showAddMembers} 
        onClose={() => setShowAddMembers(false)} 
        mode="invite"
        existingMemberIds={group.members}
        onMembersAdded={async (members) => {
          if (currentUser) {
            await addMembersToGroup(group.id, members, currentUser.displayName || 'Alguien');
          }
          setShowAddMembers(false);
        }} 
      />
    </>
  );
}
