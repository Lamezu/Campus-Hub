import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  collection, query, where, getDocs, addDoc,
  serverTimestamp, doc, updateDoc, increment, arrayUnion, getDoc,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { useTheme } from '../contexts/ThemeContext';
import { X, Search, Check, Send, Hash, Users, MessageCircle, MessagesSquare } from 'lucide-react';
import { sendMessage } from '../services/firebase/directMessageService';
import { sendGroupMessage } from '../services/firebase/groupDMService';

type Tab = 'general' | 'grupos' | 'mensajes' | 'gruposDM';

interface ShareTarget {
  id: string;
  name: string;
  type: 'channel' | 'studyGroup' | 'dm' | 'groupDM';
  subtitle?: string;
  photo?: string | null;
}

interface SharePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post?: any;
  message?: any;
}

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'general',  label: 'General',    icon: <Hash size={15} /> },
  { key: 'grupos',   label: 'Mis grupos', icon: <Users size={15} /> },
  { key: 'mensajes', label: 'Mensajes',   icon: <MessageCircle size={15} /> },
  { key: 'gruposDM', label: 'Grupos DM',  icon: <MessagesSquare size={15} /> },
];

export default function SharePostModal({ isOpen, onClose, post, message }: SharePostModalProps) {
  const isMessageMode = !!message && !post;
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('general');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setSelected([]);
    setTab('general');
    loadTargets('general');
  }, [isOpen]);

  const loadTargets = async (t: Tab) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      let newTargets: ShareTarget[] = [];

      if (t === 'general') {
        newTargets = [{
          id: '1',
          name: 'Canal General',
          type: 'channel',
          subtitle: 'Canal general para todos',
        }];
      } else if (t === 'grupos') {
        const snap = await getDocs(
          query(collection(db, 'studyGroups'), where('memberIds', 'array-contains', uid))
        );
        newTargets = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || 'Grupo',
          type: 'studyGroup' as const,
          subtitle: `${d.data().memberIds?.length ?? 0} miembros`,
        }));
      } else if (t === 'mensajes') {
        const snap = await getDocs(
          query(collection(db, 'conversations'), where('participants', 'array-contains', uid))
        );
        const enriched = await Promise.all(
          snap.docs.map(async d => {
            const participants: string[] = d.data().participants || [];
            const otherId = participants.find(p => p !== uid);
            if (!otherId) return null;
            const userSnap = await getDoc(doc(db, 'users', otherId));
            const userData = userSnap.data();
            return {
              id: d.id,
              name: userData?.displayName || 'Usuario',
              type: 'dm' as const,
              photo: userData?.photoURL || null,
            };
          })
        );
        newTargets = enriched.filter(Boolean) as ShareTarget[];
      } else if (t === 'gruposDM') {
        const snap = await getDocs(
          query(collection(db, 'groupConversations'), where('members', 'array-contains', uid))
        );
        newTargets = snap.docs.map(d => ({
          id: d.id,
          name: d.data().name || 'Grupo DM',
          type: 'groupDM' as const,
          subtitle: `${d.data().members?.length ?? 0} miembros`,
        }));
      }

      setTargets(newTargets);
    } catch (e) {
      console.error('SharePostModal loadTargets error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    setSelected([]);
    setSearch('');
    loadTargets(t);
  };

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleShare = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || selected.length === 0 || sending) return;
    if (!post && !message) return;
    setSending(true);
    try {
      const senderName = auth.currentUser?.displayName || 'Usuario';
      const senderPhoto = auth.currentUser?.photoURL || null;

      // Build what to send depending on mode
      const msgText = isMessageMode ? (message.text || '') : '';
      const msgAttachments = isMessageMode
        ? (message.attachments || null)
        : [{
            type: 'post',
            url: post.mediaUrl || '',
            name: post.title || '',
            size: 0,
            postId: post.id,
            postTitle: post.title || '',
            postContent: post.content || '',
            postAuthorName: post.authorName || '',
            postAuthorPhoto: post.authorPhoto || '',
          }];

      const baseDoc = {
        text: msgText,
        senderId: uid,
        senderName,
        senderPhoto,
        createdAt: serverTimestamp(),
        edited: false,
        editedAt: null,
        attachments: msgAttachments,
        reactions: {},
        deletedForUsers: [],
        isForwarded: true,
        ...(isMessageMode && message.senderName ? { originalSender: message.senderName } : {}),
      };

      for (const targetId of selected) {
        const target = targets.find(t => t.id === targetId);
        if (!target) continue;

        try {
          if (target.type === 'channel') {
            await addDoc(collection(db, 'channels', '1', 'messages'), baseDoc);
          } else if (target.type === 'studyGroup') {
            // Chat.tsx usa channels/sg_{groupId}/messages para grupos de estudio
            await addDoc(collection(db, 'channels', `sg_${targetId}`, 'messages'), baseDoc);
          } else if (target.type === 'dm') {
            await sendMessage(targetId, msgText, uid, senderName, senderPhoto, msgAttachments as any);
          } else if (target.type === 'groupDM') {
            await sendGroupMessage(targetId, uid, senderName, senderPhoto, msgText, msgAttachments);
          }
        } catch (e: any) {
          console.warn(`No se pudo enviar a "${target.name}":`, e?.code, e?.message);
        }
      }

      // Track shares only for posts
      if (!isMessageMode && post?.id) {
        await updateDoc(doc(db, 'posts', post.id), {
          sharesCount: increment(selected.length),
          sharedBy: arrayUnion(uid),
        }).catch(() => {});
      }

      onClose();
    } catch (e) {
      console.error('Error sharing:', e);
    } finally {
      setSending(false);
    }
  };

  const filtered = targets.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen || (!post && !message)) return null;

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 3000,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        backgroundColor: colors.background,
        borderRadius: '16px',
        width: '90%',
        maxWidth: '480px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: colors.text, margin: 0 }}>
            {isMessageMode ? 'Reenviar mensaje' : 'Compartir post'}
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Preview */}
        <div style={{
          padding: '10px 16px',
          backgroundColor: colors.backgroundSecondary,
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          {!isMessageMode && post?.mediaUrl && post.mediaType === 'image' && (
            <img src={post.mediaUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            {isMessageMode ? (
              <>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 2 }}>
                  {message.senderName}
                </div>
                <div style={{ fontSize: 13, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {message.text || (message.attachments?.length ? '📎 Adjunto' : '')}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {post?.title}
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {post?.authorName}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.backgroundSecondary,
        }}>
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              style={{
                flex: 1,
                padding: '10px 4px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                color: tab === key ? colors.primary : colors.textSecondary,
                borderBottom: tab === key ? `2px solid ${colors.primary}` : '2px solid transparent',
                fontSize: 11,
                fontWeight: tab === key ? '600' : '400',
                transition: 'all 0.15s',
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        {tab !== 'general' && (
          <div style={{ padding: '10px 16px', position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 34px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.backgroundSecondary,
                color: colors.text,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>
              Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>
              {search ? 'Sin resultados' : 'No hay destinos disponibles'}
            </div>
          ) : filtered.map(target => {
            const isSelected = selected.includes(target.id);
            return (
              <div
                key={target.id}
                onClick={() => toggle(target.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 16px', cursor: 'pointer',
                  backgroundColor: isSelected ? colors.primary + '14' : 'transparent',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = colors.backgroundSecondary; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                  border: `2px solid ${isSelected ? colors.primary : colors.border}`,
                  backgroundColor: isSelected ? colors.primary : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {isSelected && <Check size={13} color="#fff" />}
                </div>

                {/* Avatar */}
                {target.photo !== undefined ? (
                  target.photo ? (
                    <img src={target.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{target.name[0]?.toUpperCase()}</span>
                    </div>
                  )
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.backgroundSecondary, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {target.type === 'channel' && <Hash size={18} color={colors.primary} />}
                    {target.type === 'studyGroup' && <Users size={18} color={colors.primary} />}
                    {target.type === 'groupDM' && <MessagesSquare size={18} color={colors.primary} />}
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: '500', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {target.name}
                  </div>
                  {target.subtitle && (
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
                      {target.subtitle}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px', borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: 'transparent', color: colors.text,
              fontSize: 14, fontWeight: '500', cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleShare}
            disabled={selected.length === 0 || sending}
            style={{
              padding: '9px 18px', borderRadius: 8,
              border: 'none', backgroundColor: colors.primary,
              color: '#fff', fontSize: 14, fontWeight: '600',
              cursor: selected.length === 0 || sending ? 'not-allowed' : 'pointer',
              opacity: selected.length === 0 || sending ? 0.5 : 1,
              display: 'flex', alignItems: 'center', gap: 7,
              transition: 'opacity 0.15s',
            }}
          >
            <Send size={15} />
            {sending ? 'Enviando...' : `Compartir${selected.length > 0 ? ` (${selected.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
