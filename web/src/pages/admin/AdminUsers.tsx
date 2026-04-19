import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import { Search, X, Check, ChevronLeft, Users, ShieldCheck } from 'lucide-react';
import { db } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useTranslation } from '../../hooks/useTranslation';
import type { UserRole, UserSubrole } from '../../types';

interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  subrole?: UserSubrole;
}

type RoleFilter = 'all' | UserRole;

const ROLE_COLORS: Record<UserRole, string> = {
  student: '#34C759',
  teacher: '#007AFF',
  admin: '#FF9500',
};

const SUBROLES_FOR_ROLE: Record<UserRole, (UserSubrole)[]> = {
  student: [null, 'delegate'],
  teacher: [null, 'coordinator'],
  admin: [null],
};

function Avatar({ user, size = 40 }: { user: AppUser; size?: number }) {
  const { colors } = useTheme();
  if (user.photoURL) {
    return (
      <img
        src={user.photoURL}
        alt={user.displayName}
        style={{ width: size, height: size, borderRadius: size / 2, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: colors.backgroundSecondary,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 700, color: colors.text }}>
        {user.displayName.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

interface EditModalProps {
  user: AppUser | null;
  onClose: () => void;
  onSave: (uid: string, role: UserRole, subrole: UserSubrole) => Promise<void>;
}

function EditRoleModal({ user, onClose, onSave }: EditModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [selectedSubrole, setSelectedSubrole] = useState<UserSubrole>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRole(user.role || 'student');
      setSelectedSubrole(user.subrole ?? null);
    }
  }, [user]);

  if (!user) return null;

  const availableSubroles = SUBROLES_FOR_ROLE[selectedRole] ?? [null];
  const hasSubroles = availableSubroles.some(s => s !== null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(user.uid, selectedRole, selectedSubrole);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        className="animate-sheet"
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          padding: '20px 20px 36px',
          width: '100%', maxWidth: 560,
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>{t('admin.change_role.title')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <X size={20} color={colors.textSecondary} />
          </button>
        </div>
        <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16 }}>{user.displayName}</div>

        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary, opacity: 0.7, marginBottom: 8 }}>{t('admin.change_role.role_label')}</div>
        {(['student', 'teacher', 'admin'] as UserRole[]).map(role => (
          <button
            key={role}
            onClick={() => { setSelectedRole(role); setSelectedSubrole(null); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 8,
              border: `1px solid ${selectedRole === role ? colors.primary : colors.border}`,
              backgroundColor: selectedRole === role ? colors.primary + '11' : 'transparent',
              cursor: 'pointer', transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: ROLE_COLORS[role] + '30',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: ROLE_COLORS[role] }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 500, color: selectedRole === role ? colors.primary : colors.text }}>
                {t(`roles.${role}`)}
              </span>
            </div>
            {selectedRole === role && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
          </button>
        ))}

        {hasSubroles && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary, opacity: 0.7, marginTop: 16, marginBottom: 8 }}>{t('admin.change_role.subrole_label')}</div>
            {availableSubroles.map(subrole => (
              <button
                key={subrole ?? 'none'}
                onClick={() => setSelectedSubrole(subrole)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 8,
                  border: `1px solid ${selectedSubrole === subrole ? colors.primary : colors.border}`,
                  backgroundColor: selectedSubrole === subrole ? colors.primary + '11' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 500, color: selectedSubrole === subrole ? colors.primary : colors.text }}>
                  {subrole ? t(`roles.labels.${subrole}`) : t('roles.labels.none')}
                </span>
                {selectedSubrole === subrole && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
              </button>
            ))}
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '13px', borderRadius: 12, border: 'none',
              backgroundColor: colors.backgroundSecondary, color: colors.text,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: '13px', borderRadius: 12, border: 'none',
              backgroundColor: colors.primary, color: '#fff',
              fontSize: 15, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '...' : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const isDesktop = useWindowSize();
  const { t } = useTranslation();

  const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
    { value: 'all', label: t('admin.filters.all') },
    { value: 'student', label: t('admin.filters.students') },
    { value: 'teacher', label: t('admin.filters.teachers') },
    { value: 'admin', label: t('admin.filters.admins') },
  ];
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    return onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => d.data() as AppUser).filter(u => !u.deleted));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter(u => {
      const matchesRole = roleFilter === 'all' || (u.role || 'student') === roleFilter;
      const matchesSearch = !q
        || u.displayName.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const handleSave = async (uid: string, role: UserRole, subrole: UserSubrole) => {
    await updateDoc(doc(db, 'users', uid), { role, subrole: subrole ?? null });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: colors.background }}>
      <div className="animate-slide-down" style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: isDesktop ? '20px 32px' : '16px',
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.background,
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <ChevronLeft size={24} color={colors.text} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            backgroundColor: colors.primary + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={20} color={colors.primary} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>{t('admin.user_mgmt_title')}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{t('admin.user_count', { count: users.length })}</div>
          </div>
        </div>
      </div>

      <div className="animate-fade-in" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxWidth: isDesktop ? 720 : undefined, margin: isDesktop ? '0 auto' : undefined, width: '100%' }}>
        <div style={{ padding: isDesktop ? '16px 0 0' : '12px 16px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            backgroundColor: colors.backgroundSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: 12, padding: '10px 14px',
          }}>
            <Search size={16} color={colors.textSecondary} />
            <input
              type="text"
              placeholder={t('admin.search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 14, color: colors.text, fontFamily: 'inherit',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={16} color={colors.textSecondary} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: isDesktop ? '12px 0' : '10px 16px', overflowX: 'auto' }}>
          {ROLE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setRoleFilter(f.value)}
              style={{
                padding: '6px 16px', borderRadius: 20, border: `1px solid ${roleFilter === f.value ? colors.primary : colors.border}`,
                backgroundColor: roleFilter === f.value ? colors.primary + '15' : 'transparent',
                color: roleFilter === f.value ? colors.primary : colors.textSecondary,
                fontSize: 13, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.18s ease',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 60, fontSize: 14 }}>{t('common.loading')}</div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 60, gap: 10 }}>
              <Users size={36} color={colors.textSecondary} strokeWidth={1.5} />
              <div style={{ fontSize: 14, color: colors.textSecondary }}>{search ? t('common.no_results') : t('admin.no_users')}</div>
            </div>
          )}
          {filtered.map((u, i) => (
            <div
              key={u.uid}
              className="animate-fade-in"
              onClick={() => setEditingUser(u)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: isDesktop ? '14px 0' : '14px 16px',
                borderBottom: `1px solid ${colors.border}`,
                cursor: 'pointer', transition: 'background 0.12s',
                animationDelay: `${Math.min(i, 12) * 30}ms`,
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Avatar user={u} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{u.displayName}</div>
                <div style={{ fontSize: 13, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '2px 9px', borderRadius: 10,
                    backgroundColor: ROLE_COLORS[u.role || 'student'] + '20',
                    border: `1px solid ${ROLE_COLORS[u.role || 'student']}50`,
                    color: ROLE_COLORS[u.role || 'student'],
                  }}>
                    {t(`roles.${u.role || 'student'}`)}
                  </span>
                  {u.subrole && (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      padding: '2px 9px', borderRadius: 10,
                      backgroundColor: colors.backgroundSecondary,
                      border: `1px solid ${colors.border}`,
                      color: colors.textSecondary,
                    }}>
                      {t(`roles.labels.${u.subrole}`)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <EditRoleModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSave} />
    </div>
  );
}