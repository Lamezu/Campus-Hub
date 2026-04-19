import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Star, Search, Heart, MessageCircle, ChevronLeft, UserPlus, UserCheck, Filter, UserMinus } from 'lucide-react';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { auth, db } from '@/config/firebase';
import { collection, query, getDocs, limit } from 'firebase/firestore';
import { subscribeToFriends, subscribeToBestFriends, toggleBestFriend, sendFriendRequest, removeFriend, cleanupAllFriendRequests } from '@/services/friendsService';
import { spacing } from '@/constants/styles';
import { AlertModal } from '@/components/AlertModal';
import { useTranslation } from '@/contexts/LanguageContext';
import type { User } from '@/types';
type TabType = 'all' | 'best' | 'add';
type RoleFilter = 'all' | 'admin' | 'teacher' | 'student';
export default function FriendsScreen() {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [allFriends, setAllFriends] = useState<User[]>([]);
  const [bestFriends, setBestFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<User | null>(null);
  const [removing, setRemoving] = useState(false);
  const currentUser = auth.currentUser;
  useEffect(() => {
    if (!currentUser) return;
    const unsubAll = subscribeToFriends(currentUser.uid, (friends) => {
      setAllFriends(friends);
      setLoading(false);
    });
    const unsubBest = subscribeToBestFriends(currentUser.uid, (friends) => {
      setBestFriends(friends);
    });
    return () => { unsubAll(); unsubBest(); };
  }, [currentUser]);
  const handleGlobalSearch = async () => {
    if (!currentUser) return;
    setIsSearchingGlobal(true);
    try {
      const usersRef = collection(db, 'users');
      let q;
      if (search.trim()) {
        const searchTerm = search.toLowerCase();
        q = query(usersRef, limit(100));
        const snap = await getDocs(q);
        let results = snap.docs
          .map(d => ({ uid: d.id, ...d.data() } as User))
          .filter(u => {
            if (u.uid === currentUser.uid) return false;
            const name = (u.displayName || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
            const matchesRole = roleFilter === 'all' || u.role === roleFilter;
            return matchesSearch && matchesRole;
          });
        setSearchResults(results.slice(0, 20));
      } else {
        q = query(usersRef, limit(40));
        const snap = await getDocs(q);
        let results = snap.docs
          .map(d => ({ uid: d.id, ...d.data() } as User))
          .filter(u => {
            if (u.uid === currentUser.uid) return false;
            return roleFilter === 'all' || u.role === roleFilter;
          });
        setSearchResults(results.slice(0, 20));
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearchingGlobal(false);
    }
  };
  useEffect(() => {
    if (activeTab === 'add') {
      const timeout = setTimeout(handleGlobalSearch, 400);
      return () => clearTimeout(timeout);
    }
  }, [search, roleFilter, activeTab]);
  const handleToggleBest = async (friendId: string) => {
    if (!currentUser) return;
    try { await toggleBestFriend(currentUser.uid, friendId); } catch { }
  };
  const handleAddFriend = async (user: User) => {
    if (!currentUser) return;
    try {
      await sendFriendRequest(
        currentUser.uid,
        user.uid,
        currentUser.displayName || 'Usuario',
        currentUser.photoURL
      );
      showAlert({ title: t('friends_screen.alerts.request_sent_title'), message: t('friends_screen.alerts.request_sent_msg', { name: user.displayName }), type: 'success' });
    } catch (err: any) {
      showAlert({ title: t('friends_screen.errors.generic'), message: err.message || t('friends_screen.errors.request_failed'), type: 'error' });
    }
  };
  const handleRemoveFriend = async () => {
    if (!currentUser || !showRemoveConfirm) return;
    setRemoving(true);
    try {
      await removeFriend(currentUser.uid, showRemoveConfirm.uid);
      setShowRemoveConfirm(null);
      showAlert({ title: t('friends_screen.alerts.remove_success_title'), message: t('friends_screen.alerts.remove_success_msg'), type: 'success' });
    } catch (err: any) {
      showAlert({ title: t('friends_screen.errors.generic'), message: t('friends_screen.errors.remove_failed'), type: 'error' });
    } finally {
      setRemoving(false);
    }
  };
  const filteredFriends = (activeTab === 'all' ? allFriends : bestFriends).filter(f => {
    const name = f.displayName || '';
    const email = f.email || '';
    const sTerm = (search || '').toLowerCase();
    return name.toLowerCase().includes(sTerm) || email.toLowerCase().includes(sTerm);
  });
  return (
    <ThemedView style={{ flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: colors.background }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.background, flexShrink: 0,
        }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.text, display: 'flex' }}>
            <ChevronLeft size={24} />
          </button>
          <ThemedText style={{ fontWeight: '700', fontSize: 16 }}>{t('friends_screen.title')}</ThemedText>
          <div style={{ width: 32 }} />
        </div>
        <div style={{ padding: `${spacing.md}px ${spacing.lg}px`, flexShrink: 0 }}>
          <div style={{ display: 'flex', backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: 4, gap: 4, marginBottom: spacing.md }}>
            {[
              { id: 'all', label: t('friends_screen.tabs.all'), icon: <Users size={18} /> },
              { id: 'best', label: t('friends_screen.tabs.best'), icon: <Star size={18} /> },
              { id: 'add', label: t('friends_screen.tabs.add'), icon: <UserPlus size={18} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setSearch('');
                  setSearchResults([]);
                }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  backgroundColor: activeTab === tab.id ? colors.card : 'transparent',
                  boxShadow: activeTab === tab.id ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s',
                  color: activeTab === tab.id ? (tab.id === 'best' ? colors.warning : colors.primary) : colors.textSecondary
                }}
              >
                {React.cloneElement(tab.icon as React.ReactElement, { color: 'currentColor' })}
                <span style={{ fontSize: 13, fontWeight: '700', color: activeTab === tab.id ? colors.text : 'inherit' }}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', backgroundColor: colors.backgroundSecondary, borderRadius: 12 }}>
            <Search size={18} color={colors.textSecondary} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={activeTab === 'add' ? t('friends_screen.search.add_placeholder') : t('friends_screen.search.placeholder')}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: colors.text, fontSize: 14,
              }}
            />
          </div>
          {activeTab === 'add' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { id: 'all', label: t('friends_screen.roles.all') },
                { id: 'teacher', label: t('friends_screen.roles.teacher') },
                { id: 'admin', label: t('friends_screen.roles.admin') },
                { id: 'student', label: t('friends_screen.roles.student') }
              ].map(role => (
                <button
                  key={role.id}
                  onClick={() => setRoleFilter(role.id as RoleFilter)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: '600', whiteSpace: 'nowrap',
                    backgroundColor: roleFilter === role.id ? colors.primary : colors.backgroundSecondary,
                    color: roleFilter === role.id ? '#FFF' : colors.textSecondary,
                    transition: 'all 0.2s'
                  }}
                >
                  {role.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: `0 ${spacing.lg}px ${spacing.lg}px` }}>
          {activeTab === 'add' ? (
            <div style={{ marginTop: spacing.sm }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
                <Filter size={14} color={colors.primary} />
                <ThemedText style={{ fontSize: 13, fontWeight: 'bold', color: colors.primary }}>
                  {isSearchingGlobal ? t('friends_screen.status.searching') : t('friends_screen.status.explore')}
                </ThemedText>
              </div>
              {searchResults.length === 0 && !isSearchingGlobal && (
                <div style={{ textAlign: 'center', padding: spacing.xl, opacity: 0.5 }}>
                  <ThemedText style={{ fontSize: 14 }}>{t('friends_screen.status.no_results')}</ThemedText>
                </div>
              )}
              {searchResults.map(user => {
                const isAlreadyFriend = allFriends.some(f => f.uid === user.uid);
                return (
                  <div key={user.uid} style={{
                    display: 'flex', alignItems: 'center', padding: spacing.md, borderRadius: 20,
                    backgroundColor: colors.card, marginBottom: 12, border: `1px solid ${colors.border}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, flexShrink: 0 }}>
                      {user.photoURL ? <img src={user.photoURL} alt="" style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover' }} /> : <span style={{ fontSize: 16, fontWeight: 'bold', color: colors.primary }}>{user.displayName?.[0]}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <ThemedText style={{ fontSize: 15, fontWeight: '700', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName}</ThemedText>
                      <ThemedText style={{ fontSize: 11, opacity: 0.6 }}>
                        {user.role === 'teacher' ? t('friends_screen.labels.teacher') : user.role === 'admin' ? t('friends_screen.labels.admin') : t('friends_screen.labels.student')} • {user.email?.split('@')[0]}
                      </ThemedText>
                    </div>
                    {!isAlreadyFriend ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleAddFriend(user)}
                          style={{ padding: '8px 16px', borderRadius: 10, backgroundColor: colors.primary, color: '#fff', border: 'none', fontSize: 13, fontWeight: '700', cursor: 'pointer' }}
                        >
                          <UserPlus size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/dm/${user.uid}`)}
                          style={{ padding: '8px 16px', borderRadius: 10, backgroundColor: colors.backgroundSecondary, color: colors.primary, border: `1px solid ${colors.primary}33`, fontSize: 13, fontWeight: '700', cursor: 'pointer' }}
                        >
                          <MessageCircle size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.7 }}>
                        <UserCheck size={16} color={colors.primary} />
                        <ThemedText style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>{t('friends_screen.labels.friend')}</ThemedText>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 60 }}>
                  <div style={{ width: 32, height: 32, border: `3px solid ${colors.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
              ) : filteredFriends.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: search ? 60 : 100, gap: 12, opacity: 0.6 }}>
                  {search ? <Search size={64} color={colors.border} strokeWidth={1} /> : <Users size={64} color={colors.border} strokeWidth={1} />}
                  <ThemedText style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
                    {search ? t('friends_screen.empty.no_matches') : (activeTab === 'all' ? t('friends_screen.empty.no_friends') : t('friends_screen.empty.no_best'))}
                  </ThemedText>
                </div>
              ) : (
                filteredFriends.map(friend => {
                  const isBest = bestFriends.some(f => f.uid === friend.uid);
                  return (
                    <div
                      key={friend.uid}
                      style={{
                        display: 'flex', alignItems: 'center', padding: spacing.md, borderRadius: 20,
                        marginBottom: 12, backgroundColor: colors.card, border: `1px solid ${colors.border}`,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer',
                        transition: 'transform 0.2s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      <div style={{ position: 'relative', marginRight: spacing.md }}>
                        {friend.photoURL
                          ? <img src={friend.photoURL} alt="" style={{ width: 50, height: 50, borderRadius: 25, objectFit: 'cover' }} />
                          : <div style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: colors.primary, fontWeight: 'bold', fontSize: 20 }}>{friend.displayName?.charAt(0).toUpperCase()}</span>
                          </div>
                        }
                        {isBest && (
                          <div style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#FF2D55', width: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                            <Heart size={12} color="#fff" fill="#fff" />
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <ThemedText style={{ fontWeight: '800', fontSize: 15, display: 'block' }}>{friend.displayName}</ThemedText>
                        <ThemedText style={{ fontSize: 12, opacity: 0.6, marginTop: 2, display: 'block' }}>
                          {friend.role === 'teacher' ? t('friends_screen.labels.teacher') : friend.role === 'admin' ? t('friends_screen.labels.admin') : t('friends_screen.labels.student')} • {friend.email?.split('@')[0]}
                        </ThemedText>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleToggleBest(friend.uid)}
                          style={{
                            width: 38, height: 38, borderRadius: 12, backgroundColor: colors.backgroundSecondary,
                            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Star size={20} color={isBest ? colors.warning : colors.textSecondary} fill={isBest ? colors.warning : 'none'} />
                        </button>
                        <button
                          onClick={() => navigate(`/dm/${friend.uid}`)}
                          style={{
                            width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary,
                            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <MessageCircle size={20} color="#fff" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowRemoveConfirm(friend); }}
                          style={{
                            width: 38, height: 38, borderRadius: 12, backgroundColor: colors.danger + '15',
                            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <UserMinus size={18} color={colors.danger} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
      {showRemoveConfirm && (
        <AlertModal
          isOpen={!!showRemoveConfirm}
          type="confirm"
          title={t('friends_screen.alerts.remove_friend_title')}
          message={t('friends_screen.alerts.remove_friend_msg', { name: showRemoveConfirm.displayName })}
          confirmText={removing ? t('friends_screen.buttons.removing') : t('friends_screen.buttons.remove')}
          showCancelButton
          onClose={() => !removing && setShowRemoveConfirm(null)}
          onConfirm={handleRemoveFriend}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </ThemedView>
  );
}