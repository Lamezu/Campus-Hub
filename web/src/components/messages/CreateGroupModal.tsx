import { useState, useEffect } from 'react';
import { auth } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { getFriends, type FriendUser } from '../../services/firebase/friendsService';
import { createGroupConversation } from '../../services/firebase/groupDMService';
import { X, Search, Check, Users, ChevronRight, ArrowLeft } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCreated: (groupId: string) => void;
}

type Step = 'select' | 'name';

export default function CreateGroupModal({ onClose, onCreated }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>('select');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFriends(uid).then(setFriends).catch(() => {});
  }, []);

  const filtered = friends.filter(f =>
    f.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || creating || selected.size === 0) return;
    setCreating(true);
    try {
      const me: { id: string; name: string; photo: string | null } = {
        id: currentUser.uid,
        name: currentUser.displayName || 'Tú',
        photo: currentUser.photoURL || null,
      };
      const memberFriends = friends
        .filter(f => selected.has(f.id))
        .map(f => ({ id: f.id, name: f.displayName, photo: f.photoURL }));
      const members = [me, ...memberFriends];

      const name = groupName.trim() || members.filter(m => m.id !== currentUser.uid).map(m => m.name.split(' ')[0]).slice(0, 3).join(', ');
      const groupId = await createGroupConversation(members, name, null, currentUser.uid);
      onCreated(groupId);
    } catch {} finally { setCreating(false); }
  };

  const selectedFriends = friends.filter(f => selected.has(f.id));

  return (
    <div
      className="animate-fade-in"
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}
    >
      <div
        className="animate-scale-in"
        style={{ backgroundColor: 'var(--background)', borderRadius: '20px', width: '100%', maxWidth: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          {step === 'name' && (
            <button onClick={() => setStep('select')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex', padding: 4 }}>
              <ArrowLeft size={20} />
            </button>
          )}
          <span style={{ flex: 1, fontWeight: '700', fontSize: '17px', color: 'var(--text)' }}>
            {step === 'select' ? 'Nuevo grupo' : 'Nombre del grupo'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
            <X size={22} />
          </button>
        </div>

        {step === 'select' ? (
          <>
            {/* Selected chips */}
            {selectedFriends.length > 0 && (
              <div style={{ display: 'flex', gap: 8, padding: '12px 16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)' }}>
                {selectedFriends.map(f => (
                  <button
                    key={f.id}
                    onClick={() => toggle(f.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px 4px 4px', borderRadius: 20,
                      backgroundColor: `${colors.primary}22`, border: `1px solid ${colors.primary}`,
                      cursor: 'pointer', color: colors.primary, fontSize: '13px', fontWeight: '600',
                    }}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>
                      {f.photoURL ? <img src={f.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : f.displayName[0]?.toUpperCase()}
                    </div>
                    {f.displayName.split(' ')[0]}
                    <X size={12} />
                  </button>
                ))}
              </div>
            )}

            {/* Search */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: 'var(--background-secondary)', borderRadius: 10, padding: '8px 14px' }}>
                <Search size={16} color="var(--text-secondary)" />
                <input
                  type="text"
                  placeholder="Buscar amigos..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ border: 'none', background: 'none', outline: 'none', color: 'var(--text)', fontSize: '15px', flex: 1 }}
                  autoFocus
                />
              </div>
            </div>

            {/* Friend list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px 16px', fontSize: '14px' }}>
                  {friends.length === 0 ? 'No tienes amigos aún' : 'Sin resultados'}
                </p>
              ) : (
                filtered.map(f => {
                  const isSelected = selected.has(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => toggle(f.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: '700', color: '#fff', flexShrink: 0 }}>
                        {f.photoURL ? <img src={f.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : f.displayName[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: '600', fontSize: '15px', color: 'var(--text)' }}>{f.displayName}</p>
                        {f.role && <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{f.role}</p>}
                      </div>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        border: `2px solid ${isSelected ? colors.primary : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {isSelected && <Check size={14} color="#fff" strokeWidth={2.5} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Next button */}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => selected.size > 0 && setStep('name')}
                disabled={selected.size === 0}
                className="btn-press"
                style={{
                  width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                  backgroundColor: selected.size > 0 ? colors.primary : 'var(--background-secondary)',
                  color: selected.size > 0 ? '#fff' : 'var(--text-secondary)',
                  fontWeight: '700', fontSize: '15px', cursor: selected.size > 0 ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'background 0.15s',
                }}
              >
                Siguiente
                <ChevronRight size={18} />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Group name step */}
            <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, flex: 1 }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={36} color={colors.primary} />
              </div>

              <div style={{ width: '100%' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Nombre del grupo (opcional)
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder={selectedFriends.map(f => f.displayName.split(' ')[0]).slice(0, 3).join(', ')}
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12,
                    border: '1.5px solid var(--border)', backgroundColor: 'var(--background-secondary)',
                    color: 'var(--text)', fontSize: '15px', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.target.style.borderColor = colors.primary)}
                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              <div style={{ width: '100%' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 8px', fontWeight: '600' }}>
                  {selected.size} {selected.size === 1 ? 'participante' : 'participantes'}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selectedFriends.map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 4px', borderRadius: 20, backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border)' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>
                        {f.photoURL ? <img src={f.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : f.displayName[0]?.toUpperCase()}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text)' }}>{f.displayName.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn-press"
                style={{
                  width: '100%', padding: '13px', borderRadius: 14, border: 'none',
                  backgroundColor: creating ? 'var(--background-secondary)' : colors.primary,
                  color: creating ? 'var(--text-secondary)' : '#fff',
                  fontWeight: '700', fontSize: '15px', cursor: creating ? 'default' : 'pointer',
                }}
              >
                {creating ? 'Creando...' : 'Crear grupo'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
