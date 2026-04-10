import React, { useState, useEffect } from 'react';
import { X, Users, Lock, CheckCircle2, Search, UserPlus } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { ThemedText } from '../themed-text';

interface StudyGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

const CATEGORIES = {
  asignaturas: [
    'Matemáticas', 'Física', 'Química', 'Historia', 'Inglés', 'Francés', 
    'Filosofía', 'Economía', 'Tecnología', 'Programación', 'Otro'
  ],
  departamentos: [
    'Hostelería y Turismo', 'Sanidad', 'Informática y Comunicaciones', 
    'Actividades Físicas y Deportivas', 'Administración y Gestión', 
    'Servicios Socioculturales', 'Energía y Agua', 'Madera, Mueble y Corcho', 
    'Seguridad y Medio Ambiente', 'Idiomas', 'FOL', 'Orientación', 
    'Innovación y Calidad'
  ],
  ciclos: [
    'ASIR', 'DAM', 'DAW', 'SMR', 'TSEAS', 'TCAE', 'Emergencias Sanitarias', 
    'Higiene Bucodental', 'Educación Infantil', 'TAPSD', 'Gestión Administrativa', 
    'Finanzas y Seguros', 'Guía, Información y Asistencia', 'Otro'
  ]
};

const COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#FF3B30', 
  '#AF52DE', '#5AC8FA', '#FF2D55', '#FFCC00'
];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administración',
  teacher: 'Profesor/a',
  student: 'Alumno/a'
};

export function StudyGroupModal({ isOpen, onClose, onSave, initialData }: StudyGroupModalProps) {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<keyof typeof CATEGORIES>('asignaturas');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '', // Mantenemos como categoria principal (segun la ultima seleccion o la primera)
    categoryType: 'asignaturas' as keyof typeof CATEGORIES,
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
        category: initialData.category || initialData.subject || '',
        categoryType: (initialData.categoryType as any) || 'asignaturas',
        isPrivate: initialData.isPrivate || false,
        color: initialData.color || COLORS[0],
        whoCanJoin: initialData.whoCanJoin || 'everyone',
        subjects: initialData.subjects || [],
        departments: initialData.departments || [],
        cycles: initialData.cycles || [],
      });
      setActiveTab((initialData.categoryType as any) || 'asignaturas');
    } else {
      setForm({
        name: '', description: '', category: '', categoryType: 'asignaturas',
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
      showAlert({ title: 'Atención', message: 'Por favor, rellena el nombre y selecciona al menos una categoría.', type: 'info' });
      return;
    }
    setLoading(true);
    try {
      await onSave({
        ...form,
        subject: form.subjects[0] || form.departments[0] || form.cycles[0] || 'Otro',
        invitedUsers,
      });
      onClose();
    } catch (err) {
      console.error(err);
      showAlert({ title: 'Error', message: 'Error al guardar el grupo', type: 'error' });
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
                {initialData ? 'Editar Grupo' : 'Nuevo Grupo de Estudio'}
              </h2>
              <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>Configura tu espacio de estudio</ThemedText>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: 8, borderRadius: '50%', cursor: 'pointer', color: colors.textSecondary }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: colors.text, opacity: 0.8 }}>NOMBRE DEL GRUPO</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Dream Team Programación"
                style={{ padding: '14px 18px', borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 15, outline: 'none', fontWeight: 500 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: colors.text, opacity: 0.8 }}>DESCRIPCIÓN</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Describe el objetivo del grupo..."
                rows={2}
                style={{ padding: '14px 18px', borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 14, outline: 'none', resize: 'none', fontWeight: 500 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: colors.text, opacity: 0.8 }}>CATEGORÍA / ASIGNATURA</label>
              <div style={{ display: 'flex', gap: 8, padding: 4, backgroundColor: colors.backgroundSecondary, borderRadius: 14 }}>
                {(['asignaturas', 'departamentos', 'ciclos'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setForm({...form, categoryType: tab}); }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                      backgroundColor: activeTab === tab ? colors.primary : 'transparent',
                      color: activeTab === tab ? '#fff' : colors.textSecondary,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ 
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10
              }}>
                {CATEGORIES[activeTab].map(item => {
                  const currentList = activeTab === 'asignaturas' ? form.subjects : 
                                    activeTab === 'departamentos' ? form.departments : 
                                    form.cycles;
                  const isSelected = currentList.includes(item);

                  const toggleSelection = () => {
                    let newList: string[];
                    if (isSelected) {
                      newList = currentList.filter(i => i !== item);
                    } else {
                      newList = [...currentList, item];
                    }

                    if (activeTab === 'asignaturas') setForm({ ...form, subjects: newList });
                    else if (activeTab === 'departamentos') setForm({ ...form, departments: newList });
                    else setForm({ ...form, cycles: newList });
                  };

                  return (
                    <button
                      key={item}
                      onClick={toggleSelection}
                      style={{
                        padding: '12px', borderRadius: 12, border: `1.5px solid ${isSelected ? colors.primary : colors.border}`,
                        backgroundColor: isSelected ? colors.primary + '10' : colors.card,
                        color: isSelected ? colors.primary : colors.text,
                        fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item}</span>
                      {isSelected && <CheckCircle2 size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: colors.text, opacity: 0.8 }}>COLOR DEL GRUPO</label>
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
                  <ThemedText style={{ fontSize: 14, fontWeight: '800' }}>Grupo Privado</ThemedText>
                  <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>Solo accesible mediante invitación directa</ThemedText>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.6 }}>QUIÉN PUEDE UNIRSE</label>
                <select 
                  value={form.whoCanJoin}
                  onChange={e => setForm({ ...form, whoCanJoin: e.target.value as any })}
                  style={{ padding: '10px', borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.text, outline: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  <option value="everyone">Todos</option>
                  <option value="teacher">Solo profesores</option>
                  <option value="student">Solo alumnos</option>
                  <option value="admin">Solo administradores</option>
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
              <span>Invitar Miembros ({invitedUsers.length})</span>
            </button>
          </div>
        </div>

        <div style={{ padding: '24px 32px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '16px', borderRadius: 16, border: 'none', backgroundColor: colors.backgroundSecondary, color: colors.text, fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
          <button 
            onClick={handleSave}
            disabled={!form.name || (!form.subjects.length && !form.departments.length && !form.cycles.length) || loading}
            style={{ flex: 1, padding: '16px', borderRadius: 16, border: 'none', backgroundColor: colors.primary, color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: (!form.name || (!form.subjects.length && !form.departments.length && !form.cycles.length) || loading) ? 0.5 : 1 }}
          >
            {loading ? 'Guardando...' : initialData ? 'Guardar Cambios' : 'Crear Grupo'}
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
              <ThemedText style={{ fontSize: 18, fontWeight: '900' }}>Invitar Usuarios</ThemedText>
              <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '16px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', backgroundColor: colors.backgroundSecondary, borderRadius: 12 }}>
                <Search size={18} opacity={0.5} />
                <input 
                  placeholder="Buscar usuarios..." 
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
                    <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.backgroundSecondary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {user.photoURL ? <img src={user.photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <ThemedText style={{ fontWeight: 'bold' }}>{user.displayName[0]}</ThemedText>}
                    </div>
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
                Listo ({invitedUsers.length})
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
