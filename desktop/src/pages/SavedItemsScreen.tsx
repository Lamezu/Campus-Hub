import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, MessageSquare, Bookmark, Trash2, PlayCircle, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { auth } from '@/config/firebase';
import { subscribeToSavedMessages, subscribeToSavedPosts, unsaveMessage, toggleSavePost, type SavedMessage } from '@/services/savedItemsService';
import { spacing } from '@/constants/styles';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Post } from '@/types';

type TabType = 'messages' | 'posts';

export default function SavedItemsScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    const unsubMessages = subscribeToSavedMessages(currentUser.uid, (msgs) => {
      setSavedMessages(msgs);
      setLoading(false);
    });
    const unsubPosts = subscribeToSavedPosts(currentUser.uid, (posts) => {
      setSavedPosts(posts);
    });
    return () => { unsubMessages(); unsubPosts(); };
  }, [currentUser]);

  const handleUnsaveMessage = async (id: string) => {
    if (!currentUser) return;
    try { await unsaveMessage(currentUser.uid, id); } catch { }
  };

  const handleUnsavePost = async (id: string) => {
    if (!currentUser) return;
    try { await toggleSavePost(currentUser.uid, id); } catch { }
  };

  const isWithinFilter = (date: any) => {
    if (dateFilter === 'all' || !date) return true;
    const ts = typeof date === 'string' ? new Date(date).getTime() : date?.seconds ? date.seconds * 1000 : new Date(date).getTime();
    if (isNaN(ts)) return true;

    const now = new Date();
    const itemDate = new Date(ts);

    if (dateFilter === 'today') {
      return itemDate.toDateString() === now.toDateString();
    }
    if (dateFilter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return itemDate >= oneWeekAgo;
    }
    if (dateFilter === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(now.getMonth() - 1);
      return itemDate >= oneMonthAgo;
    }
    return true;
  };

  const filteredMessages = savedMessages.filter(m => isWithinFilter(m.savedAt || m.createdAt));
  const filteredPosts = savedPosts.filter(p => isWithinFilter(p.createdAt));

  const formatDate = (raw: any): string => {
    if (!raw) return '';
    const ts = typeof raw === 'string' ? new Date(raw).getTime() : raw?.seconds ? raw.seconds * 1000 : new Date(raw).getTime();
    if (isNaN(ts)) return '';
    const dateStr = new Date(ts).toLocaleDateString();
    return t('saved_items.labels.saved_at', { date: dateStr });
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: colors.background }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.background, flexShrink: 0 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.text, display: 'flex' }}><ChevronLeft size={24} /></button>
          <ThemedText style={{ fontWeight: '700', fontSize: 16 }}>{t('saved_items.title')}</ThemedText>
          <div style={{ width: 32 }} />
        </div>
        <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, flexShrink: 0 }}>
          <div style={{ display: 'flex', backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: 4, gap: 4 }}>
            {(['messages', 'posts'] as TabType[]).map(tabKey => (
              <button 
                key={tabKey} 
                onClick={() => setActiveTab(tabKey)} 
                style={{ 
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, 
                  padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', 
                  backgroundColor: activeTab === tabKey ? colors.card : 'transparent', 
                  boxShadow: activeTab === tabKey ? '0 2px 8px rgba(0,0,0,0.1)' : 'none', 
                  transition: 'all 0.2s' 
                }}
              >
                {tabKey === 'messages' ? 
                  <MessageSquare size={18} color={activeTab === tabKey ? colors.primary : colors.textSecondary} /> : 
                  <Bookmark size={18} color={activeTab === tabKey ? colors.primary : colors.textSecondary} />
                }
                <span style={{ fontSize: 14, fontWeight: '600', color: activeTab === tabKey ? colors.text : colors.textSecondary }}>
                  {tabKey === 'messages' ? t('saved_items.tabs.messages') : t('saved_items.tabs.posts')}
                </span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }} className="no-scrollbar">
            {[
              { id: 'all', label: t('saved_items.filters.all') },
              { id: 'today', label: t('saved_items.filters.today') },
              { id: 'week', label: t('saved_items.filters.week') },
              { id: 'month', label: t('saved_items.filters.month') }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setDateFilter(filter.id as any)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: '600', whiteSpace: 'nowrap',
                  backgroundColor: dateFilter === filter.id ? colors.primary : colors.backgroundSecondary,
                  color: dateFilter === filter.id ? '#FFF' : colors.textSecondary,
                  transition: 'all 0.2s'
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${spacing.lg}px ${spacing.lg}px` }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 60 }}><div style={{ width: 32, height: 32, border: `3px solid ${colors.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>
          ) : (activeTab === 'messages' ? filteredMessages : filteredPosts).length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 100, gap: 12, opacity: 0.6 }}>
              <Bookmark size={64} color={colors.border} strokeWidth={1} />
              <ThemedText style={{ fontSize: 18, fontWeight: 'bold' }}>
                {dateFilter === 'all' ? t('saved_items.empty.none') : t('saved_items.empty.filtered')}
              </ThemedText>
            </div>
          ) : activeTab === 'messages' ? (
            filteredMessages.map(item => {
              const media = item.attachments?.find(a => a.type === 'image' || a.type === 'video');
              const isAudio = item.attachments?.some(a => a.type === 'audio');
              return (
                <div key={item.id} onClick={() => navigate(item.isDM ? `/dm/${item.participantId}` : `/chat/${item.originalChannelId}`)} style={{ border: `1px solid ${colors.border}`, padding: spacing.md, borderRadius: 16, marginBottom: spacing.md, backgroundColor: colors.card, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{item.senderName[0].toUpperCase()}</span>
                      </div>
                      <ThemedText style={{ fontSize: 13, fontWeight: '600' }}>{item.senderName}</ThemedText>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleUnsaveMessage(item.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger }}><Trash2 size={16} /></button>
                  </div>
                  
                  {media && (
                    <div style={{ position: 'relative', width: '100%', height: 160, borderRadius: 12, overflow: 'hidden', marginBottom: 12, border: `1px solid ${colors.border}` }}>
                      {media.type === 'image' ? (
                        <img src={media.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                      ) : (
                        <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}>
                          <video src={media.url} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PlayCircle size={40} color="#fff" /></div>
                        </div>
                      )}
                      <div style={{ position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {media.type === 'image' ? <ImageIcon size={14} color="#fff" /> : <VideoIcon size={14} color="#fff" />}
                        <span style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{t('saved_items.labels.media')}</span>
                      </div>
                    </div>
                  )}

                  {isAudio && <ThemedText style={{ fontSize: 13, fontStyle: 'italic', display: 'block', marginBottom: 8, color: colors.primary }}>{t('saved_items.labels.voice_message')}</ThemedText>}
                  {item.text && <ThemedText style={{ fontSize: 14, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 8 }}>{item.text}</ThemedText>}
                  <ThemedText style={{ fontSize: 11, opacity: 0.5 }}>{formatDate(item.savedAt)}</ThemedText>
                </div>
              );
            })
          ) : (
            filteredPosts.map(item => (
              <div key={item.id} onClick={() => navigate(`/post/${item.id}`)} style={{ border: `1px solid ${colors.border}`, padding: spacing.md, borderRadius: 16, marginBottom: spacing.md, backgroundColor: colors.card, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                  <ThemedText style={{ fontSize: 14, fontWeight: 'bold', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</ThemedText>
                  <button onClick={e => { e.stopPropagation(); handleUnsavePost(item.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.danger, marginLeft: 8 }}><Trash2 size={16} /></button>
                </div>
                {item.mediaUrl && <img src={item.mediaUrl} style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, marginBottom: 8 }} alt="" />}
                <ThemedText style={{ fontSize: 13, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.content}</ThemedText>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <ThemedText style={{ fontSize: 12, fontWeight: '600' }}>{t('saved_items.labels.author', { name: item.authorName })}</ThemedText>
                  <ThemedText style={{ fontSize: 11, opacity: 0.5 }}>{formatDate(item.createdAt)}</ThemedText>
                </div>
              </div>
            ))
          )
          }
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </ThemedView>
  );
}
