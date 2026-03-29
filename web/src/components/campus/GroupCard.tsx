import { useState } from 'react';
import { Users, Lock, MoreVertical, MessageSquare } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import type { StudyGroup } from '../../types';

interface GroupCardProps {
  group: StudyGroup;
  userId: string;
  onJoin: () => void;
  onLeave: () => void;
  onNavigate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function GroupCard({ group, userId, onJoin, onLeave, onNavigate, onEdit, onDelete }: GroupCardProps) {
  const { colors } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMember = group.memberIds.includes(userId);

  const handleMemberBtn = () => {
    const action = window.confirm(`${group.name}\n\nPresiona Aceptar para ir al canal o Cancelar para salir del grupo.`);
    if (action) onNavigate?.();
    else if (window.confirm('¿Salir del grupo?')) onLeave();
  };

  return (
    <div
      style={{
        display: 'flex', gap: 12,
        borderRadius: 16, border: `1px solid ${colors.border}`,
        padding: 14, backgroundColor: colors.card,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        marginBottom: 10, cursor: isMember ? 'pointer' : 'default',
      }}
      onClick={isMember ? onNavigate : undefined}
    >
      <div style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: group.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
        {group.photoURL
          ? <img src={group.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: '#fff', fontSize: 22, fontWeight: 800 }}>{group.name.charAt(0).toUpperCase()}</span>
        }
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: colors.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</span>
          {group.isPrivate && <Lock size={12} color={colors.textSecondary} strokeWidth={2} />}
          {(onEdit || onDelete) && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
              >
                <MoreVertical size={16} color={colors.textSecondary} />
              </button>
              {menuOpen && (
                <>
                  <div onClick={e => { e.stopPropagation(); setMenuOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                  <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 20, backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, overflow: 'hidden', minWidth: 140, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                    {onEdit && (
                      <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: colors.text }}>
                        Editar
                      </button>
                    )}
                    {onDelete && (
                      <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                        style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: '#FF3B30' }}>
                        Eliminar
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <span style={{ fontSize: 12, fontWeight: 600, color: group.color }}>{group.subject}</span>

        {!!group.description && (
          <span style={{ fontSize: 12, color: colors.textSecondary, lineHeight: '16px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {group.description}
          </span>
        )}

        {(group.allowedRoles?.length ?? 0) > 0 && (
          <span style={{ fontSize: 11, color: colors.textSecondary }}>Solo: {group.allowedRoles!.join(', ')}</span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={12} color={colors.textSecondary} strokeWidth={2} />
            <span style={{ fontSize: 12, color: colors.textSecondary }}>{group.memberCount} miembros</span>
          </div>

          {isMember ? (
            <button
              onClick={e => { e.stopPropagation(); handleMemberBtn(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, border: `1px solid ${group.color}`, backgroundColor: group.color + '20', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: group.color }}
            >
              <MessageSquare size={11} color={group.color} strokeWidth={2.5} />
              Ir al canal
            </button>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onJoin(); }}
              style={{ padding: '5px 12px', borderRadius: 8, border: 'none', backgroundColor: group.color, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fff' }}
            >
              Unirse
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
