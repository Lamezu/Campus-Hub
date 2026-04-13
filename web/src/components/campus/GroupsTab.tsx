import { useState, useMemo } from 'react';
import { Plus, X, Search, Check, ChevronLeft, Globe, Lock, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useStudyGroups } from '../../hooks/campus/useStudyGroups';
import { GroupCard } from './GroupCard';
import { auth } from '../../config/firebase';
import { useTranslation } from '../../hooks/useTranslation';
import type { StudyGroup, UserRole } from '../../types';

const GROUP_CATEGORIES = ['subjects', 'departments', 'cycles'] as const;
type GroupCategory = typeof GROUP_CATEGORIES[number];

const GROUP_SUBJECTS_MAP: Record<GroupCategory, string[]> = {
  subjects: ['math', 'physics', 'chemistry', 'history', 'english', 'french', 'philosophy', 'economics', 'technology', 'programming', 'other'],
  departments: ['hospitality_tourism', 'health', 'informatics_comms', 'sports', 'admin_management', 'sociocultural', 'energy_water', 'wood_furniture', 'safety_environment', 'languages', 'fol', 'guidance', 'innovation_quality'],
  cycles: ['asir', 'dam', 'daw', 'smr', 'tseas', 'tcae', 'health_emergencies', 'oral_hygiene', 'early_childhood', 'tapsd', 'admin_management_cycle', 'finance_insurance', 'tourism_guide', 'other'],
};

const STEP_KEYS = ['name', 'subject', 'color', 'access', 'invite'] as const;

const GROUP_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA', '#FF2D55', '#FFCC00'];

interface GroupsTabProps {
  canCreate: boolean;
  isAdmin: boolean;
}

const initialForm = {
  name: '',
  description: '',
  subject: 'math',
  subjectCategory: 'subjects' as GroupCategory,
  color: GROUP_COLORS[0],
  isPrivate: false,
  allowedRoles: [] as UserRole[],
  invitedUserIds: [] as string[],
};

