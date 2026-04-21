import React, { useState } from 'react';
import { Plus, Search, Loader2, Users as UsersIcon, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useStudyGroups } from '@/hooks/useStudyGroups';
import { GroupCard } from './GroupCard';
import { StudyGroupModal } from './StudyGroupModal';
import { useCurrentUser } from '@/contexts/UserContext';

export function GroupsTab() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { can, firebaseUser } = useCurrentUser();
  const navigate = useNavigate();
  const { groups, loading, createGroup, updateGroup, deleteGroup, joinGroup, leaveGroup } = useStudyGroups();
  
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);

  const filtered = groups.filter(g => 
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.subject.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (data: any) => {
    if (editingGroup) {
      await updateGroup(editingGroup.id, data);
    } else {
      await createGroup(data);
    }
    setShowModal(false);
    setEditingGroup(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: colors.textSecondary }}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const userId = firebaseUser?.uid || '';
  const canCreate = can('createStudyGroup');

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', gap: 32, 
      padding: '32px 40px',
      height: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Search and Action Bar */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ 
          flex: 1, display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', borderRadius: 16,
          backgroundColor: colors.backgroundSecondary,
          border: `1px solid ${colors.border}`,
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
        }}>
          <Search size={20} color={colors.textSecondary} />
          <input 
            type="text" 
            placeholder={t('groups.search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              flex: 1, background: 'none', border: 'none', 
              color: colors.text, outline: 'none', fontSize: 16,
              fontWeight: 500
            }}
          />
        </div>

        {canCreate && (
          <button 
            onClick={() => { setEditingGroup(null); setShowModal(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 28px', borderRadius: 16,
              backgroundColor: colors.primary, color: '#fff',
              border: 'none', fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 8px 20px ${colors.primary}40`,
            }}
          >
            <Plus size={20} />
            <span>{t('groups.create_btn')}</span>
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ 
          textAlign: 'center', padding: '100px 40px', 
          backgroundColor: colors.backgroundSecondary, 
          borderRadius: 32, border: `2px dashed ${colors.border}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16
        }}>
          <UsersIcon size={48} color={colors.textSecondary} opacity={0.5} />
          <div style={{ color: colors.textSecondary, fontSize: 18, fontWeight: 600 }}>
            {search ? t('groups.no_results') : t('groups.no_groups')}
          </div>
          {canCreate && !search && (
            <span style={{ fontSize: 14, opacity: 0.6 }}>{t('groups.placeholders.name_hint')}</span>
          )}
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 24,
          paddingRight: 10,
        }}>
          {filtered.map(group => (
            <GroupCard 
              key={group.id} 
              group={group}
              userId={userId}
              onJoin={() => joinGroup(group.id)}
              onLeave={() => leaveGroup(group.id)}
              onDelete={() => deleteGroup(group.id)}
              onNavigate={() => navigate(`/chat/sg_${group.id}`)}
              onEdit={() => { setEditingGroup(group); setShowModal(true); }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <StudyGroupModal 
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingGroup(null); }}
        onSave={handleSave}
        initialData={editingGroup}
      />
    </div>
  );
}
