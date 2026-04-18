import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, User as UserIcon, Filter, MessageSquare, Users, UserCheck } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { auth, db } from '@/config/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { subscribeToFriends } from '@/services/friendsService';
import { ThemedText } from './themed-text';
import { useTranslation } from '@/contexts/LanguageContext';
import { spacing } from '@/constants/styles';
import type { User, UserRole } from '@/types';

interface NewDMModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => void;
}

type TabType = 'friends' | 'all';

export function NewDMModal({ isOpen, onClose, onSelectUser }: NewDMModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  
  const [friends, setFriends] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const currentUser = auth.currentUser;

  // Subscribe to friends
  useEffect(() => {
    if (!currentUser || !isOpen) return;
    const unsubscribe = subscribeToFriends(currentUser.uid, (data) => {
      setFriends(data);
    });
    return unsubscribe;
  }, [currentUser, isOpen]);

  // Subscribe to all users
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as User))
        .filter(u => u.uid !== currentUser?.uid);
      setAllUsers(fetchedUsers);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      setLoading(false);
    });
    return unsubscribe;
  }, [isOpen, currentUser]);

  const filteredUsers = useMemo(() => {
    const source = activeTab === 'friends' ? friends : allUsers;
    const searchTerm = search.toLowerCase().trim();
    
    return source.filter(u => {
      const matchesSearch = !searchTerm || 
        u.displayName?.toLowerCase().includes(searchTerm) || 
        u.email?.toLowerCase().includes(searchTerm);
      
      const role = u.role || 'student';
      const matchesRole = selectedRole === 'all' || role === selectedRole;
      
      return matchesSearch && matchesRole;
    });
  }, [activeTab, friends, allUsers, search, selectedRole]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
      backdropFilter: 'blur(8px)', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 500, backgroundColor: colors.background,
        borderRadius: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh',
        border: `1px solid ${colors.border}`
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText style={{ fontSize: 18, fontWeight: '800' }}>{t('dm.new_message')}</ThemedText>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTab('friends')}
            style={{
              flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: activeTab === 'friends' ? `${colors.primary}15` : 'transparent',
              color: activeTab === 'friends' ? colors.primary : colors.textSecondary,
              fontWeight: '600', transition: 'all 0.2s'
            }}
          >
            <UserCheck size={18} />
            <span>{t('dm.tabs.friends')}</span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: activeTab === 'all' ? `${colors.primary}15` : 'transparent',
              color: activeTab === 'all' ? colors.primary : colors.textSecondary,
              fontWeight: '600', transition: 'all 0.2s'
            }}
          >
            <Users size={18} />
            <span>{t('dm.tabs.everyone')}</span>
          </button>
        </div>

        {/* Search & Filters */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', 
            backgroundColor: colors.backgroundSecondary, borderRadius: 12, border: `1px solid ${colors.border}` 
          }}>
            <Search size={18} color={colors.textSecondary} />
            <input 
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('dm.search_placeholder')}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: 15 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {(['all', 'student', 'teacher', 'admin'] as const).map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: `1px solid ${selectedRole === role ? colors.primary : colors.border}`,
                  backgroundColor: selectedRole === role ? colors.primary : 'transparent',
                  color: selectedRole === role ? '#fff' : colors.textSecondary,
                  fontSize: 12, fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
                }}
              >
                {role === 'all' ? t('dm.filter.all') : role === 'student' ? t('dm.filter.student') : role === 'teacher' ? t('dm.filter.teacher') : t('dm.filter.admin')}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
          {loading ? (
             <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
               <div style={{ width: 30, height: 30, border: `3px solid ${colors.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
             </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
              <ThemedText style={{ fontSize: 14 }}>
                {search ? t('dm.no_results') : activeTab === 'friends' ? t('dm.no_friends') : t('dm.no_users')}
              </ThemedText>
            </div>
          ) : (
            filteredUsers.map(user => (
              <div 
                key={user.uid}
                onClick={() => onSelectUser(user.uid)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                  borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ThemedText style={{ color: colors.primary, fontWeight: 'bold' }}>{user.displayName?.[0]?.toUpperCase()}</ThemedText>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ThemedText style={{ fontWeight: '600', fontSize: 15, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.displayName}
                  </ThemedText>
                  <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>
                    {user.role === 'teacher' ? t('dm.filter.teacher') : user.role === 'admin' ? t('dm.filter.admin') : t('dm.filter.student')}
                  </ThemedText>
                </div>
                <MessageSquare size={18} color={colors.primary} />
              </div>
            ))
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
