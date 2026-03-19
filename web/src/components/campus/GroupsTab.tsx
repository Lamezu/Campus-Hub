import { useState, useMemo } from 'react';
import { Plus, X, Search, Check, ChevronLeft, Globe, Lock, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useStudyGroups } from '../../hooks/campus/useStudyGroups';
import { GroupCard } from './GroupCard';
import { auth } from '../../config/firebase';
import type { StudyGroup, UserRole } from '../../types';

const GROUP_CATEGORIES = ['Asignaturas', 'Departamentos', 'Ciclos'] as const;
type GroupCategory = typeof GROUP_CATEGORIES[number];

const GROUP_SUBJECTS_MAP: Record<GroupCategory, string[]> = {
  Asignaturas: ['Matemáticas', 'Física', 'Química', 'Historia', 'Inglés', 'Francés', 'Filosofía', 'Economía', 'Tecnología', 'Programación', 'Otro'],
  Departamentos: ['Hostelería y Turismo', 'Sanidad', 'Informática y Comunicaciones', 'Actividades Físicas y Deportivas', 'Administración y Gestión', 'Servicios Socioculturales', 'Energía y Agua', 'Madera, Mueble y Corcho', 'Seguridad y Medio Ambiente', 'Idiomas', 'FOL', 'Orientación', 'Innovación y Calidad'],
  Ciclos: ['ASIR', 'DAM', 'DAW', 'SMR', 'TSEAS', 'TCAE', 'Emergencias Sanitarias', 'Higiene Bucodental', 'Educación Infantil', 'TAPSD', 'Gestión Administrativa', 'Finanzas y Seguros', 'Guía, Información y Asistencias Turísticas', 'Otro'],
};

const ROLE_OPTIONS: Array<{ label: string; desc: string; value: UserRole[] }> = [
  { label: 'Todos', desc: 'Cualquier usuario puede unirse', value: [] },
  { label: 'Solo profesores', desc: 'Profesores y coordinadores', value: ['teacher'] },
  { label: 'Solo alumnos', desc: 'Estudiantes y delegados', value: ['student'] },
  { label: 'Solo administradores', desc: 'Equipo directivo', value: ['admin'] },
];

const GROUP_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA', '#FF2D55', '#FFCC00'];

const STEPS = ['Nombre', 'Asignatura', 'Color', 'Acceso', 'Invitar'];

interface GroupsTabProps {
  canCreate: boolean;
  isAdmin: boolean;
}

const initialForm = {
  name: '', description: '',
  subject: GROUP_SUBJECTS_MAP.Asignaturas[0],
  color: GROUP_COLORS[0],
  isPrivate: false,
  allowedRoles: [] as UserRole[],
  invitedUserIds: [] as string[],
};

