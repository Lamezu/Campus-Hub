import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import Layout from '../../components/Layout';
import NotificationBell from '../../components/NotificationBell';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import { SaveAll, Users, UserStar, ShieldCheck, ChevronRight } from 'lucide-react';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [channelsCount, setChannelsCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { t } = useTranslation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/login');
        setLoading(false);
        return;
      }
      setUser(currentUser);
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) setUserData(userDoc.data());

        const [chSnap, sgSnap, frSnap] = await Promise.all([
          getDocs(query(collection(db, 'channels'), where('memberIds', 'array-contains', currentUser.uid))),
          getDocs(query(collection(db, 'studyGroups'), where('memberIds', 'array-contains', currentUser.uid))),
          getDocs(query(collection(db, 'friendships'), where('userId', '==', currentUser.uid))),
        ]);
        setChannelsCount(chSnap.size + sgSnap.size);
        setFriendsCount(frSnap.size);
      } catch {}
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = userData?.displayName || user.displayName || 'User';
  const initial = displayName.charAt(0).toUpperCase();
  const isAdmin = userData?.role === 'admin';

  const actionItem = (icon: React.ReactNode, title: string, subtitle: string, onClick: () => void) => (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        backgroundColor: 'var(--background)',
        border: '1px solid var(--border)',
        padding: '14px 16px',
        borderRadius: '12px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'background 0.15s'
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--background)')}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        backgroundColor: colors.primary + '18',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{subtitle}</div>
      </div>
      <ChevronRight size={18} color="var(--text-secondary)" />
    </div>
  );

  return (
    <Layout title={t('tabs.profile')} rightAction={<NotificationBell categories={['friend']} />}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 16px',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{
            width: '96px', height: '96px', borderRadius: '48px',
            backgroundColor: 'var(--background-secondary)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            marginBottom: '16px', overflow: 'hidden'
          }}>
            {userData?.photoURL ? (
              <img src={userData.photoURL} alt={displayName}
                style={{ width: '96px', height: '96px', borderRadius: '48px', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text)' }}>{initial}</span>
            )}
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '4px' }}>
            {displayName}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            {user.email}
          </p>

          <button
            className="btn"
            style={{
              padding: '8px 24px',
              width: 'fit-content',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
            onClick={() => navigate('/edit-profile')}
          >
            {t('profile.edit_profile')}
          </button>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          backgroundColor: 'var(--background-secondary)',
          margin: '16px',
          padding: '20px',
          borderRadius: '12px'
        }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)' }}>{channelsCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('profile.groups')}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)' }}>{userData?.messageCount || 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('profile.messages_sent')}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)' }}>{friendsCount}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{t('profile.friends')}</div>
          </div>
        </div>

        <div style={{ padding: '0 16px 16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '12px' }}>
            {t('profile.quick_actions')}
          </h3>

          {actionItem(
            <SaveAll size={20} color={colors.primary} />,
            t('profile.saved_messages'),
            t('profile.manage_friends'),
            () => navigate('/saved-items')
          )}
          {actionItem(
            <Users size={20} color={colors.primary} />,
            t('profile.friends'),
            t('profile.manage_friends'),
            () => navigate('/friends')
          )}
          {actionItem(
            <UserStar size={20} color={colors.primary} />,
            t('profile.best_friends'),
            t('profile.best_friends'),
            () => navigate('/friends?tab=best')
          )}
          {isAdmin && actionItem(
            <ShieldCheck size={20} color={colors.primary} />,
            t('profile.user_management'),
            t('profile.administration'),
            () => navigate('/admin/users')
          )}
        </div>
      </div>
    </Layout>
  );
}