export function GroupsTab({ canCreate, isAdmin }: GroupsTabProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isDesktop = useWindowSize();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const { groups, allUsers, loadingUsers, joinGroup, leaveGroup, createGroup, updateGroup, deleteGroup, loadUsers } = useStudyGroups(isAdmin);

  const ROLE_OPTIONS: Array<{ label: string; desc: string; value: UserRole[] }> = [
    { label: t('campus.groups_tab.role_all'), desc: t('campus.groups_tab.role_all_desc'), value: [] },
    { label: t('campus.groups_tab.role_teachers'), desc: t('campus.groups_tab.role_teachers_desc'), value: ['teacher'] },
    { label: t('campus.groups_tab.role_students'), desc: t('campus.groups_tab.role_students_desc'), value: ['student'] },
    { label: t('campus.groups_tab.role_admins'), desc: t('campus.groups_tab.role_admins_desc'), value: ['admin'] },
  ];

  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [subjectCategory, setSubjectCategory] = useState<GroupCategory>('subjects');

  const [editingGroup, setEditingGroup] = useState<StudyGroup | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', subject: 'math', color: GROUP_COLORS[0] });
  const [editTab, setEditTab] = useState<'info' | 'members'>('info');
  const [editMembers, setEditMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');

  const filteredGroups = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => g.name.toLowerCase().includes(q) || g.subject.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q));
  }, [groups, groupSearch]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter(u => u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [allUsers, userSearch]);

  const filteredMemberSearch = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return allUsers.filter(u => u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [allUsers, memberSearch]);

  const handleCreateSubmit = async () => {
  if (!form.name.trim() || !currentUser) return;
  await createGroup({
    ...form,
    subjectCategory: subjectCategory || 'subjects',
  });
  setForm(initialForm);
  setStep(0);
  setUserSearch('');
  setShowCreate(false);
};

  const openEdit = (group: StudyGroup) => {
    setEditingGroup(group);
    setEditForm({ name: group.name, description: group.description, subject: group.subject, color: group.color });
    setEditMembers([...group.memberIds]);
    setEditTab('info');
    loadUsers();
  };

  const handleSaveEdit = async () => {
    if (!editingGroup || !editForm.name.trim()) return;
    await updateGroup(editingGroup.id, { ...editForm, memberIds: editMembers, memberCount: editMembers.length });
    setEditingGroup(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: isDesktop ? '16px 32px 8px' : '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, padding: '8px 14px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, gap: 10 }}>
          <Search size={18} color={colors.textSecondary} />
          <input
            type="text"
            placeholder={t('campus.groups_tab.search_placeholder')}
            value={groupSearch}
            onChange={e => setGroupSearch(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: colors.text, fontSize: 15, fontFamily: 'inherit' }}
          />
        </div>
        {canCreate && (
          <button
            onClick={() => { loadUsers(); setShowCreate(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: isDesktop ? '10px 18px' : '10px 14px', borderRadius: 12, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            <Plus size={17} color="#fff" strokeWidth={2.5} />
            {isDesktop ? t('campus.groups_tab.create_btn_full') : t('campus.groups_tab.create_btn_short')}
          </button>
        )}
      </div>

      <div style={{
        overflowY: 'auto', flex: 1, padding: isDesktop ? '0 32px 32px' : '0 16px 16px',
        display: isDesktop ? 'grid' : 'block',
        gridTemplateColumns: isDesktop ? 'repeat(2, 1fr)' : undefined,
        gap: isDesktop ? 16 : undefined,
        alignContent: 'start',
      }}>
        {filteredGroups.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 40, fontSize: 15, color: colors.textSecondary, opacity: 0.6, gridColumn: '1 / -1' }}>
            {groupSearch ? t('campus.groups_tab.no_results') : t('campus.groups_tab.no_groups')}
          </div>
        ) : filteredGroups.map(item => {
          const canManage = isAdmin || item.createdBy === currentUser?.uid;
          return (
            <GroupCard
              key={item.id}
              group={item}
              userId={currentUser?.uid ?? ''}
              onJoin={() => joinGroup(item.id)}
              onLeave={() => leaveGroup(item.id)}
              onNavigate={() => navigate(`/chat/sg_${item.id}`)}
              onEdit={canManage ? () => openEdit(item) : undefined}
              onDelete={canManage ? () => deleteGroup(item.id) : undefined}
            />
          );
        })}
      </div>

      {editingGroup && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100, paddingLeft: 16, paddingRight: 16, paddingBottom: 16 }}>
          <div className="animate-slide-up" style={{ backgroundColor: colors.background, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: 'calc(100vh - 124px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
              <button onClick={() => setEditingGroup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={22} color={colors.text} strokeWidth={2} />
              </button>
              <span style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>{t('campus.groups_tab.edit_title')}</span>
              <button
                onClick={handleSaveEdit}
                disabled={!editForm.name.trim()}
                style={{ background: 'none', border: 'none', cursor: editForm.name.trim() ? 'pointer' : 'not-allowed', fontSize: 16, fontWeight: 600, color: editForm.name.trim() ? colors.primary : colors.textSecondary }}
              >
                {t('common.save')}
              </button>
            </div>

            <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
              {(['info', 'members'] as const).map(tabKey => (
                <button key={tabKey} onClick={() => setEditTab(tabKey)} style={{ flex: 1, padding: '14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: editTab === tabKey ? colors.primary : colors.textSecondary, borderBottom: `3px solid ${editTab === tabKey ? colors.primary : 'transparent'}`, marginBottom: -1 }}>
                  {tabKey === 'info' ? t('campus.groups_tab.tab_info') : t('campus.groups_tab.tab_members', { count: String(editMembers.length) })}
                </button>
              ))}
            </div>

            {editTab === 'info' ? (
              <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="text" placeholder={t('campus.groups_tab.group_name_placeholder')} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  style={{ fontSize: 20, fontWeight: 700, border: 'none', borderBottom: `1px solid ${colors.border}`, outline: 'none', background: 'transparent', color: colors.text, padding: '10px 0', fontFamily: 'inherit', width: '100%' }} />
                <textarea placeholder={t('campus.groups_tab.desc_placeholder')} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3}
                  style={{ fontSize: 15, border: 'none', outline: 'none', background: 'transparent', color: colors.text, resize: 'none', fontFamily: 'inherit', minHeight: 80 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  {GROUP_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setSubjectCategory(cat)}
                      style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1.5px solid ${subjectCategory === cat ? colors.primary : colors.border}`, backgroundColor: subjectCategory === cat ? colors.primary + '10' : 'transparent', color: subjectCategory === cat ? colors.primary : colors.textSecondary, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      {t(`campus.groups_tab.categories.${cat}`)}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {GROUP_SUBJECTS_MAP[subjectCategory].map(s => (
                    <button key={s} onClick={() => setEditForm(f => ({ ...f, subject: s }))}
                      style={{ padding: '7px 12px', borderRadius: 20, border: `1px solid ${editForm.subject === s ? colors.primary : colors.border}`, backgroundColor: editForm.subject === s ? colors.primary + '15' : 'transparent', color: editForm.subject === s ? colors.primary : colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {t(`campus.groups_tab.${subjectCategory}.${s}`)}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {GROUP_COLORS.map(c => (
                    <button key={c} onClick={() => setEditForm(f => ({ ...f, color: c }))}
                      style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c, border: `3px solid ${editForm.color === c ? colors.text : 'transparent'}`, cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 8, backgroundColor: colors.backgroundSecondary, margin: 12, borderRadius: 10, border: `1px solid ${colors.border}` }}>
                  <Search size={16} color={colors.textSecondary} />
                  <input type="text" placeholder={t('campus.groups_tab.search_members_placeholder')} value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                    style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: colors.text, fontSize: 15, fontFamily: 'inherit' }} />
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredMemberSearch.map(item => {
                    const isMember = editMembers.includes(item.uid);
                    const isOwner = item.uid === editingGroup?.createdBy;
                    return (
                      <div key={item.uid} style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {item.photoURL ? <img src={item.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={16} color={colors.primary} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{item.displayName}</div>
                          <div style={{ fontSize: 12, opacity: 0.6, color: colors.textSecondary }}>{item.role}{isOwner ? ` (${t('campus.groups_tab.creator_label')})` : ''}</div>
                        </div>
                        {!isOwner && (
                          <button
                            onClick={() => setEditMembers(prev => isMember ? prev.filter(id => id !== item.uid) : [...prev, item.uid])}
                            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, backgroundColor: isMember ? '#FF3B30' + '15' : colors.primary + '15', color: isMember ? '#FF3B30' : colors.primary }}
                          >
                            {isMember ? t('campus.groups_tab.remove_member') : t('campus.groups_tab.add_member')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 100, paddingLeft: 16, paddingRight: 16, paddingBottom: 16 }}>
          <div className="animate-slide-up" style={{ backgroundColor: colors.background, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: 'calc(100vh - 124px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
              <button onClick={() => step > 0 ? setStep(s => s - 1) : setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                {step > 0 ? <ChevronLeft size={24} color={colors.text} /> : <X size={22} color={colors.text} />}
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                {STEP_KEYS.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? colors.primary : colors.border }} />)}
              </div>
              <button
                onClick={step === STEP_KEYS.length - 1 ? handleCreateSubmit : () => setStep(s => s + 1)}
                disabled={step === 0 && !form.name.trim()}
                style={{ background: 'none', border: 'none', cursor: (step === 0 && !form.name.trim()) ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 600, color: (step === 0 && !form.name.trim()) ? colors.textSecondary : colors.primary }}
              >
                {step === STEP_KEYS.length - 1 ? t('campus.groups_tab.step_create') : t('campus.groups_tab.step_next')}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingTop: 24 }}>
              <div style={{ fontSize: 24, fontWeight: 800, marginInline: 16, marginBottom: 20, color: colors.text }}>{t('campus.groups_tab.step_label_' + STEP_KEYS[step])}</div>

              {step === 0 && (
                <div style={{ paddingInline: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 14, color: colors.textSecondary, lineHeight: '20px' }}>{t('campus.groups_tab.step_name_hint')}</div>
                  <input autoFocus type="text" placeholder={t('campus.groups_tab.group_name_placeholder')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    style={{ fontSize: 22, fontWeight: 600, border: 'none', borderBottom: `2px solid ${colors.primary}`, outline: 'none', background: 'transparent', color: colors.text, padding: '10px 0', fontFamily: 'inherit', width: '100%' }} />
                  <textarea placeholder={t('campus.groups_tab.desc_placeholder')} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                    style={{ fontSize: 16, border: 'none', borderBottom: `2px solid ${colors.border}`, outline: 'none', background: 'transparent', color: colors.text, resize: 'none', fontFamily: 'inherit', marginTop: 12, paddingBottom: 8 }} />
                </div>
              )}

              {step === 1 && (
                <div style={{ paddingInline: 16 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {GROUP_CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setSubjectCategory(cat)}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${subjectCategory === cat ? colors.primary : colors.border}`, backgroundColor: subjectCategory === cat ? colors.primary + '10' : 'transparent', color: subjectCategory === cat ? colors.primary : colors.textSecondary, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        {t(`campus.groups_tab.categories.${cat}`)}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {GROUP_SUBJECTS_MAP[subjectCategory].map(s => (
                      <button key={s} onClick={() => setForm(f => ({ ...f, subject: s }))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, width: 'calc(50% - 5px)', padding: '14px', borderRadius: 16, border: `1.5px solid ${form.subject === s ? colors.primary : colors.border}`, backgroundColor: form.subject === s ? colors.primary + '10' : 'transparent', color: form.subject === s ? colors.primary : colors.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ flex: 1 }}>{t(`campus.groups_tab.${subjectCategory}.${s}`)}</span>
                        {form.subject === s && <Check size={16} color={colors.primary} strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', padding: '24px 16px' }}>
                  {GROUP_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: c, border: `4px solid ${form.color === c ? colors.text : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {form.color === c && <Check size={24} color="#fff" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div style={{ paddingInline: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[{ isPrivate: false, label: t('campus.groups_tab.public_label'), desc: t('campus.groups_tab.public_desc'), icon: <Globe size={20} color={!form.isPrivate ? '#fff' : colors.textSecondary} /> },
                  { isPrivate: true, label: t('campus.groups_tab.private_label'), desc: t('campus.groups_tab.private_desc'), icon: <Lock size={20} color={form.isPrivate ? '#fff' : colors.textSecondary} /> }].map(opt => (
                    <button key={String(opt.isPrivate)} onClick={() => setForm(f => ({ ...f, isPrivate: opt.isPrivate }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20, border: `2px solid ${form.isPrivate === opt.isPrivate ? colors.primary : colors.border}`, backgroundColor: form.isPrivate === opt.isPrivate ? colors.primary + '08' : 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: form.isPrivate === opt.isPrivate ? colors.primary : colors.border + '44', flexShrink: 0 }}>{opt.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{opt.label}</div>
                        <div style={{ fontSize: 13, lineHeight: '18px', marginTop: 2, color: colors.textSecondary }}>{opt.desc}</div>
                      </div>
                      {form.isPrivate === opt.isPrivate && <Check size={20} color={colors.primary} strokeWidth={3} />}
                    </button>
                  ))}
                  <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginTop: 8, opacity: 0.8 }}>{t('campus.groups_tab.who_can_join')}</div>
                  {ROLE_OPTIONS.map(opt => {
                    const isSelected = JSON.stringify(form.allowedRoles) === JSON.stringify(opt.value);
                    return (
                      <button key={JSON.stringify(opt.value)} onClick={() => setForm(f => ({ ...f, allowedRoles: opt.value }))}
                        style={{ display: 'flex', alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${colors.border}`, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', gap: 0 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 600, color: isSelected ? colors.primary : colors.text }}>{opt.label}</div>
                          <div style={{ fontSize: 13, marginTop: 2, color: colors.textSecondary }}>{opt.desc}</div>
                        </div>
                        {isSelected && <Check size={18} color={colors.primary} strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}

              {step === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInline: 16, marginBottom: 10, padding: '8px 12px', borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary }}>
                    <Search size={16} color={colors.textSecondary} />
                    <input type="text" placeholder={t('campus.groups_tab.search_users_placeholder')} value={userSearch} onChange={e => setUserSearch(e.target.value)}
                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: colors.text, fontSize: 15, fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {loadingUsers ? (
                      <div style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>{t('campus.groups_tab.loading')}</div>
                    ) : filteredUsers.length === 0 ? (
                      <div style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>{t('campus.groups_tab.no_users')}</div>
                    ) : filteredUsers.map(item => {
                      const isInvited = form.invitedUserIds.includes(item.uid);
                      return (
                        <div key={item.uid} onClick={() => setForm(f => ({ ...f, invitedUserIds: isInvited ? f.invitedUserIds.filter(id => id !== item.uid) : [...f.invitedUserIds, item.uid] }))}
                          style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, gap: 12, cursor: 'pointer' }}>
                          <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {item.photoURL ? <img src={item.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserIcon size={16} color={colors.primary} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>{item.displayName}</div>
                            <div style={{ fontSize: 12, opacity: 0.6, color: colors.textSecondary }}>{item.role}</div>
                          </div>
                          <div style={{ width: 24, height: 24, borderRadius: 12, border: `2px solid ${isInvited ? colors.primary : colors.border}`, backgroundColor: isInvited ? colors.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isInvited && <Check size={14} color="#fff" strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}