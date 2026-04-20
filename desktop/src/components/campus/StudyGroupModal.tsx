import React, { useState, useEffect } from 'react';
import { X, Users, Lock, CheckCircle2, Search, UserPlus } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAlert } from '@/contexts/AlertContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { ThemedText } from '../themed-text';
import { Avatar } from '../common/Avatar';

interface StudyGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

export function StudyGroupModal({ isOpen, onClose, onSave, initialData }: StudyGroupModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'subjects' | 'departments' | 'cycles'>('subjects');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const subjects = ['math', 'physics', 'chemistry', 'history', 'english', 'french', 'philosophy', 'economy', 'technology', 'programming', 'other'];
  const departments = ['admin_mgmt', 'counseling', 'energy_water', 'fol', 'health', 'hospitality_tourism', 'innovation', 'it_comms', 'languages', 'security_env', 'social_services', 'sports', 'wood_furniture'];
  const cycles = ['asir', 'dam', 'daw', 'smr', 'tseas', 'tcae', 'emergencias_sanitarias', 'higiene_bucodental', 'educacion_infantil', 'tapsd', 'gestion_administrativa', 'finanzas_y_seguros', 'guia,_informacion_y_asistencia'];

  const ROLE_LABELS: Record<string, string> = {
    admin: t('common.role_admin'),
    teacher: t('common.role_teacher'),
    student: t('common.role_student')
  };

  const COLORS = [
    '#007AFF', '#34C759', '#FF9500', '#FF3B30', 
    '#AF52DE', '#5AC8FA', '#FF2D55', '#FFCC00'
  ];

  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryType: 'subjects' as 'subjects' | 'departments' | 'cycles',
    isPrivate: false,
    color: COLORS[0],
    whoCanJoin: 'everyone' as 'everyone' | 'teacher' | 'student' | 'admin',
    subjects: [] as string[],
    departments: [] as string[],
    cycles: [] as string[],
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        categoryType: (initialData.categoryType as any) || 'subjects',
        isPrivate: initialData.isPrivate || false,
        color: initialData.color || COLORS[0],
        whoCanJoin: initialData.whoCanJoin || 'everyone',
        subjects: initialData.subjects || [],
        departments: initialData.departments || [],
        cycles: initialData.cycles || [],
      });
      setActiveTab((initialData.categoryType as any) || 'subjects');
    } else {
      setForm({
        name: '', description: '', categoryType: 'subjects',
        isPrivate: false, color: COLORS[0], whoCanJoin: 'everyone',
        subjects: [], departments: [], cycles: []
      });
    }
  }, [initialData, isOpen]);

  useEffect(() => {
    if (showInviteModal) {
      const q = query(collection(db, 'users'), orderBy('displayName'));
      getDocs(q).then(snap => {
        const users = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(u => u.id !== auth.currentUser?.uid);
        setAllUsers(users);
      });
    }
  }, [showInviteModal]);

  if (!isOpen) return null;

  const handleSave = async () => {
    const hasCategory = form.subjects.length > 0 || form.departments.length > 0 || form.cycles.length > 0;
    if (!form.name || !hasCategory) {
      showAlert({ title: t('common.info'), message: t('groups.alerts.complete_fields'), type: 'info' });
      return;
    }
    setLoading(true);
    try {
      await onSave({
        ...form,
        invitedUsers,
      });
      onClose();
    } catch (err) {
      console.error(err);
      showAlert({ title: t('common.error'), message: t('groups.alerts.save_error'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleInvite = (uid: string) => {
    setInvitedUsers(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(8px)', padding: 20
    }}>
      <div style={{
        width: '100%', maxWidth: 540, maxHeight: '90vh',
        backgroundColor: colors.background, borderRadius: 28,
        boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '24px 32px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: form.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: form.color }}>
               <Users size={24} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: colors.text }}>
                {initialData ? t('groups.edit_title') : t('groups.new_group_title')}
              </h2>
              <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{t('groups.group_setup')}</ThemedText>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: 8, borderRadius: '50%', cursor: 'pointer', color: colors.textSecondary }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: colors.text, opacity: 0.8 }}>{t('groups.fields.name')}</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder={t('groups.placeholders.name')}
                style={{ padding: '14px 18px', borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 15, outline: 'none', fontWeight: 500 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: colors.text, opacity: 0.8 }}>{t('groups.fields.description')}</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder={t('groups.placeholders.description')}
                rows={2}
                style={{ padding: '14px 18px', borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 14, outline: 'none', resize: 'none', fontWeight: 500 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: colors.text, opacity: 0.8 }}>{t('groups.fields.category')}</label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20, backgroundColor: colors.backgroundSecondary, padding: 6, borderRadius: 14 }}>
                {['subjects', 'departments', 'cycles'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab as any); setForm({...form, categoryType: tab as any}); }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                      backgroundColor: activeTab === tab ? colors.primary : 'transparent',
                      color: activeTab === tab ? '#fff' : colors.textSecondary,
                      fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    {t(`groups.types.${tab}`)}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24, padding: 16, backgroundColor: colors.backgroundSecondary, borderRadius: 16, maxHeight: 180, overflowY: 'auto' }}>
                {(activeTab === 'subjects' ? subjects : activeTab === 'departments' ? departments : cycles).map((item) => {
                  const isSelected = form.subjects.includes(item) || form.departments.includes(item) || form.cycles.includes(item);
                  const translationKey = activeTab === 'subjects' ? `groups.subjects_list.${item}` : activeTab === 'departments' ? `common.departments.${item}` : `groups.cycles_list.${item}`;
                  const label = t(translationKey, { defaultValue: item.toUpperCase() });

                  return (
                    <button
                      key={item}
                      onClick={() => {
                        const field = activeTab === 'subjects' ? 'subjects' : activeTab === 'departments' ? 'departments' : 'cycles';
                        const current = (form as any)[field];
                        const next = current.includes(item) ? current.filter((s: string) => s !== item) : [...current, item];
                        setForm({ ...form, [field]: next });
                      }}
                      style={{
                        padding: '8px 16px', borderRadius: 20, border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        color: isSelected ? '#fff' : colors.text,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: colors.text, opacity: 0.8 }}>{t('groups.fields.color')}</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    style={{
                      width: 44, height: 44, borderRadius: '50%', border: 'none',
                      backgroundColor: c, cursor: 'pointer', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: form.color === c ? `0 0 0 3px ${colors.background}, 0 0 0 5px ${c}` : 'none'
                    }}
                  >
                    {form.color === c && <CheckCircle2 size={24} color="#fff" />}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ backgroundColor: colors.backgroundSecondary, borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div 
                onClick={() => setForm({ ...form, isPrivate: !form.isPrivate })}
                style={{ display: 'flex', alignItems: 'center', gap: 24, cursor: 'pointer' }}
              >
                <div style={{
                  width: 48, height: 26, borderRadius: 13, backgroundColor: form.isPrivate ? colors.primary : colors.border,
                  position: 'relative', transition: 'all 0.3s', flexShrink: 0
                }}>
                  <div style={{
                    position: 'absolute', top: 3, left: form.isPrivate ? 25 : 3, width: 20, height: 20, 
                    borderRadius: '50%', backgroundColor: '#fff', transition: 'all 0.3s'
                  }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <ThemedText style={{ fontSize: 14, fontWeight: '800' }}>{t('groups.fields.privacy')}</ThemedText>
                  <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{t('groups.fields.privacy_desc')}</ThemedText>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.6 }}>{t('groups.fields.who_can_join')}</label>
                <select 
                  value={form.whoCanJoin}
                  onChange={e => setForm({ ...form, whoCanJoin: e.target.value as any })}
                  style={{ padding: '10px', borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.text, outline: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  <option value="everyone">{t('groups.visibility_options.everyone')}</option>
                  <option value="teacher">{t('groups.visibility_options.teacher')}</option>
                  <option value="student">{t('groups.visibility_options.student')}</option>
                  <option value="admin">{t('groups.visibility_options.admin')}</option>
                </select>
              </div>
            </div>

            <button 
              onClick={() => setShowInviteModal(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '16px', borderRadius: 16, backgroundColor: colors.card,
                border: `2px dashed ${colors.border}`, color: colors.primary,
                fontWeight: 700, cursor: 'pointer'
              }}
            >
              <UserPlus size={20} />
              <span>{t('groups.invite_btn')} ({invitedUsers.length})</span>
            </button>
          </div>
        </div>

        <div style={{ padding: '24px 32px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '16px', borderRadius: 16, border: 'none', backgroundColor: colors.backgroundSecondary, color: colors.text, fontWeight: 800, cursor: 'pointer' }}>{t('common.cancel')}</button>
          <button 
            onClick={handleSave}
            disabled={!form.name || (!form.subjects.length && !form.departments.length && !form.cycles.length) || loading}
            style={{ flex: 1, padding: '16px', borderRadius: 16, border: 'none', backgroundColor: colors.primary, color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: (!form.name || (!form.subjects.length && !form.departments.length && !form.cycles.length) || loading) ? 0.5 : 1 }}
          >
            {loading ? t('common.saving') : initialData ? t('common.save') : t('groups.create_btn')}
          </button>
        </div>
      </div>

      {showInviteModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1100, backdropFilter: 'blur(10px)', padding: 20
        }}>
          <div style={{
            width: '100%', maxWidth: 440, height: 600,
            backgroundColor: colors.background, borderRadius: 24,
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <ThemedText style={{ fontSize: 18, fontWeight: '900' }}>{t('groups.invite_title')}</ThemedText>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '16px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', backgroundColor: colors.backgroundSecondary, borderRadius: 12 }}>
                <Search size={18} opacity={0.5} />
                <input 
                  placeholder={t('groups.placeholders.search_users')} 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
              {allUsers.filter(u => u.displayName.toLowerCase().includes(searchQuery.toLowerCase())).map(user => {
                const isSelected = invitedUsers.includes(user.id);
                const roleLabel = ROLE_LABELS[user.role] || user.role;
                return (
                  <div 
                    key={user.id} 
                    onClick={() => toggleInvite(user.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 12px',
                      borderRadius: 16, cursor: 'pointer', backgroundColor: isSelected ? colors.primary + '10' : 'transparent',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Avatar 
                      src={user.photoURL} 
                      name={user.displayName} 
                      size={44} 
                    />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <ThemedText style={{ fontSize: 15, fontWeight: '700', lineHeight: '1.2' }}>{user.displayName}</ThemedText>
                      <ThemedText style={{ fontSize: 12, opacity: 0.6, fontWeight: '600' }}>{roleLabel}</ThemedText>
                    </div>
                    <div style={{
                      width: 24, height: 24, borderRadius: 12, border: `2px solid ${isSelected ? colors.primary : colors.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                      backgroundColor: isSelected ? colors.primary : 'transparent'
                    }}>
                      {isSelected && <CheckCircle2 size={16} color="#fff" />}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '20px 24px', borderTop: `1px solid ${colors.border}` }}>
              <button onClick={() => setShowInviteModal(false)} style={{ width: '100%', padding: '14px', borderRadius: 14, backgroundColor: colors.primary, color: '#fff', border: 'none', fontWeight: '800', cursor: 'pointer' }}>
                {t('groups.ready')} ({invitedUsers.length})
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${colors.border}; borderRadius: 10px; }
      `}</style>
    </div>
  );
}
