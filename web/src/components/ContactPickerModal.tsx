import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import { auth } from '../config/firebase';
import { getFriends, type FriendUser } from '../services/firebase/friendsService';

export interface ContactData {
  userId: string;
  name: string;
  photo: string | null;
  bio: string;
}

interface ContactPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (contact: ContactData) => void;
}

export default function ContactPickerModal({ visible, onClose, onSelect }: ContactPickerModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    getFriends(uid)
      .then(setFriends)
      .catch(() => { })
      .finally(() => setLoading(false));
    setSearch('');
  }, [visible]);

  if (!visible) return null;

  const filtered = friends.filter(f =>
    f.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const roleLabel: Record<string, string> = {
    student: 'Alumno/a',
    teacher: 'Profesor/a',
    admin: 'Admin',
  };

  const handleSelect = (friend: FriendUser) => {
    onSelect({
      userId: friend.uid,
      name: friend.displayName,
      photo: friend.photoURL,
      bio: roleLabel[friend.role] ?? friend.role,
    });
  };

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1500 }} />
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: colors.background,
        borderRadius: 20,
        width: 360,
        maxWidth: '95vw',
        maxHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1501,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${colors.border}` }}>
          <span style={{ fontWeight: '700', fontSize: 17, color: colors.text }}>{t('chat.contact.share_title')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: colors.textSecondary }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: '8px 12px' }}>
            <Search size={16} color={colors.textSecondary} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('chat.contact.search_placeholder')}
              autoFocus
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: colors.text }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32, color: colors.textSecondary, fontSize: 14 }}>{t('common.loading')}</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: colors.textSecondary, fontSize: 14 }}>
              {search ? t('common.no_results') : t('chat.contact.no_contacts')}
            </div>
          ) : (
            filtered.map(friend => (
              <button
                key={friend.uid}
                onClick={() => handleSelect(friend)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '12px 20px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  borderBottom: `1px solid ${colors.border}`,
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, backgroundColor: colors.primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {friend.photoURL
                    ? <img src={friend.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 18, fontWeight: '700', color: colors.primary }}>{friend.displayName[0]?.toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: 14, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.displayName}</div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{roleLabel[friend.role] ?? friend.role}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
