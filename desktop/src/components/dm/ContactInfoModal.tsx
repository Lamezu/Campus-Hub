import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  X, ChevronLeft, MessageSquare, Phone, Video, 
  Image as ImageIcon, Star, Bell, ImagePlus, 
  Plus, ChevronRight, Share2, UserPlus, 
  UserCheck, Heart, Trash2, Shield, AlertTriangle,
  Loader2, Search, Send, Hash, FileText, Globe, Play, Maximize2, Check, Music, Download, Camera
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { spacing } from '@/constants/styles';
import { auth, db } from '@/config/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import type { User, MutualGroup, MuteDuration, SaveToPhotosPreference, SharedMedia, DMConversation, Channel } from '@/types';
import * as contactService from '@/services/contactSettingsService';
import { subscribeToConversations, getConversationId, sendMessage as dmSendMessage, getOrCreateConversation } from '@/services/dmService';
import { MOCK_CHANNELS as CHANNELS } from '@/constants/mockData';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertModal } from '@/components/AlertModal';
import { subscribeToFriendshipStatus } from '@/services/friendsService';

interface ContactInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

type SubView = 'media' | 'notifications' | 'photos' | 'share' | 'starred' | null;

const roleBadgeColor = (role: string) => {
  if (role === 'teacher') return '#007AFF';
  if (role === 'admin') return '#AF52DE';
  return '#34C759';
};

const roleLabel = (role: string) => {
  if (role === 'teacher') return 'Profesor/a';
  if (role === 'admin') return 'Administrador/a';
  return 'Estudiante';
};

