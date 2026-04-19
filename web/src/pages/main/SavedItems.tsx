import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';
import { MessageSquare, Bookmark, Trash2, Image as ImageIcon, PlayCircle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import {
  subscribeToSavedMessages,
  subscribeToSavedPosts,
  unsaveMessage,
  unsavePost,
  type SavedMessage,
  type SavedPost
} from '../../services/firebase/savedItemsService';

type Tab = 'messages' | 'posts';

export default function SavedItems() {
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('messages');
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { navigate('/login'); return; }
      setUserId(user.uid);
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;
    const unsubMsgs = subscribeToSavedMessages(userId, msgs => {
      setSavedMessages(msgs);
      setLoading(false);
    });
    const unsubPosts = subscribeToSavedPosts(userId, posts => {
      setSavedPosts(posts);
      setLoading(false);
    });
    return () => { unsubMsgs(); unsubPosts(); };
  }, [userId]);

  const handleUnsaveMessage = async (id: string) => {
    if (!userId) return;
    await unsaveMessage(userId, id).catch(() => {});
  };

  const handleUnsavePost = async (id: string) => {
    if (!userId) return;
    await unsavePost(userId, id).catch(() => {});
  };

  const formatDate = (val: any): string => {
    try {
      const d = val?.toDate ? val.toDate() : new Date(val);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  const tabStyle = (t: Tab) => ({
    flex: 1,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: '6px',
    flexDirection: 'row' as const,
    padding: '10px',
    borderRadius: '10px',
    cursor: 'pointer' as const,
    border: 'none',
    background: tab === t ? 'var(--background)' : 'transparent',
    color: tab === t ? colors.primary : 'var(--text-secondary)',
    fontWeight: '600' as const,
    fontSize: '14px',
    transition: 'all 0.15s'
  });

  return (
    <Layout title={t('saved.title')}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 0 80px' }}>
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: 'var(--background-secondary)',
            borderRadius: '12px',
            padding: '4px'
          }}>
            <button style={tabStyle('messages')} onClick={() => setTab('messages')}>
              <MessageSquare size={16} />
              {t('saved.tabs.messages')}
            </button>
            <button style={tabStyle('posts')} onClick={() => setTab('posts')}>
              <Bookmark size={16} />
              {t('saved.tabs.posts')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-container"><div className="loading-spinner" /></div>
        ) : tab === 'messages' ? (
          savedMessages.length === 0 ? (
            <EmptyState label={t('saved.no_items')} />
          ) : (
            <div style={{ padding: '0 16px' }}>
              {savedMessages.map(msg => (
                <div
                  key={msg.id}
                  onClick={() => {
                    const base = msg.chatType === 'channel' ? `/chat/${msg.originalChannelId}` : `/messages/${msg.originalChannelId}`;
                    navigate(`${base}?messageId=${msg.id}`);
                  }}
                  style={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    marginBottom: '10px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '13px',
                        backgroundColor: colors.primary,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 'bold', color: '#fff', flexShrink: 0
                      }}>
                        {msg.senderName.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text)' }}>
                        {msg.senderName}
                      </span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleUnsaveMessage(msg.id); }} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                      color: '#e05252', display: 'flex'
                    }}>
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {msg.attachments?.some(a => a.type === 'audio') ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', opacity: 0.7 }}>
                      <PlayCircle size={16} color={colors.primary} />
                      <span style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>Mensaje de voz</span>
                    </div>
                  ) : msg.attachments && msg.attachments.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', opacity: 0.7 }}>
                      <ImageIcon size={16} color={colors.primary} />
                      <span style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>Imagen / Archivo</span>
                    </div>
                  ) : null}

                  {msg.text && (
                    <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--text)', lineHeight: '1.5',
                      display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {msg.text}
                    </p>
                  )}

                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.6 }}>
                    Guardado el {formatDate(msg.savedAt)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : (
          savedPosts.length === 0 ? (
            <EmptyState label={t('saved.no_items')} />
          ) : (
            <div style={{ padding: '0 16px' }}>
              {savedPosts.map(post => (
                <div
                  key={post.id}
                  style={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    marginBottom: '10px',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(`/post/${post.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text)', flex: 1, marginRight: '8px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {post.title}
                    </span>
                    <button onClick={e => { e.stopPropagation(); handleUnsavePost(post.id); }} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                      color: '#e05252', display: 'flex', flexShrink: 0
                    }}>
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {post.mediaUrl && (
                    <img src={post.mediaUrl} alt="" style={{
                      width: '100%', height: '140px', objectFit: 'cover',
                      borderRadius: '10px', marginBottom: '8px'
                    }} />
                  )}

                  <p style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.5',
                    display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {post.content}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                      De {post.authorName}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', opacity: 0.6 }}>
                      {formatDate(post.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </Layout>
  );
}

function EmptyState({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px', gap: '12px' }}>
      <Bookmark size={56} strokeWidth={1.2} color="var(--border)" />
      <p style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text)', margin: 0 }}>{label}</p>
      <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, textAlign: 'center' }}>
        {t('saved.no_items_desc')}
      </p>
    </div>
  );
}
