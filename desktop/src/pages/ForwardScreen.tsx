import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Check, Send, Mic, Search, X, Hash, MessageCircle } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/styles';
import { auth, db } from '@/config/firebase';
import { MOCK_CHANNELS as CHANNELS } from '@/constants/mockData';
import {
  subscribeToConversations,
  getConversationId,
  sendMessage as dmSendMessage,
  sendAudioMessage as dmSendAudioMessage,
} from '@/services/dmService';
import { useTranslation } from '@/contexts/LanguageContext';
import type { DMConversation, Channel } from '@/types';

type ForwardTab = 'channels' | 'dms';

export default function ForwardScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  const messageText = searchParams.get('messageText') ?? undefined;
  const audioUrl = searchParams.get('audioUrl') ?? undefined;
  const audioDuration = searchParams.get('audioDuration') ?? undefined;

  const [allConversations, setAllConversations] = useState<DMConversation[]>([]);
  const [tab, setTab] = useState<ForwardTab>('channels');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [selectedDMs, setSelectedDMs] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    return subscribeToConversations(meId, setAllConversations);
  }, []);

  const totalSelected = selectedChannels.size + selectedDMs.size;

  const filteredChannels = useMemo((): Channel[] => {
    const q = query.trim().toLowerCase();
    if (!q) return CHANNELS;
    return CHANNELS.filter(c =>
      c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [query]);

  const filteredDMs = useMemo((): DMConversation[] => {
    const q = query.trim().toLowerCase();
    if (!q) return allConversations;
    return allConversations.filter((c: DMConversation) => c.participantName.toLowerCase().includes(q));
  }, [allConversations, query]);

  const toggleChannel = useCallback((id: string) => {
    setSelectedChannels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleDM = useCallback((id: string) => {
    setSelectedDMs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSend = async () => {
    if (totalSelected === 0) return;
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const meId = currentUser.uid;
    const senderName = currentUser.displayName ?? 'Tú';
    const senderPhoto = currentUser.photoURL ?? null;

    const tasks: Promise<any>[] = [];

    if (selectedChannels.size > 0) {
      selectedChannels.forEach(channelId => {
        const isStudyGroup = channelId.startsWith('sg_');
        const cleanId = channelId.replace(/^(sg_|group_|channel_|group_)/, '');
        const collectionName = isStudyGroup ? 'studyGroups' : 'channels';
        
        const msgData = {
          text: messageText ?? '',
          senderId: meId, senderName, senderPhoto,
          createdAt: serverTimestamp(), edited: false, editedAt: null,
          attachments: audioUrl ? [{ url: audioUrl, type: 'audio', duration: parseFloat(audioDuration || '0') }] : null,
          reactions: {}, replyTo: null, forwarded: true,
        };
        tasks.push(addDoc(collection(db, collectionName, cleanId, 'messages'), msgData));
      });
    }

    if (selectedDMs.size > 0) {
      const selectedConvs = allConversations.filter(c => selectedDMs.has(c.id));
      if (audioUrl) {
        const duration = parseFloat(audioDuration ?? '0');
        selectedConvs.forEach(c => {
          tasks.push(dmSendAudioMessage(getConversationId(meId, c.participantId), meId, senderName, senderPhoto, audioUrl, duration, true));
        });
      } else {
        selectedConvs.forEach(c => {
          tasks.push(dmSendMessage(getConversationId(meId, c.participantId), meId, senderName, senderPhoto, messageText ?? '', null, true));
        });
      }
    }

    await Promise.all(tasks);
    navigate(-1);
  };

  const inputStyle: React.CSSProperties = {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    color: colors.text, fontSize: 14,
  };

  return (
    <ThemedView style={{ flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: colors.background }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.background, flexShrink: 0 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.text, display: 'flex' }}>
            <ChevronLeft size={24} />
          </button>
          <ThemedText style={{ flex: 1, fontWeight: '700', fontSize: 16 }}>{t('forward.title')}</ThemedText>
          {totalSelected > 0 && (
            <div style={{ minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingInline: 6 }}>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{totalSelected}</span>
            </div>
          )}
        </div>

        {(messageText || audioUrl) && (
          <div style={{ padding: `${spacing.sm}px ${spacing.md}px`, backgroundColor: colors.backgroundSecondary }}>
            <ThemedText style={{ fontSize: 11, color: colors.textSecondary, display: 'block' }}>{t('forward.preview_label')}</ThemedText>
            {audioUrl
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mic size={14} color={colors.text} /><ThemedText style={{ fontSize: 13 }}>{t('forward.voice_message')}</ThemedText></div>
              : <ThemedText style={{ fontSize: 13 }} numberOfLines={2}>{messageText}</ThemedText>
            }
          </div>
        )}

        <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.background, flexShrink: 0 }}>
          {(['channels', 'dms'] as ForwardTab[]).map(tabKey => (
            <button key={tabKey} onClick={() => { setTab(tabKey); setQuery(''); }} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: `${spacing.sm + 2}px`, border: 'none', cursor: 'pointer',
              backgroundColor: 'transparent', position: 'relative',
              borderBottom: tab === tabKey ? `2px solid ${colors.primary}` : '2px solid transparent',
            }}>
              {tabKey === 'channels' ? <Hash size={14} color={tab === tabKey ? colors.primary : colors.textSecondary} /> : <MessageCircle size={14} color={tab === tabKey ? colors.primary : colors.textSecondary} />}
              <span style={{ fontSize: 14, fontWeight: '600', color: tab === tabKey ? colors.primary : colors.textSecondary }}>
                {tabKey === 'channels' ? `${t('forward.tabs.channels')}${selectedChannels.size > 0 ? ` (${selectedChannels.size})` : ''}` : `${t('forward.tabs.dms')}${selectedDMs.size > 0 ? ` (${selectedDMs.size})` : ''}`}
              </span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: spacing.sm, padding: '8px 12px', backgroundColor: colors.backgroundSecondary, borderRadius: 10, border: `1px solid ${colors.border}` }}>
          <Search size={16} color={colors.textSecondary} />
          <input
            style={inputStyle}
            placeholder={tab === 'channels' ? t('forward.search.channels') : t('forward.search.dms')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: colors.textSecondary }}><X size={15} /></button>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'channels' ? (
            filteredChannels.length === 0
              ? <ThemedText style={{ textAlign: 'center', marginTop: 40, display: 'block', opacity: 0.5 }}>{t('forward.no_results')}</ThemedText>
              : filteredChannels.map(ch => (
                <div key={ch.id} onClick={() => toggleChannel(ch.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `${spacing.sm + 2}px ${spacing.md}px`, borderBottom: `1px solid ${colors.border}`, cursor: 'pointer' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${colors.primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Hash size={18} color={colors.primary} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: '600', fontSize: 15, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: colors.textSecondary, display: 'block' }}>{ch.description}</ThemedText>
                  </div>
                  <div style={{ width: 24, height: 24, borderRadius: 12, border: `1.5px solid ${selectedChannels.has(ch.id) ? colors.primary : colors.border}`, backgroundColor: selectedChannels.has(ch.id) ? colors.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {selectedChannels.has(ch.id) && <Check size={14} color="#fff" strokeWidth={2.5} />}
                  </div>
                </div>
              ))
          ) : (
            filteredDMs.length === 0
              ? <ThemedText style={{ textAlign: 'center', marginTop: 40, display: 'block', opacity: 0.5 }}>{t('forward.no_results')}</ThemedText>
              : filteredDMs.map(conv => {
                const initials = conv.participantName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <div key={conv.id} onClick={() => toggleDM(conv.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `${spacing.sm + 2}px ${spacing.md}px`, borderBottom: `1px solid ${colors.border}`, cursor: 'pointer' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{initials}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <ThemedText style={{ fontWeight: '600', fontSize: 15, display: 'block' }}>{conv.participantName}</ThemedText>
                      <ThemedText style={{ fontSize: 12, color: colors.textSecondary, display: 'block' }}>
                        {conv.participantRole === 'teacher' ? t('forward.roles.teacher') : t('forward.roles.student')}
                      </ThemedText>
                    </div>
                    <div style={{ width: 24, height: 24, borderRadius: 12, border: `1.5px solid ${selectedDMs.has(conv.id) ? colors.primary : colors.border}`, backgroundColor: selectedDMs.has(conv.id) ? colors.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selectedDMs.has(conv.id) && <Check size={14} color="#fff" strokeWidth={2.5} />}
                    </div>
                  </div>
                );
              })
          )}
        </div>

        <div style={{ padding: `${spacing.sm + 4}px ${spacing.md}px`, borderTop: `1px solid ${colors.border}`, backgroundColor: colors.background, flexShrink: 0 }}>
          <button
            onClick={handleSend}
            disabled={totalSelected === 0}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: `${spacing.sm + 4}px`, borderRadius: 12, border: 'none', cursor: totalSelected > 0 ? 'pointer' : 'not-allowed',
              backgroundColor: totalSelected > 0 ? colors.primary : colors.border,
            }}
          >
            <Send size={20} color="#fff" />
            <span style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
              {totalSelected > 0 ? t('forward.button.send_count', { count: totalSelected }) : t('forward.button.send')}
            </span>
          </button>
        </div>
      </div>
    </ThemedView>
  );
}