export function ContactInfoModal({ isOpen, onClose, user }: ContactInfoModalProps) {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const meId = auth.currentUser?.uid;
  
  const [loading, setLoading] = useState(true);
  const [activeSubView, setActiveSubView] = useState<SubView>(null);
  const [mute, setMute] = useState<MuteDuration>('off');
  const [saveToPhotos, setSaveToPhotos] = useState<SaveToPhotosPreference>('default');
  const [alertTone, setAlertTone] = useState('Predeterminado');
  const [isBestFriend, setIsBestFriend] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestStatus, setFriendRequestStatus] = useState<'none' | 'sent' | 'received'>('none');
  const [sharedMedia, setSharedMedia] = useState<SharedMedia[]>([]);
  const [mutualGroups, setMutualGroups] = useState<MutualGroup[]>([]);
  const [showClearAlert, setShowClearAlert] = useState(false);

  useEffect(() => {
    if (!isOpen || !meId || !user.uid) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const conversationId = [meId, user.uid].sort().join('_');
        
        const [settings, media, groups] = await Promise.all([
          contactService.getContactSettings(meId, user.uid),
          contactService.getSharedMedia(conversationId, 200),
          contactService.getMutualGroups(meId, user.uid)
        ]);

        setMute(settings.mute);
        setSaveToPhotos(settings.saveToPhotos);
        setAlertTone(settings.alertTone || 'Predeterminado');
        setIsBestFriend(settings.isBestFriend);
        setSharedMedia(media);
        setMutualGroups(groups);
      } catch (error) {
        console.error('Error loading contact info:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, meId, user.uid]);

  // Reactive Friendship Status
  useEffect(() => {
    if (!isOpen || !meId || !user.uid) return;

    const unsub = subscribeToFriendshipStatus(meId, user.uid, (status) => {
      if (status === 'friends') {
        setIsFriend(true);
        setFriendRequestStatus('none');
      } else {
        setIsFriend(false);
        setFriendRequestStatus(status);
      }
    });

    return () => unsub();
  }, [isOpen, meId, user.uid]);

  const handleFriendAction = async () => {
    if (!meId || !user.uid) return;
    try {
      if (friendRequestStatus === 'received') {
        await contactService.acceptFriendRequest(meId, user.uid);
        setIsFriend(true);
        setFriendRequestStatus('none');
      } else if (friendRequestStatus === 'none' && !isFriend) {
        await contactService.sendFriendRequest(meId, user.uid, auth.currentUser?.displayName || 'Usuario', auth.currentUser?.photoURL || null);
        setFriendRequestStatus('sent');
      } else if (isFriend) {
        const next = await contactService.toggleBestFriend(meId, user.uid);
        setIsBestFriend(next);
      }
    } catch (error) {
      console.error('Friend action error:', error);
    }
  };

  const menuContainerStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    border: `1px solid ${colors.border}`
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    gap: 12,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };

  const dividerStyle: React.CSSProperties = {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 48
  };


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
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {activeSubView === null ? (
          <>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.background, zIndex: 10 }}>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
              <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>Info. del contacto</ThemedText>
              <div style={{ width: 32 }} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }} className="custom-scrollbar">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
                <div style={{ width: 110, height: 110, borderRadius: '50%', overflow: 'hidden', marginBottom: 16, border: `4px solid ${colors.border}` }}>
                  {user.photoURL ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ThemedText style={{ fontSize: 40, fontWeight: 'bold', color: '#fff' }}>{user.displayName[0]}</ThemedText></div>}
                </div>
                <ThemedText style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{user.displayName}</ThemedText>
                <div style={{ padding: '4px 12px', borderRadius: 20, backgroundColor: `${roleBadgeColor(user.role)}22`, color: roleBadgeColor(user.role), fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{roleLabel(user.role)}</div>
                <ThemedText style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>{user.bio || 'Sin descripción'}</ThemedText>
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {[
                  { icon: MessageSquare, label: 'Mensaje', onClick: onClose },
                  { icon: Phone, label: 'Llamar', onClick: () => navigate(`/dm/${user.uid}/call?type=audio`) },
                  { icon: Video, label: 'Video', onClick: () => navigate(`/dm/${user.uid}/call?type=video`) }
                ].map((action, i) => (
                  <button key={i} onClick={action.onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', borderRadius: 16, backgroundColor: colors.backgroundSecondary, border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }}><action.icon size={22} color={colors.primary} /><ThemedText style={{ fontSize: 12, fontWeight: 600 }}>{action.label}</ThemedText></button>
                ))}
              </div>

              <div style={menuContainerStyle}>
                <div style={rowStyle} onClick={() => setActiveSubView('media')}>
                  <ImageIcon size={20} color={colors.textSecondary} />
                  <ThemedText style={{ flex: 1, fontWeight: 600 }}>Archivos, enlaces y docs</ThemedText>
                  <ThemedText style={{ color: colors.textSecondary, fontSize: 14 }}>{sharedMedia.length}</ThemedText>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </div>
                <div style={dividerStyle} />
                <div style={rowStyle} onClick={() => setActiveSubView('starred')}>
                  <Star size={20} color={colors.textSecondary} />
                  <ThemedText style={{ flex: 1, fontWeight: 600 }}>Destacados</ThemedText>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </div>
                <div style={dividerStyle} />
                <div style={rowStyle} onClick={() => setActiveSubView('notifications')}>
                  <Bell size={20} color={colors.textSecondary} />
                  <ThemedText style={{ flex: 1, fontWeight: 600 }}>Notificaciones</ThemedText>
                  <ThemedText style={{ color: colors.textSecondary, fontSize: 14 }}>{mute === 'off' ? 'Activas' : (mute === '8h' ? '8 horas' : (mute === '1w' ? '1 semana' : 'Siempre'))}</ThemedText>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </div>
                <div style={dividerStyle} />
                <div style={rowStyle} onClick={() => setActiveSubView('photos')}>
                  <ImagePlus size={20} color={colors.textSecondary} />
                  <ThemedText style={{ flex: 1, fontWeight: 600 }}>Guardar en Fotos</ThemedText>
                  <ThemedText style={{ color: colors.textSecondary, fontSize: 14 }}>{saveToPhotos === 'default' ? 'Por defecto' : (saveToPhotos === 'always' ? 'Siempre' : 'Nunca')}</ThemedText>
                  <ChevronRight size={18} color={colors.textSecondary} />
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <ThemedText style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 8 }}>Grupos en común</ThemedText>
                <div style={menuContainerStyle}>
                  <div style={{ ...rowStyle, color: colors.primary }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: `${colors.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={18} /></div>
                    <ThemedText style={{ fontWeight: 700, color: colors.primary }}>Crear grupo con {user.displayName.split(' ')[0]}</ThemedText>
                  </div>
                  {mutualGroups.map((group, i) => (
                    <React.Fragment key={group.id}>
                      <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 64 }} />
                      <div style={rowStyle} onClick={() => navigate(`/chat/${group.id}`)}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ThemedText style={{ fontWeight: 800, color: colors.textSecondary }}>{group.name[0].toUpperCase()}</ThemedText></div>
                        <div style={{ flex: 1 }}>
                          <ThemedText style={{ fontWeight: 700, fontSize: 15 }}>{group.name}</ThemedText>
                          <ThemedText style={{ fontSize: 12, color: colors.textSecondary, display: 'block' }}>{group.memberCount} miembros • {group.memberPreview}</ThemedText>
                        </div>
                        <ChevronRight size={18} color={colors.textSecondary} />
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div style={menuContainerStyle}>
                <div style={{ ...rowStyle, color: '#34C759' }} onClick={() => setActiveSubView('share')}>
                  <Share2 size={20} />
                  <ThemedText style={{ fontWeight: 600, color: '#34C759' }}>Compartir usuario</ThemedText>
                </div>
                <div style={dividerStyle} />
                <div style={{ ...rowStyle, cursor: friendRequestStatus === 'sent' ? 'default' : 'pointer' }} onClick={handleFriendAction}>
                  {isFriend ? (isBestFriend ? <Heart size={20} color={colors.primary} fill={colors.primary} /> : <UserCheck size={20} color={colors.primary} />) : friendRequestStatus === 'received' ? (<UserCheck size={20} color="#34C759" />) : (<UserPlus size={20} color={friendRequestStatus === 'sent' ? colors.textSecondary : colors.primary} />)}
                  <ThemedText style={{ flex: 1, fontWeight: 600, color: isFriend ? colors.primary : (friendRequestStatus === 'received' ? '#34C759' : (friendRequestStatus === 'sent' ? colors.textSecondary : colors.primary)) }}>
                    {isFriend ? (isBestFriend ? 'Quitar de mejores amigos' : 'Añadir a mejores amigos') : (friendRequestStatus === 'received' ? 'Aceptar solicitud de amistad' : (friendRequestStatus === 'sent' ? 'Solicitud enviada' : 'Enviar solicitud de amistad'))}
                  </ThemedText>
                </div>
                <div style={dividerStyle} />
                <div style={{ ...rowStyle, color: '#FF9500' }} onClick={() => setShowClearAlert(true)}>
                  <Trash2 size={20} />
                  <ThemedText style={{ fontWeight: 600, color: '#FF9500' }}>Vaciar chat</ThemedText>
                </div>
              </div>

              <div style={menuContainerStyle}>
                <div style={{ ...rowStyle, color: colors.danger }}><Shield size={20} /><ThemedText style={{ fontWeight: 600, color: colors.danger }}>Bloquear a {user.displayName.split(' ')[0]}</ThemedText></div>
                <div style={dividerStyle} /><div style={{ ...rowStyle, color: colors.danger }}><AlertTriangle size={20} /><ThemedText style={{ fontWeight: 600, color: colors.danger }}>Reportar a {user.displayName.split(' ')[0]}</ThemedText></div>
              </div>
            </div>
          </>
        ) : activeSubView === 'starred' ? (
          <StarredMessagesView user={user} onBack={() => setActiveSubView(null)} />
        ) : activeSubView === 'media' ? (
          <SharedMediaView user={user} media={sharedMedia} onBack={() => setActiveSubView(null)} />
        ) : activeSubView === 'notifications' ? (
          <NotificationsView 
            mute={mute} 
            currentTone={alertTone}
            onMuteChange={async (m) => {
              setMute(m);
              await contactService.updateContactSettings(meId!, user.uid, { mute: m });
            }}
            onToneChange={async (t) => {
              setAlertTone(t);
              const { playTone } = await import('@/utils/toneGenerator');
              const toneMap: Record<string, string> = { 'Predeterminado': 'default', 'Clásico': 'classic', 'Suave': 'soft', 'Melodía': 'melody', 'Campana': 'bell', 'Pulso': 'pulse', 'Sin tono': 'silent' };
              playTone(toneMap[t] || 'default');
              await contactService.updateContactSettings(meId!, user.uid, { alertTone: t });
            }}
            onBack={() => setActiveSubView(null)} 
          />
        ) : activeSubView === 'photos' ? (
          <SaveToPhotosModal 
            current={saveToPhotos} 
            onSelect={async (p) => {
              setSaveToPhotos(p);
              await contactService.updateContactSettings(meId!, user.uid, { saveToPhotos: p });
              setActiveSubView(null);
            }} 
            onBack={() => setActiveSubView(null)} 
          />
        ) : activeSubView === 'share' ? (
          <ShareContactModal user={user} onBack={() => setActiveSubView(null)} />
        ) : null}
      </div>

      <AlertModal 
        isOpen={showClearAlert} 
        type="confirm" 
        title="Vaciar chat" 
        message={`¿Estás seguro de que quieres vaciar todos los mensajes del chat con ${user.displayName}? Esta acción no se puede deshacer.`}
        confirmText="Vaciar"
        showCancelButton
        onClose={() => setShowClearAlert(false)}
        onConfirm={async () => {
          const conversationId = [meId, user.uid].sort().join('_');
          await contactService.clearChat(conversationId, meId!);
          setShowClearAlert(false);
          onClose();
        }}
      />
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 10px; }
      `}</style>
    </>
  );
}


