import React, { useState, useEffect } from 'react';
import { X, Search, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '../themed-text';
import { collection, getDocs, query, orderBy, doc, updateDoc, arrayUnion, where } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import type { User } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  channelId: string;
  currentMemberIds: string[];
  onAdded: () => void;
}

export function InviteMembersModal({ isOpen, onClose, channelId, currentMemberIds, onAdded }: InviteMembersModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | 'student' | 'teacher' | 'admin'>('all');

  useEffect(() => {
    if (isOpen) {
      const q = query(collection(db, 'users'), orderBy('displayName'));
      getDocs(q).then(snap => {
        const users = snap.docs
          .map(d => ({ uid: d.id, ...d.data() } as User))
          .filter(u => u.uid !== auth.currentUser?.uid && !currentMemberIds.includes(u.uid));
        setAllUsers(users);
      });
    }
  }, [isOpen, currentMemberIds]);

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || u.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const toggleInvite = (uid: string) => {
    setInvitedUsers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleAdd = async () => {
    if (invitedUsers.length === 0) return;
    setLoading(true);
    try {
      const sgRef = doc(db, 'studyGroups', channelId);
      const chRef = doc(db, 'channels', channelId);
      const [sgSnap, chSnap] = await Promise.all([getDocs(query(collection(db, 'studyGroups'), where('__name__', '==', channelId))), getDocs(query(collection(db, 'channels'), where('__name__', '==', channelId)))]);
      const targetRef = sgSnap.size > 0 ? sgRef : chRef;
      await updateDoc(targetRef, {
        memberIds: arrayUnion(...invitedUsers)
      });
      onAdded();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, backdropFilter: 'blur(10px)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, height: 600, backgroundColor: colors.background, borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText style={{ fontSize: 18, fontWeight: '900' }}>{t('chat.invite.title')}</ThemedText>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><X size={24} /></button>
        </div>
        
        <div style={{ padding: '16px', borderBottom: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', backgroundColor: colors.backgroundSecondary, borderRadius: 12 }}>
            <Search size={18} opacity={0.5} />
            <input id="invite-search-input" placeholder={t('chat.invite.search_placeholder')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: 14 }} />
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {(['all', 'student', 'teacher', 'admin'] as const).map(role => (
              <button
                key={role}
                id={`invite-filter-${role}`}
                onClick={() => setSelectedRole(role)}
                style={{
                  padding: '6px 12px', borderRadius: 20, border: `1px solid ${selectedRole === role ? colors.primary : colors.border}`,
                  backgroundColor: selectedRole === role ? colors.primary : 'transparent',
                  color: selectedRole === role ? '#fff' : colors.textSecondary,
                  fontSize: 11, fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                }}
              >
                {t(`chat.invite.filter_${role === 'all' ? 'all' : role + 's'}`)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {filteredUsers.map(user => {
            const isSelected = invitedUsers.includes(user.uid);
            return (
              <div key={user.uid} onClick={() => toggleInvite(user.uid)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 12px', borderRadius: 16, cursor: 'pointer', backgroundColor: isSelected ? colors.primary + '10' : 'transparent', transition: 'all 0.2s' }}>
                <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.backgroundSecondary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {user.photoURL ? <img src={user.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <ThemedText style={{ fontWeight: 'bold' }}>{user.displayName[0]}</ThemedText>}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <ThemedText style={{ fontSize: 15, fontWeight: '700' }}>{user.displayName}</ThemedText>
                  <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{user.bio || t('chat.no_bio')}</ThemedText>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: 12, border: `2px solid ${isSelected ? colors.primary : colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', backgroundColor: isSelected ? colors.primary : 'transparent' }}>
                  {isSelected && <CheckCircle2 size={16} color="#fff" />}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '20px 24px', borderTop: `1px solid ${colors.border}` }}>
          <button id="invite-submit-btn" onClick={handleAdd} disabled={loading || invitedUsers.length === 0} style={{ width: '100%', padding: '14px', borderRadius: 14, backgroundColor: colors.primary, color: '#fff', border: 'none', fontWeight: '800', cursor: 'pointer', opacity: (loading || invitedUsers.length === 0) ? 0.5 : 1 }}>
            {loading ? t('chat.invite.submitting') : `${t('chat.invite.submit_btn')} (${invitedUsers.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
