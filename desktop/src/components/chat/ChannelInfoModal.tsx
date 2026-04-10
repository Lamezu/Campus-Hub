import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, ChevronLeft, Search, Plus, 
  Bell, Trash2, LogOut, ChevronRight,
  UserPlus, Check, Loader2, Camera, Star, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { auth, db } from '@/config/firebase';
import { 
  doc, getDoc, collection, query, 
  where, getDocs, onSnapshot, 
  updateDoc, arrayRemove, deleteDoc, limit, arrayUnion
} from 'firebase/firestore';
import type { User, Channel } from '@/types';
import { AlertModal } from '@/components/AlertModal';
import { useCurrentUser } from '@/contexts/UserContext';
import { ContactInfoModal } from '@/components/dm/ContactInfoModal';
import { InviteMembersModal } from './InviteMembersModal';
import { uploadChannelPhoto } from '@/config/cloudinary';

interface ChannelInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  channelName: string;
}

export function ChannelInfoModal({ isOpen, onClose, channelId, channelName }: ChannelInfoModalProps) {
  const { colors } = useTheme();
  const { isAdmin } = useCurrentUser();
  const meId = auth.currentUser?.uid;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showStarredView, setShowStarredView] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [channelData, setChannelData] = useState<any>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showClearAlert, setShowClearAlert] = useState(false);
  const [showExitAlert, setShowExitAlert] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handleClearChat = async (forAll = false) => {
    if (!channelId || !meId) return;
    try {
      const messagesRef = collection(db, 'channels', channelId, 'messages');
      const q = query(messagesRef);
      const snap = await getDocs(q);
      
      if (forAll && isAdmin) {
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
      } else {
        await Promise.all(snap.docs.map(d => updateDoc(d.ref, {
          deletedForUsers: arrayUnion(meId)
        })));
      }
      setShowClearAlert(false);
      onClose();
    } catch (e) {
      console.error('Error clearing chat:', e);
    }
  };

  const handleExitGroup = async () => {
    if (!channelId || !meId) return;
    try {
      const sgRef = doc(db, 'studyGroups', channelId);
      const chRef = doc(db, 'channels', channelId);
      const sgSnap = await getDoc(sgRef);
      const targetRef = sgSnap.exists() ? sgRef : chRef;
      
      await updateDoc(targetRef, {
        memberIds: arrayRemove(meId)
      });
      setShowExitAlert(false);
      onClose();
    } catch (e) {
      console.error('Error exiting group:', e);
    }
  };

  useEffect(() => {
    if (!isOpen || !channelId) return;

    let unsub: () => void;
    
    const loadChannel = async () => {
      setLoading(true);
      try {
        const sgRef = doc(db, 'studyGroups', channelId);
        const chRef = doc(db, 'channels', channelId);
        
        const sgSnap = await getDoc(sgRef);
        const targetRef = sgSnap.exists() ? sgRef : chRef;

        unsub = onSnapshot(targetRef, async (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setChannelData(data);
            
            const systemChannels = ['general', 'anuncios oficiales', 'eventos y actividad', 'ayuda y soporte'];
            const nameToTest = (data.name || '').toLowerCase();
            const idToTest = (channelName || '').toLowerCase();
            const isSystemChannel = systemChannels.includes(nameToTest) || systemChannels.includes(idToTest);
            (snap as any).isSystem = isSystemChannel; // Tag it for UI

            if (data.memberIds && data.memberIds.length > 0 && !isSystemChannel) {
              const memberDocs = await Promise.all(
                data.memberIds.map((uid: string) => getDoc(doc(db, 'users', uid)))
              );
              setMembers(memberDocs.filter(d => d.exists()).map(d => ({ uid: d.id, ...d.data() } as User)));
            } else {
              const qUsers = query(collection(db, 'users'));
              const uSnap = await getDocs(qUsers);
              setMembers(uSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
            }
          } else {
            const qUsers = query(collection(db, 'users'));
            const uSnap = await getDocs(qUsers);
            setMembers(uSnap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
          }
          setLoading(false);
        });
      } catch (e) {
        console.error(e);
        setLoading(false);
      }
    };

    loadChannel();
    return () => unsub?.();
  }, [isOpen, channelId, meId]);

  const filteredMembers = useMemo(() => {
    return members.filter(m => 
      m.displayName.toLowerCase().includes(search.toLowerCase())
    );
  }, [members, search]);

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channelId) return;

    setUploadingPhoto(true);
    try {
      const url = await uploadChannelPhoto(file, channelId);
      const sgRef = doc(db, 'studyGroups', channelId);
      const chRef = doc(db, 'channels', channelId);
      
      const sgSnap = await getDoc(sgRef);
      const targetRef = sgSnap.exists() ? sgRef : chRef;

      await updateDoc(targetRef, { photoURL: url });
    } catch (error) {
      console.error('Error updating group photo:', error);
    } finally {
      setUploadingPhoto(false);
    }
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
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.background, zIndex: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
          <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>Info. del canal</ThemedText>
          <div style={{ width: 32 }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }} className="custom-scrollbar">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
            <div style={{ position: 'relative', marginBottom: 16, cursor: 'pointer' }} onClick={handlePhotoClick}>
              <div style={{ width: 110, height: 110, borderRadius: '50%', overflow: 'hidden', border: `4px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, position: 'relative' }}>
                {uploadingPhoto ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 2 }}>
                    <Loader2 size={32} className="animate-spin" color="#fff" />
                  </div>
                ) : null}
                {channelData?.photoURL ? (
                  <img src={channelData.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ThemedText style={{ fontSize: 40, fontWeight: 'bold', color: '#fff' }}>{channelName[0]}</ThemedText>
                  </div>
                )}
              </div>
              <button style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, border: `2px solid ${colors.background}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Camera size={16} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/*" style={{ display: 'none' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ThemedText style={{ fontSize: 24, fontWeight: 800 }}>{channelName}</ThemedText>
              {(channelData as any)?.isSystem && <CheckCircle2 size={20} color="#007AFF" fill="#007AFF15" />}
            </div>
            {(channelData as any)?.isSystem && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: `${colors.primary}10`, padding: '4px 12px', borderRadius: 20, marginBottom: 12, border: `1px solid ${colors.primary}30` }}>
                <ShieldCheck size={14} color={colors.primary} />
                <ThemedText style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>CANAL OFICIAL</ThemedText>
              </div>
            )}
            <ThemedText style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 4 }}>Canal del Campus • {members.length} miembros</ThemedText>
            <ThemedText style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>{channelData?.description || 'Canal oficial para toda la comunidad del Campus'}</ThemedText>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <ThemedText style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>Miembros</ThemedText>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, marginLeft: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', backgroundColor: colors.backgroundSecondary, borderRadius: 10, flex: 1 }}>
                  <Search size={14} color={colors.textSecondary} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar miembro..." style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: 13 }} />
                </div>
              </div>
            </div>
            
            <div style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', maxHeight: 320 }}>
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '14px 16px', 
                  color: colors.primary, 
                  cursor: (channelData as any)?.isSystem ? 'default' : 'pointer', 
                  borderBottom: `1px solid ${colors.border}`, 
                  flexShrink: 0, 
                  transition: 'background-color 0.2s',
                  opacity: (channelData as any)?.isSystem ? 0.5 : 1
                }} 
                onMouseEnter={e => !(channelData as any)?.isSystem && (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)} 
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')} 
                onClick={() => !(channelData as any)?.isSystem && setShowInviteModal(true)}
              >
                <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserPlus size={18} /></div>
                <ThemedText style={{ fontWeight: 700, color: colors.primary }}>Añadir miembros</ThemedText>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }} className="custom-scrollbar">
                {filteredMembers.map((member, i) => (
                  <React.Fragment key={member.uid}>
                    {i > 0 && <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 64 }} />}
                    <div 
                      onClick={() => setSelectedUser(member)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }} 
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} 
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.backgroundSecondary }}>
                        {member.photoURL ? <img src={member.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ThemedText style={{ fontWeight: 800, color: colors.textSecondary }}>{member.displayName[0]}</ThemedText></div>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <ThemedText style={{ fontWeight: 700 }}>{member.uid === meId ? 'Tú' : member.displayName}</ThemedText>
                        <ThemedText style={{ fontSize: 12, color: colors.textSecondary }} numberOfLines={1}>{member.bio || 'Sin biografía'}</ThemedText>
                      </div>
                      <ChevronRight size={18} color={colors.textSecondary} />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${colors.border}`, marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' }} onClick={() => setIsMuted(!isMuted)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Bell size={20} color={colors.textSecondary} />
                <ThemedText style={{ fontWeight: 600 }}>Silenciar notificaciones</ThemedText>
              </div>
              <div style={{ width: 40, height: 22, borderRadius: 11, backgroundColor: isMuted ? colors.primary : colors.border, position: 'relative', transition: '0.2s' }}>
                <div style={{ position: 'absolute', top: 2, left: isMuted ? 20 : 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', transition: '0.2s shadow, 0.2s left' }} />
              </div>
            </div>
            <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 48 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }} onClick={() => setShowStarredView(true)}>
              <Star size={20} color={colors.textSecondary} />
              <ThemedText style={{ fontWeight: 600 }}>Mensajes destacados</ThemedText>
            </div>
            <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 48 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', color: '#FF9500' }} onClick={() => setShowClearAlert(true)}>
              <Trash2 size={20} />
              <ThemedText style={{ fontWeight: 600, color: '#FF9500' }}>Vaciar chat</ThemedText>
            </div>
            <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 48 }} />
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12, 
                padding: '14px 16px', 
                cursor: (channelData as any)?.isSystem && !isAdmin ? 'default' : 'pointer', 
                color: colors.danger,
                opacity: (channelData as any)?.isSystem && !isAdmin ? 0.5 : 1
              }} 
              onClick={() => (!((channelData as any)?.isSystem && !isAdmin)) && setShowExitAlert(true)}
            >
              <LogOut size={20} />
              <ThemedText style={{ fontWeight: 600, color: colors.danger }}>
                {(channelData as any)?.isSystem ? 'Canal obligatorio' : 'Salir del grupo'}
              </ThemedText>
            </div>
          </div>

          {(channelData as any)?.isSystem && (
            <div style={{ padding: '0 16px', opacity: 0.6, textAlign: 'center' }}>
              <ThemedText style={{ fontSize: 12 }}>Este es un canal oficial gestionado por el CampusHub. No puedes abandonar este canal.</ThemedText>
            </div>
          )}
        </div>
        
        {showStarredView && (
          <div style={{ position: 'absolute', inset: 0, backgroundColor: colors.background, zIndex: 50, display: 'flex', flexDirection: 'column' }}>
            <StarredMessagesView 
              channelId={channelId} 
              onBack={() => setShowStarredView(false)} 
            />
          </div>
        )}
      </div>

      <InviteMembersModal 
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        channelId={channelId}
        currentMemberIds={members.map(m => m.uid)}
        onAdded={() => {}} 
      />

      {selectedUser && (
        <ContactInfoModal 
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          user={selectedUser}
        />
      )}

      <AlertModal 
        isOpen={showClearAlert} 
        type="confirm" 
        title="Vaciar chat" 
        message={`¿Estás seguro de que quieres vaciar los mensajes de ${channelName}?`}
        confirmText="Vaciar para mí"
        confirmText2={isAdmin ? "Vaciar para todos" : undefined}
        cancelText="Volver"
        confirmStyle={{ backgroundColor: colors.danger, color: '#fff' }}
        confirm2Style={{ backgroundColor: colors.danger, color: '#fff' }}
        cancelStyle={{ backgroundColor: colors.backgroundSecondary, color: colors.text, opacity: 1, fontWeight: '700' }}
        onClose={() => setShowClearAlert(false)}
        onConfirm={() => handleClearChat(false)}
        onConfirm2={() => handleClearChat(true)}
      />

      <AlertModal 
        isOpen={showExitAlert} 
        type="confirm" 
        title="Salir del grupo" 
        message={`¿Estás seguro de que quieres salir de ${channelName}?`}
        confirmText="Salir del grupo"
        cancelText="Volver"
        confirmStyle={{ backgroundColor: colors.danger, color: '#fff' }}
        cancelStyle={{ backgroundColor: colors.backgroundSecondary, color: colors.text, opacity: 1, fontWeight: '700' }}
        onClose={() => setShowExitAlert(false)}
        onConfirm={handleExitGroup}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 10px; }
      `}</style>
    </>
  );
}

function StarredMessagesView({ channelId, onBack }: { channelId: string; onBack: () => void }) {
  const { colors } = useTheme();
  const meId = auth.currentUser?.uid;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!meId || !channelId) return;
    import('@/services/starredMessagesService').then(service => {
      service.getStarredMessagesForChannel(meId, channelId).then(msgs => {
        setItems(msgs);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, [meId, channelId]);

  const handleUnstar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const service = await import('@/services/starredMessagesService');
    await service.unstarMessage(meId!, id);
    setItems(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.background }}>
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
                    <ThemedText style={{ fontWeight: 700, color: colors.primary, fontSize: 14 }}>{item.senderName}</ThemedText>
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