const handleDownload = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function StarredMessagesView({ user, onBack }: { user: User, onBack: () => void }) {
  const { colors } = useTheme();
  const meId = auth.currentUser?.uid;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!meId || !user.uid) return;
    const conversationId = [meId, user.uid].sort().join('_');
    import('@/services/starredMessagesService').then(service => {
      service.getStarredMessagesForDM(meId, conversationId).then(msgs => {
        setItems(msgs);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, [meId, user.uid]);

  const handleUnstar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const service = await import('@/services/starredMessagesService');
    await service.unstarMessage(meId!, id);
    setItems(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${colors.border}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
        <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>Mensajes destacados</ThemedText>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}><Loader2 size={32} className="animate-spin" color={colors.primary} /></div>
        ) : items.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, gap: 12, padding: 40, textAlign: 'center' }}>
            <Star size={48} />
            <ThemedText style={{ fontWeight: 700 }}>No hay destacados</ThemedText>
            <ThemedText style={{ fontSize: 13 }}>Los mensajes que destaques aparecerán aquí para que puedas encontrarlos fácilmente.</ThemedText>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((item) => (
              <div 
                key={item.id} 
                style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => {
                   const params = new URLSearchParams(location.search);
                   params.set('highlightId', item.id);
                   navigate({ search: params.toString() }, { replace: true });
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: 700, color: colors.primary, fontSize: 14 }}>{item.senderName || user.displayName}</ThemedText>
                    <ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>{new Date(item.createdAt).toLocaleString()}</ThemedText>
                  </div>
                  <button 
                    onClick={(e) => handleUnstar(item.id, e)} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFD60A' }}
                  >
                    <Star size={18} fill="#FFD60A" />
                  </button>
                </div>
                <ThemedText style={{ fontSize: 14, lineHeight: '1.4' }} numberOfLines={3}>{item.text || (item.type === 'image' ? '📷 Imagen' : item.type === 'file' ? '📎 Archivo' : 'Mensaje')}</ThemedText>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SharedMediaView({ user, media, onBack }: { user: User, media: SharedMedia[], onBack: () => void }) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'images' | 'videos' | 'files' | 'audio' | 'links'>('images');
  const [fullScreenMedia, setFullScreenMedia] = useState<SharedMedia | null>(null);

  const filteredMedia = useMemo(() => {
    return media.filter(m => {
      if (activeTab === 'images') return m.type === 'image';
      if (activeTab === 'videos') return m.type === 'video';
      if (activeTab === 'files') return m.type === 'file';
      if (activeTab === 'audio') return m.type === 'audio';
      if (activeTab === 'links') return m.type === 'link';
      return false;
    });
  }, [media, activeTab]);

  const tabs = [
    { id: 'images', label: `Imágenes (${media.filter(m => m.type === 'image').length})` },
    { id: 'videos', label: `Vídeos (${media.filter(m => m.type === 'video').length})` },
    { id: 'files', label: `Archivos (${media.filter(m => m.type === 'file').length})` },
    { id: 'audio', label: `Audio (${media.filter(m => m.type === 'audio').length})` },
    { id: 'links', label: `Enlaces (${media.filter(m => m.type === 'link').length})` },
  ];

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${colors.border}` }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
          <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>Archivos, enlaces y docs</ThemedText>
        </div>
        
        <div style={{ display: 'flex', overflowX: 'auto', padding: '0 10px', borderBottom: `1px solid ${colors.border}` }} className="no-scrollbar">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '16px 12px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? `3px solid ${colors.primary}` : '3px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <ThemedText style={{ fontSize: 13, fontWeight: 700, color: activeTab === tab.id ? colors.primary : colors.textSecondary }}>{tab.label}</ThemedText>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="custom-scrollbar">
          {filteredMedia.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, gap: 12 }}>
              <ImageIcon size={48} />
              <ThemedText>No hay elementos compartidos</ThemedText>
            </div>
          ) : (
            <div style={{ 
              display: activeTab === 'images' || activeTab === 'videos' ? 'grid' : 'flex',
              flexDirection: 'column',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8
            }}>
              {filteredMedia.map((item, i) => (
                <div key={i} onClick={() => (item.type === 'image' || item.type === 'video') ? setFullScreenMedia(item) : handleDownload(item.url, item.name)} style={{ cursor: 'pointer' }}>
                  {item.type === 'image' || item.type === 'video' ? (
                    <div style={{ aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', backgroundColor: colors.backgroundSecondary, position: 'relative' }}>
                      <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {item.type === 'video' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}><Play size={20} color="#fff" fill="#fff" /></div>}
                      <ThemedText style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 10, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{item.name}</ThemedText>
                    </div>
                  ) : item.type === 'audio' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: 12, border: `1px solid ${colors.border}`, marginBottom: 8 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={18} color={colors.primary} /></div>
                      <div style={{ flex: 1 }}><ThemedText style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</ThemedText><ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>{new Date(item.createdAt).toLocaleDateString()}</ThemedText></div>
                      <Download size={18} color={colors.textSecondary} />
                    </div>
                  ) : item.type === 'link' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: 12, border: `1px solid ${colors.border}`, marginBottom: 8 }} onClick={() => window.open(item.url, '_blank')}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={18} color={colors.primary} /></div>
                      <div style={{ flex: 1 }}><ThemedText style={{ fontSize: 14, fontWeight: 600 }} numberOfLines={1}>{item.name || item.url}</ThemedText><ThemedText style={{ fontSize: 11, color: colors.primary }} numberOfLines={1}>{item.url}</ThemedText></div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: 12, border: `1px solid ${colors.border}`, marginBottom: 8 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={18} color={colors.primary} /></div>
                      <div style={{ flex: 1 }}><ThemedText style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</ThemedText><ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>{ (item.size / 1024 / 1024).toFixed(1) } MB</ThemedText></div>
                      <Download size={18} color={colors.textSecondary} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {fullScreenMedia && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setFullScreenMedia(null)} style={{ position: 'absolute', top: 40, left: 20, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: '#fff', padding: 8, borderRadius: '50%' }}><ChevronLeft size={24} /></button>
          {fullScreenMedia.type === 'video' ? (
            <video src={fullScreenMedia.url} autoPlay controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : (
            <img src={fullScreenMedia.url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
          )}
          <div style={{ position: 'absolute', bottom: 40, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{fullScreenMedia.name}</ThemedText>
            <button 
              onClick={() => handleDownload(fullScreenMedia.url, fullScreenMedia.name)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: '#fff', padding: '8px 16px', borderRadius: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Download size={18} /> Guardar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function NotificationsView({ mute, currentTone, onMuteChange, onToneChange, onBack }: { mute: MuteDuration, currentTone: string, onMuteChange: (m: MuteDuration) => void, onToneChange: (t: string) => void, onBack: () => void }) {
  const { colors } = useTheme();
  
  const muteOptions: { id: MuteDuration, label: string, desc: string }[] = [
    { id: '8h', label: '8 horas', desc: 'Silenciar durante 8 horas' },
    { id: '1w', label: '1 semana', desc: 'Silenciar durante 7 días' },
    { id: 'always', label: 'Siempre', desc: 'Silenciar indefinidamente' },
    { id: 'off', label: 'No silenciar', desc: 'Recibir todas las notificaciones' }
  ];

  const tones = ['Predeterminado', 'Clásico', 'Suave', 'Melodía', 'Campana', 'Pulso', 'Sin tono'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${colors.border}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
        <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>Notificaciones</ThemedText>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }} className="custom-scrollbar">
        <ThemedText style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 12, marginLeft: 8 }}>Silenciar notificaciones</ThemedText>
        <div style={{ backgroundColor: colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: 24 }}>
          {muteOptions.map((opt, i) => (
            <React.Fragment key={opt.id}>
              <div onClick={() => onMuteChange(opt.id)} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: 700, fontSize: 15 }}>{opt.label}</ThemedText>
                  <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>{opt.desc}</ThemedText>
                </div>
                {mute === opt.id && <Check size={20} color={colors.primary} />}
              </div>
              {i < muteOptions.length - 1 && <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />}
            </React.Fragment>
          ))}
        </div>

        <ThemedText style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 12, marginLeft: 8 }}>Tono de alerta</ThemedText>
        <div style={{ backgroundColor: colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: 24 }}>
          {tones.map((tone, i) => (
            <React.Fragment key={tone}>
              <div onClick={() => onToneChange(tone)} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <Music size={18} color={colors.textSecondary} />
                <ThemedText style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{tone}</ThemedText>
                {currentTone === tone && <Check size={20} color={colors.primary} />}
              </div>
              {i < tones.length - 1 && <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 48 }} />}
            </React.Fragment>
          ))}
        </div>
        <ThemedText style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center', padding: '0 20px' }}>Toca un tono para escuchar una previsualización.</ThemedText>
      </div>
    </div>
  );
}

function SaveToPhotosModal({ current, onSelect, onBack }: { current: SaveToPhotosPreference, onSelect: (p: SaveToPhotosPreference) => void, onBack: () => void }) {
  const { colors } = useTheme();
  const options: { id: SaveToPhotosPreference, label: string, desc: string }[] = [
    { id: 'default', label: 'Por defecto (Sí)', desc: 'Guardar automáticamente según configuración global' },
    { id: 'always', label: 'Siempre', desc: 'Guardar siempre en la galería' },
    { id: 'never', label: 'Nunca', desc: 'No guardar nunca en la galería' }
  ];

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '24px 20px', boxShadow: '0 -10px 40px rgba(0,0,0,0.3)', zIndex: 50 }}>
      <div style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, margin: '0 auto 20px' }} />
      <ThemedText style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Guardar en Fotos</ThemedText>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {options.map(opt => (
          <div key={opt.id} onClick={() => onSelect(opt.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: 700, fontSize: 15 }}>{opt.label}</ThemedText>
              <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>{opt.desc}</ThemedText>
            </div>
            {current === opt.id && <Check size={20} color={colors.primary} />}
          </div>
        ))}
      </div>
      <button onClick={onBack} style={{ width: '100%', padding: 14, borderRadius: 12, backgroundColor: `${colors.text}10`, border: 'none', cursor: 'pointer' }}><ThemedText style={{ fontWeight: 700 }}>Cancelar</ThemedText></button>
    </div>
  );
}

function ShareContactModal({ user, onBack }: { user: User, onBack: () => void }) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    return subscribeToConversations(meId, setConversations);
  }, []);

  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    if (activeTab === 'channels') {
      return CHANNELS.filter(c => c.name.toLowerCase().includes(q));
    } else {
      return conversations.filter(c => c.participantName.toLowerCase().includes(q));
    }
  }, [activeTab, query, conversations]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (selectedIds.size === 0) return;
    setSending(true);
    try {
      const me = auth.currentUser;
      if (!me) return;

      const messageText = `👤 ${user.displayName} — ${user.bio || 'Sin descripción'}`;
      const batch = writeBatch(db);
      
      for (const id of Array.from(selectedIds)) {
        if (activeTab === 'channels') {
          const chMsgRef = doc(collection(db, 'channels', id, 'messages'));
          batch.set(chMsgRef, {
            text: messageText,
            senderId: me.uid,
            senderName: me.displayName || 'Tú',
            senderPhoto: me.photoURL,
            createdAt: serverTimestamp(),
            edited: false,
            reactions: {},
            replyTo: null,
            forwarded: true
          });
        } else {
          const conv = conversations.find(c => c.id === id);
          if (conv) {
            const convId = await getOrCreateConversation(me.uid, conv.participantId);
            const dmMsgRef = doc(collection(db, 'conversations', convId, 'messages'));
            batch.set(dmMsgRef, {
              text: messageText,
              senderId: me.uid,
              senderName: me.displayName || 'Tú',
              senderPhoto: me.photoURL,
              createdAt: serverTimestamp(),
              edited: false,
              reactions: {},
              replyTo: null,
              forwarded: true
            });
          }
        }
      }

      await batch.commit();
      onBack();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.background }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${colors.border}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
        <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>Compartir contacto</ThemedText>
      </div>

      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.border}` }}>
        <ThemedText style={{ fontSize: 12, color: colors.textSecondary, display: 'block', marginBottom: 4 }}>Contacto a compartir</ThemedText>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {user.photoURL ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ThemedText style={{ color: '#fff', fontWeight: 'bold' }}>{user.displayName[0]}</ThemedText>}
          </div>
          <ThemedText style={{ fontSize: 16, fontWeight: 800 }}>{user.displayName}</ThemedText>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
        {(['channels', 'dms'] as const).map(t => (
          <button key={t} onClick={() => { setActiveTab(t); setQuery(''); }} style={{ flex: 1, padding: 16, background: 'none', border: 'none', borderBottom: activeTab === t ? `2px solid ${colors.primary}` : 'none', cursor: 'pointer' }}>
            <ThemedText style={{ fontWeight: 700, color: activeTab === t ? colors.primary : colors.textSecondary }}>{t === 'channels' ? 'Canales' : 'Mensajes directos'}</ThemedText>
          </button>
        ))}
      </div>

      <div style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: colors.backgroundSecondary, borderRadius: 10 }}>
          <Search size={16} color={colors.textSecondary} />
          <input 
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={activeTab === 'channels' ? "Buscar canal..." : "Buscar chat..."}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: 14 }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        {filteredItems.map((item: any) => {
          const id = item.id;
          const isSelected = selectedIds.has(id);
          const name = activeTab === 'channels' ? item.name : item.participantName;
          const photo = activeTab === 'channels' ? null : item.participantPhoto;
          const desc = activeTab === 'channels' ? item.description : (item.participantRole === 'teacher' ? 'Profesor/a' : 'Estudiante');

          return (
            <div key={id} onClick={() => toggleSelect(id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer' }}>
              <div style={{ width: 44, height: 44, borderRadius: activeTab === 'channels' ? 12 : 22, backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {activeTab === 'channels' ? <Hash size={20} color={colors.primary} /> : (photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ThemedText style={{ fontWeight: 'bold' }}>{name[0]}</ThemedText>)}
              </div>
              <div style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: 700 }}>{name}</ThemedText>
                <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>{desc}</ThemedText>
              </div>
              <div style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${isSelected ? colors.primary : colors.border}`, backgroundColor: isSelected ? colors.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: 20, borderTop: `1px solid ${colors.border}` }}>
        <button 
          onClick={handleSend}
          disabled={selectedIds.size === 0 || sending}
          style={{ width: '100%', padding: '16px', borderRadius: 16, backgroundColor: selectedIds.size > 0 ? colors.primary : colors.border, border: 'none', cursor: selectedIds.size > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {sending ? <Loader2 size={24} className="animate-spin" color="#fff" /> : <><Send size={20} color="#fff" /><ThemedText style={{ fontWeight: 700, color: '#fff' }}>Enviar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</ThemedText></>}
        </button>
      </div>
    </div>
  );
}
