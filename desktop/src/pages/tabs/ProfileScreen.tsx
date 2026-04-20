import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationBell } from '@/components/NotificationBell';
import { Settings, ChevronRight, Bookmark, Users, Shield, Star } from 'lucide-react';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { ManageUsersModal } from '@/components/admin/ManageUsersModal';
import { useTranslation } from '@/contexts/LanguageContext';
import { Avatar } from '@/components/common/Avatar';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { userData, loading: userLoading, isAdmin } = useCurrentUser();
  const [showManageUsers, setShowManageUsers] = useState(false);
  const currentUser = auth.currentUser;
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ channels: 0, friends: 0 });

  useEffect(() => {
    if (!userLoading) setLoading(false);
  }, [userLoading]);

  useEffect(() => {
    if (!currentUser) return;

    let cCount = 0;
    let sgCount = 0;

    const unsubChannels = onSnapshot(
      query(collection(db, 'channels'), where('memberIds', 'array-contains', currentUser.uid)),
      snap => {
        cCount = snap.size;
        setCounts(prev => ({ ...prev, channels: cCount + sgCount }));
      }
    );

    const unsubStudyGroups = onSnapshot(
      query(collection(db, 'studyGroups'), where('memberIds', 'array-contains', currentUser.uid)),
      sgSnap => {
        sgCount = sgSnap.size;
        setCounts(prev => ({ ...prev, channels: cCount + sgCount }));
      }
    );

    const unsubFriends = onSnapshot(
      collection(db, 'users', currentUser.uid, 'friends'),
      snap => {
        setCounts(prev => ({ ...prev, friends: snap.size }));
      }
    );

    return () => {
      unsubChannels();
      unsubStudyGroups();
      unsubFriends();
    };
  }, [currentUser]);

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText>{t('profile_screen.loading')}</ThemedText>
      </ThemedView>
    );
  }

  const displayName = userData?.displayName || currentUser?.displayName || '';
  const initial = displayName.charAt(0).toUpperCase();

  const actions = [
    { title: t('profile_screen.saved_messages'), subtitle: t('profile_screen.saved_messages_desc'), Icon: Bookmark, route: '/saved-items' },
    { title: t('profile_screen.friends'), subtitle: t('profile_screen.friends_desc'), Icon: Users, route: '/friends' },
    ...(isAdmin ? [{ title: t('profile_screen.manage_users'), subtitle: t('profile_screen.manage_users_desc'), Icon: Shield, route: '#manage-users' }] : []),
  ];

  const stats = [
    { value: counts.channels, label: t('profile_screen.stat_channels') },
    { value: (userData as any)?.messageCount || 0, label: t('profile_screen.stat_messages') },
    { value: counts.friends, label: t('profile_screen.stat_friends') },
  ];

  return (
    <ThemedView style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: colors.background }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>

        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: `${spacing.xl}px ${spacing.lg}px`,
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.card, position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationBell category="friend" />
            <button
              onClick={() => navigate('/settings')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex' }}
            >
              <Settings size={22} />
            </button>
          </div>
          <div style={{
            width: 120, height: 120, borderRadius: 60,
            backgroundColor: colors.backgroundSecondary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: spacing.lg, overflow: 'hidden',
          }}>
            <Avatar 
              src={userData?.photoURL} 
              name={displayName} 
              size={120} 
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
            <ThemedText style={{ fontSize: typography.sizes.xl, fontWeight: 'bold' }}>{displayName}</ThemedText>
            {(userData?.role === 'teacher' || userData?.role === 'admin') && (
              <Star size={20} color={colors.primary} fill={colors.primary} />
            )}
          </div>
          <ThemedText style={{ fontSize: typography.sizes.sm, opacity: 0.6, marginBottom: spacing.lg }}>
            {userData?.email || currentUser?.email}
          </ThemedText>
          <button
            onClick={() => navigate('/edit-profile')}
            style={{
              padding: '10px 24px', borderRadius: 20, backgroundColor: colors.primary,
              color: '#FFF', border: 'none', fontWeight: '600', cursor: 'pointer', transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {t('profile_screen.edit_btn')}
          </button>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-around',
          margin: `${spacing.lg}px ${spacing.lg}px`,
          padding: spacing.lg, borderRadius: 20,
          backgroundColor: colors.backgroundSecondary,
        }}>
          {stats.map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <ThemedText style={{ fontSize: 24, fontWeight: 'bold', display: 'block' }}>{stat.value}</ThemedText>
              <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{stat.label}</ThemedText>
            </div>
          ))}
        </div>

        <div style={{ padding: spacing.lg }}>
          <ThemedText style={{ fontSize: typography.sizes.lg, fontWeight: 'bold', marginBottom: spacing.md, display: 'block' }}>
            {t('profile_screen.quick_actions')}
          </ThemedText>
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (action.route === '#manage-users') setShowManageUsers(true);
                else navigate(action.route);
              }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: spacing.md,
                padding: spacing.md, borderRadius: 12, border: `1px solid ${colors.border}`,
                backgroundColor: colors.card, marginBottom: spacing.sm, cursor: 'pointer',
                textAlign: 'left', transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = colors.card)}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: `${colors.primary}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <action.Icon size={20} color={colors.primary} />
              </div>
              <div style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: typography.sizes.md, fontWeight: '600', display: 'block' }}>{action.title}</ThemedText>
                <ThemedText style={{ fontSize: typography.sizes.sm, opacity: 0.6, display: 'block' }}>{action.subtitle}</ThemedText>
              </div>
              <ChevronRight size={18} color={colors.textSecondary} />
            </button>
          ))}
        </div>
      </div>

      <ManageUsersModal
        isOpen={showManageUsers}
        onClose={() => setShowManageUsers(false)}
      />
    </ThemedView>
  );
}
