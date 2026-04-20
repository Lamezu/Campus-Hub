import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Shield, User as UserIcon, Check, MoreVertical } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '../themed-text';
import { Avatar } from '../common/Avatar';
import { useTranslation } from '@/contexts/LanguageContext';
import { collection, getDocs, query, orderBy, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { User, UserRole, UserSubrole } from '@/types';

interface ManageUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageUsersModal({ isOpen, onClose }: ManageUsersModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | UserRole>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'users'), orderBy('displayName'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
      setLoading(false);
    });
    return unsub;
  }, [isOpen]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.displayName.toLowerCase().includes(search.toLowerCase()) || 
                           u.email?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = selectedRoleFilter === 'all' || u.role === selectedRoleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, selectedRoleFilter]);

  const handleUpdateRole = async (uid: string, role: UserRole, subrole?: UserSubrole) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        role,
        subrole: subrole || null
      });
      setEditingUser(null);
    } catch (e) {
      console.error('Error updating user role:', e);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5000, backdropFilter: 'blur(10px)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 500, height: 700, backgroundColor: colors.background, borderRadius: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Shield size={20} color={colors.primary} />
            <ThemedText style={{ fontSize: 18, fontWeight: '900' }}>{t('admin.manage_users')}</ThemedText>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><X size={24} /></button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', backgroundColor: colors.backgroundSecondary, borderRadius: 12 }}>
            <Search size={18} opacity={0.5} />
            <input placeholder={t('admin.search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'student', 'teacher', 'admin'] as const).map(r => (
              <button 
                key={r} 
                onClick={() => setSelectedRoleFilter(r)} 
                style={{ 
                  padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: '700', cursor: 'pointer',
                  backgroundColor: selectedRoleFilter === r ? colors.primary : colors.backgroundSecondary,
                  color: selectedRoleFilter === r ? '#fff' : colors.textSecondary,
                  border: 'none', transition: '0.2s'
                }}
              >
                {r === 'all' ? t('common.all') : t(`roles.labels.${r}`)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><ThemedText>{t('common.loading')}...</ThemedText></div>
          ) : filteredUsers.map(user => (
            <div key={user.uid} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, backgroundColor: editingUser?.uid === user.uid ? colors.backgroundSecondary : 'transparent' }}>
                <Avatar 
                  src={user.photoURL} 
                  name={user.displayName} 
                  size={44} 
                  fallbackIcon={UserIcon}
                />
                <div style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: '700', fontSize: 15 }}>{user.displayName}</ThemedText>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ThemedText style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>{t(`roles.labels.${user.role || 'student'}`)}</ThemedText>
                    {user.subrole && (
                      <>
                        <div style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textSecondary, opacity: 0.5 }} />
                        <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>{t(`roles.labels.${user.subrole}`)}</ThemedText>
                      </>
                    )}
                  </div>
                </div>
                <button 
                  id={`admin-manage-user-more-${user.uid}`}
                  onClick={() => setEditingUser(editingUser?.uid === user.uid ? null : user)}
                  style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: 8 }}
                >
                  <MoreVertical size={20} />
                </button>
              </div>

              {editingUser?.uid === user.uid && (
                <div style={{ padding: '0 16px 16px 72px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <ThemedText style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>{t('admin.change_role.title')}</ThemedText>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['student', 'teacher', 'admin'] as UserRole[]).map(r => (
                        <button 
                          key={r} 
                          id={`admin-update-role-${user.uid}-${r}`}
                          onClick={() => handleUpdateRole(user.uid, r)} 
                          style={{ padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: '600', cursor: 'pointer', backgroundColor: user.role === r ? colors.primary : colors.backgroundSecondary, color: user.role === r ? '#fff' : colors.text, border: 'none' }}
                        >
                          {t(`roles.labels.${r}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {user.role === 'student' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <ThemedText style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>{t('admin.change_role.subrole_label')}</ThemedText>
                      <button onClick={() => handleUpdateRole(user.uid, 'student', user.subrole === 'delegate' ? undefined : 'delegate')} style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: '600', cursor: 'pointer', backgroundColor: user.subrole === 'delegate' ? colors.primary : colors.backgroundSecondary, color: user.subrole === 'delegate' ? '#fff' : colors.text, border: 'none' }}>
                        {t('roles.labels.delegate')}
                      </button>
                    </div>
                  )}

                  {user.role === 'teacher' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <ThemedText style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase' }}>{t('admin.change_role.subrole_label')}</ThemedText>
                      <button onClick={() => handleUpdateRole(user.uid, 'teacher', user.subrole === 'coordinator' ? undefined : 'coordinator')} style={{ alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: '600', cursor: 'pointer', backgroundColor: user.subrole === 'coordinator' ? colors.primary : colors.backgroundSecondary, color: user.subrole === 'coordinator' ? '#fff' : colors.text, border: 'none' }}>
                        {t('roles.labels.coordinator')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
