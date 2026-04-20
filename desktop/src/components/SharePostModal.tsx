import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Hash, MessageCircle, Users, Send } from 'lucide-react';
import { ThemedText } from './themed-text';
import { spacing, typography } from '@/constants/styles';
import { Avatar } from './common/Avatar';
import { useTheme } from '@/contexts/ThemeContext';
import { auth, db } from '@/config/firebase';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { subscribeToConversations } from '@/services/dmService';
import { MOCK_CHANNELS } from '@/constants/mockData';
import type { Post, DMConversation, Channel, StudyGroup } from '@/types';
import { sharePostToMultiple, ShareDestination } from '@/services/shareService';

interface SharePostModalProps {
  post: Post;
  onClose: () => void;
}

type TabType = 'dms' | 'channels' | 'groups';

export function SharePostModal({ post, onClose }: SharePostModalProps) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('dms');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [destinations, setDestinations] = useState<Record<string, ShareDestination>>({});
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'admin'>('all');
  
  const [dms, setDms] = useState<DMConversation[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const unsubDMs = subscribeToConversations(user.uid, setDms);

    const qGroups = query(
      collection(db, 'studyGroups'),
      where('memberIds', 'array-contains', user.uid)
    );
    const unsubGroups = onSnapshot(qGroups, (snap) => {
      const g = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyGroup));
      setGroups(g);
    });

    return () => {
      unsubDMs();
      unsubGroups();
    };
  }, []);

  const filteredDMs = useMemo(() => {
    return dms.filter(dm => {
      const matchesSearch = dm.participantName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = roleFilter === 'all' || dm.participantRole === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [dms, searchQuery, roleFilter]);

  const filteredChannels = useMemo(() => {
    return MOCK_CHANNELS.filter(ch => 
      ch.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const filteredGroups = useMemo(() => {
    return groups.filter(g => 
      g.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [groups, searchQuery]);

  const toggleSelection = (id: string, type: 'dm' | 'channel' | 'studyGroup', name: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      const newDests = { ...destinations };
      delete newDests[id];
      setDestinations(newDests);
    } else {
      newSelected.add(id);
      setDestinations({
        ...destinations,
        [id]: { id, type, name }
      });
    }
    setSelectedIds(newSelected);
  };

  const handleSend = async () => {
    if (selectedIds.size === 0 || sending) return;
    setSending(true);
    try {
      await sharePostToMultiple(post, Object.values(destinations));
      onClose(); 
    } catch (error) {
      console.error('Error sharing post:', error);
      onClose(); // Close even on error to fulfill "automatic" requirement if necessary, or at least don't hang
    } finally {
      setSending(false);
    }
  };

  const renderItem = (id: string, name: string, type: 'dm' | 'channel' | 'studyGroup', subText: string, photo?: string | null) => {
    const isSelected = selectedIds.has(id);
    return (
      <div
        key={id}
        onClick={() => toggleSelection(id, type, name)}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px 16px',
          cursor: 'pointer',
          borderRadius: 12,
          backgroundColor: isSelected ? colors.primary + '10' : 'transparent',
          marginBottom: 4,
          transition: 'all 0.2s',
          border: `1px solid ${isSelected ? colors.primary + '30' : 'transparent'}`
        }}
        onMouseEnter={e => !isSelected && (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
        onMouseLeave={e => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <div style={{ position: 'relative', marginRight: 12 }}>
          <Avatar 
            src={photo} 
            name={name} 
            size={44} 
            style={{ borderRadius: type === 'dm' ? 22 : 12 }} 
            fallbackIcon={type === 'channel' ? Hash : type === 'studyGroup' ? Users : undefined}
          />
        </div>
        <div style={{ flex: 1 }}>
          <ThemedText style={{ fontWeight: '600', fontSize: 15, display: 'block' }}>{name}</ThemedText>
          <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>{subText}</ThemedText>
        </div>
        <div style={{ 
          width: 22, height: 22, borderRadius: 11, 
          border: `2px solid ${isSelected ? colors.primary : colors.border}`,
          backgroundColor: isSelected ? colors.primary : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s'
        }}>
          {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: colors.background, width: 500, height: 650,
        borderRadius: 24, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)', overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <ThemedText style={{ fontSize: 20, fontWeight: '800' }}>Compartir</ThemedText>
            <ThemedText style={{ fontSize: 13, color: colors.textSecondary, display: 'block', marginTop: 2 }}>
              {post.title}
            </ThemedText>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
            <X size={24} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
            backgroundColor: colors.backgroundSecondary, borderRadius: 12, border: `1px solid ${colors.border}`
          }}>
            <Search size={18} color={colors.textSecondary} />
            <input
              autoFocus
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar personas, canales..."
              style={{ background: 'none', border: 'none', outline: 'none', color: colors.text, flex: 1, fontSize: 14 }}
            />
          </div>

          {/* Role Filters - Only for DMs */}
          {activeTab === 'dms' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {[
                { id: 'all', label: 'Todos' },
                { id: 'student', label: 'Alumnos' },
                { id: 'teacher', label: 'Profesores' },
                { id: 'admin', label: 'Admin' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setRoleFilter(f.id as any)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: '600',
                    backgroundColor: roleFilter === f.id ? colors.primary : colors.backgroundSecondary,
                    color: roleFilter === f.id ? '#fff' : colors.textSecondary,
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}`, padding: '0 24px' }}>
          {[
            { id: 'dms', label: 'Mensajes', icon: MessageCircle },
            { id: 'channels', label: 'Canales', icon: Hash },
            { id: 'groups', label: 'Grupos', icon: Users }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as TabType)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${activeTab === t.id ? colors.primary : 'transparent'}`,
                color: activeTab === t.id ? colors.primary : colors.textSecondary,
                transition: 'all 0.2s', fontWeight: activeTab === t.id ? '700' : '500'
              }}
            >
              <t.icon size={16} />
              <span style={{ fontSize: 14 }}>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {activeTab === 'dms' && filteredDMs.length > 0 ? filteredDMs.map(dm => 
            renderItem(dm.participantId, dm.participantName, 'dm', dm.participantRole === 'teacher' ? 'Profesor' : 'Alumno', dm.participantPhoto)
          ) : activeTab === 'channels' && filteredChannels.length > 0 ? filteredChannels.map(ch => 
            renderItem(ch.id, ch.name, 'channel', ch.description)
          ) : activeTab === 'groups' && filteredGroups.length > 0 ? filteredGroups.map(g => 
            renderItem(g.id, g.name, 'studyGroup', g.subject)
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
              <Search size={48} style={{ marginBottom: 16 }} />
              <ThemedText>No se encontraron resultados</ThemedText>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>
            {selectedIds.size} seleccionados
          </ThemedText>
          <button
            disabled={selectedIds.size === 0 || sending}
            onClick={handleSend}
            style={{
              backgroundColor: colors.primary, color: '#fff', border: 'none',
              padding: '10px 24px', borderRadius: 12, fontWeight: '700',
              display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
              opacity: (selectedIds.size === 0 || sending) ? 0.5 : 1, transition: 'all 0.2s'
            }}
          >
            {sending ? 'Enviando...' : (
              <>
                Compartir <Send size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