export function GroupsTab({ canCreate, isAdmin }: GroupsTabProps) {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const { groups, allUsers, loadingUsers, joinGroup, leaveGroup, createGroup, updateGroup, deleteGroup, loadUsers } = useStudyGroups(isAdmin);

  const [showCreate, setShowCreate] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [subjectCategory, setSubjectCategory] = useState<GroupCategory>('Asignaturas');

  const [editingGroup, setEditingGroup] = useState<StudyGroup | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', subject: GROUP_SUBJECTS_MAP.Asignaturas[0], color: GROUP_COLORS[0] });
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
    await createGroup(form);
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
      <div style={{ display: 'flex', alignItems: 'center', margin: '12px 16px', padding: '8px 14px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, gap: 10 }}>
        <Search size={18} color={colors.textSecondary} />
        <input
          type="text"
          placeholder="Buscar grupos..."
          value={groupSearch}
          onChange={e => setGroupSearch(e.target.value)}
          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: colors.text, fontSize: 15, fontFamily: 'inherit' }}
        />
      </div>

      {canCreate && (
        <button
          onClick={() => { loadUsers(); setShowCreate(true); }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginInline: 16, marginBottom: 12, padding: '14px', borderRadius: 12, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={18} color="#fff" strokeWidth={2.5} />
          Crear grupo de estudio
        </button>
      )}

      <div style={{ overflowY: 'auto', flex: 1, padding: '0 16px 16px' }}>
        {filteredGroups.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 40, fontSize: 15, color: colors.textSecondary, opacity: 0.6 }}>
            {groupSearch ? 'No se encontraron grupos.' : 'No hay grupos aún.'}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: colors.background, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
              <button onClick={() => setEditingGroup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={22} color={colors.text} strokeWidth={2} />
              </button>
              <span style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>Editar grupo</span>
              <button
                onClick={handleSaveEdit}
                disabled={!editForm.name.trim()}
                style={{ background: 'none', border: 'none', cursor: editForm.name.trim() ? 'pointer' : 'not-allowed', fontSize: 16, fontWeight: 600, color: editForm.name.trim() ? colors.primary : colors.textSecondary }}
              >
                Guardar
              </button>
            </div>

            <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
              {(['info', 'members'] as const).map(t => (
                <button key={t} onClick={() => setEditTab(t)} style={{ flex: 1, padding: '14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: editTab === t ? colors.primary : colors.textSecondary, borderBottom: `3px solid ${editTab === t ? colors.primary : 'transparent'}`, marginBottom: -1 }}>
                  {t === 'info' ? 'Información' : `Miembros (${editMembers.length})`}
                </button>
              ))}
            </div>

            {editTab === 'info' ? (
              <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input type="text" placeholder="Nombre del grupo" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                  style={{ fontSize: 20, fontWeight: 700, border: 'none', borderBottom: `1px solid ${colors.border}`, outline: 'none', background: 'transparent', color: colors.text, padding: '10px 0', fontFamily: 'inherit', width: '100%' }} />
                <textarea placeholder="Descripción (opcional)" value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3}
                  style={{ fontSize: 15, border: 'none', outline: 'none', background: 'transparent', color: colors.text, resize: 'none', fontFamily: 'inherit', minHeight: 80 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  {GROUP_CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setSubjectCategory(cat)}
                      style={{ flex: 1, padding: '8px', borderRadius: 10, border: `1.5px solid ${subjectCategory === cat ? colors.primary : colors.border}`, backgroundColor: subjectCategory === cat ? colors.primary + '10' : 'transparent', color: subjectCategory === cat ? colors.primary : colors.textSecondary, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      {cat}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {GROUP_SUBJECTS_MAP[subjectCategory].map(s => (
                    <button key={s} onClick={() => setEditForm(f => ({ ...f, subject: s }))}
                      style={{ padding: '7px 12px', borderRadius: 20, border: `1px solid ${editForm.subject === s ? colors.primary : colors.border}`, backgroundColor: editForm.subject === s ? colors.primary + '15' : 'transparent', color: editForm.subject === s ? colors.primary : colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {s}
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
                  <input type="text" placeholder="Buscar o añadir personas..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
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
                          <div style={{ fontSize: 12, opacity: 0.6, color: colors.textSecondary }}>{item.role}{isOwner ? ' (Creador)' : ''}</div>
                        </div>
                        {!isOwner && (
                          <button
                            onClick={() => setEditMembers(prev => isMember ? prev.filter(id => id !== item.uid) : [...prev, item.uid])}
                            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, backgroundColor: isMember ? '#FF3B30' + '15' : colors.primary + '15', color: isMember ? '#FF3B30' : colors.primary }}
                          >
                            {isMember ? 'Eliminar' : 'Añadir'}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: colors.background, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${colors.border}` }}>
              <button onClick={() => step > 0 ? setStep(s => s - 1) : setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                {step > 0 ? <ChevronLeft size={24} color={colors.text} /> : <X size={22} color={colors.text} />}
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                {STEPS.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i <= step ? colors.primary : colors.border }} />)}
              </div>
              <button
                onClick={step === STEPS.length - 1 ? handleCreateSubmit : () => setStep(s => s + 1)}
                disabled={step === 0 && !form.name.trim()}
                style={{ background: 'none', border: 'none', cursor: (step === 0 && !form.name.trim()) ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 600, color: (step === 0 && !form.name.trim()) ? colors.textSecondary : colors.primary }}
              >
                {step === STEPS.length - 1 ? 'Crear' : 'Siguiente'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingTop: 24 }}>
              <div style={{ fontSize: 24, fontWeight: 800, marginInline: 16, marginBottom: 20, color: colors.text }}>{STEPS[step]}</div>

              {step === 0 && (
                <div style={{ paddingInline: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 14, color: colors.textSecondary, lineHeight: '20px' }}>Escribe un nombre claro para que otros alumnos lo identifiquen.</div>
                  <input autoFocus type="text" placeholder="Nombre del grupo (ej: Repaso de Álgebra)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    style={{ fontSize: 22, fontWeight: 600, border: 'none', borderBottom: `2px solid ${colors.primary}`, outline: 'none', background: 'transparent', color: colors.text, padding: '10px 0', fontFamily: 'inherit', width: '100%' }} />
                  <textarea placeholder="Descripción (opcional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                    style={{ fontSize: 16, border: 'none', borderBottom: `2px solid ${colors.border}`, outline: 'none', background: 'transparent', color: colors.text, resize: 'none', fontFamily: 'inherit', marginTop: 12, paddingBottom: 8 }} />
                </div>
              )}

              {step === 1 && (
                <div style={{ paddingInline: 16 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {GROUP_CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setSubjectCategory(cat)}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${subjectCategory === cat ? colors.primary : colors.border}`, backgroundColor: subjectCategory === cat ? colors.primary + '10' : 'transparent', color: subjectCategory === cat ? colors.primary : colors.textSecondary, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {GROUP_SUBJECTS_MAP[subjectCategory].map(s => (
                      <button key={s} onClick={() => setForm(f => ({ ...f, subject: s }))}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, width: 'calc(50% - 5px)', padding: '14px', borderRadius: 16, border: `1.5px solid ${form.subject === s ? colors.primary : colors.border}`, backgroundColor: form.subject === s ? colors.primary + '10' : 'transparent', color: form.subject === s ? colors.primary : colors.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ flex: 1 }}>{s}</span>
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
                  {[{ isPrivate: false, label: 'Público', desc: 'Cualquier usuario que cumpla los requisitos de rol podrá verlo y unirse.', icon: <Globe size={20} color={!form.isPrivate ? '#fff' : colors.textSecondary} /> },
                    { isPrivate: true, label: 'Privado', desc: 'Solo los usuarios invitados podrán ver y acceder a este grupo.', icon: <Lock size={20} color={form.isPrivate ? '#fff' : colors.textSecondary} /> }].map(opt => (
                    <button key={opt.label} onClick={() => setForm(f => ({ ...f, isPrivate: opt.isPrivate }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20, border: `2px solid ${form.isPrivate === opt.isPrivate ? colors.primary : colors.border}`, backgroundColor: form.isPrivate === opt.isPrivate ? colors.primary + '08' : 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: form.isPrivate === opt.isPrivate ? colors.primary : colors.border + '44', flexShrink: 0 }}>{opt.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{opt.label}</div>
                        <div style={{ fontSize: 13, lineHeight: '18px', marginTop: 2, color: colors.textSecondary }}>{opt.desc}</div>
                      </div>
                      {form.isPrivate === opt.isPrivate && <Check size={20} color={colors.primary} strokeWidth={3} />}
                    </button>
                  ))}
                  <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginTop: 8, opacity: 0.8 }}>¿Quién puede unirse?</div>
                  {ROLE_OPTIONS.map(opt => {
                    const isSelected = JSON.stringify(form.allowedRoles) === JSON.stringify(opt.value);
                    return (
                      <button key={opt.label} onClick={() => setForm(f => ({ ...f, allowedRoles: opt.value }))}
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
                    <input type="text" placeholder="Buscar por nombre o email..." value={userSearch} onChange={e => setUserSearch(e.target.value)}
                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: colors.text, fontSize: 15, fontFamily: 'inherit' }} />
                  </div>
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {loadingUsers ? (
                      <div style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>Cargando...</div>
                    ) : filteredUsers.length === 0 ? (
                      <div style={{ textAlign: 'center', marginTop: 20, color: colors.textSecondary }}>No se encontraron usuarios</div>
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
