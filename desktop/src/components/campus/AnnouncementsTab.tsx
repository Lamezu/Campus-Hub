import React, { useState } from 'react';
import { Plus, Search, Loader2, Sparkles } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementModal } from './AnnouncementModal';
import { AnnouncementDetailModal } from './AnnouncementDetailModal';
import { useCurrentUser } from '@/contexts/UserContext';
import { useTranslation } from '@/contexts/LanguageContext';

const CATEGORIES = [
  { key: 'all', labelKey: 'announcements.categories.all' },
  { key: 'general', labelKey: 'announcements.categories.general' },
  { key: 'erasmus', labelKey: 'announcements.categories.erasmus' },
  { key: 'matricula', labelKey: 'announcements.categories.matricula' },
  { key: 'eventos', labelKey: 'announcements.categories.eventos' },
  { key: 'fct', labelKey: 'announcements.categories.fct' },
  { key: 'becas', labelKey: 'announcements.categories.becas' },
  { key: 'evaluacion', labelKey: 'announcements.categories.evaluacion' },
];

export function AnnouncementsTab({ initialId, onConsumeId }: { initialId?: string, onConsumeId?: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { can } = useCurrentUser();
  const { 
    announcements, loading, createAnnouncement, updateAnnouncement, 
    togglePin, deleteAnnouncement 
  } = useAnnouncements();

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [viewingAnnouncement, setViewingAnnouncement] = useState<any>(null);

  React.useEffect(() => {
    if (initialId && announcements.length > 0) {
      const found = announcements.find((a: any) => a.id === initialId);
      if (found) {
        setViewingAnnouncement(found);
        onConsumeId?.();
      }
    }
  }, [initialId, announcements, onConsumeId]);

  const filtered = announcements.filter(a => {
    const matchesSearch = 
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'all' || 
      (a.category || 'general').toLowerCase() === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSave = async (data: any) => {
    if (editingAnnouncement) {
      await updateAnnouncement(editingAnnouncement.id, data);
    } else {
      await createAnnouncement(data);
    }
    setShowModal(false);
    setEditingAnnouncement(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: colors.textSecondary }}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const canCreate = can('createAnnouncement');

  return (
    <div style={{ 
      display: 'flex', flexDirection: 'column', gap: 24, 
      padding: '40px 40px 32px 40px',
      height: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        display: 'flex', gap: 16, alignItems: 'center',
        padding: '8px 4px',
      }}>
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
            placeholder={t('announcements.search_announcements')}
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
            onClick={() => { setEditingAnnouncement(null); setShowModal(true); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 28px', borderRadius: 16,
              backgroundColor: colors.primary, color: '#fff',
              border: 'none', fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 8px 20px ${colors.primary}40`,
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
          >
            <Plus size={20} />
            <span>{t('announcements.new_announcement')}</span>
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            style={{
              padding: '8px 18px',
              borderRadius: 20,
              border: `1.5px solid ${activeCategory === cat.key ? colors.primary : colors.border}`,
              backgroundColor: activeCategory === cat.key ? colors.primary + '15' : colors.backgroundSecondary,
              color: activeCategory === cat.key ? colors.primary : colors.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ 
          textAlign: 'center', padding: '100px 40px', 
          backgroundColor: colors.backgroundSecondary, 
          borderRadius: 32, border: `2px dashed ${colors.border}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16
        }}>
          <Sparkles size={48} color={colors.textSecondary} opacity={0.5} />
          <div style={{ color: colors.textSecondary, fontSize: 18, fontWeight: 600 }}>
            {search || activeCategory !== 'all' ? t('announcements.no_results') : t('announcements.no_announcements')}
          </div>
          {canCreate && !search && activeCategory === 'all' && (
            <span style={{ fontSize: 14, opacity: 0.6 }}>{t('announcements.create_first')}</span>
          )}
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 28,
          paddingBottom: 40,
        }}>
          {filtered.map(ann => (
            <AnnouncementCard 
              key={ann.id} 
              post={ann} 
              onEdit={() => { setEditingAnnouncement(ann); setShowModal(true); }}
              onPin={() => togglePin(ann.id, !!ann.pinned)}
              onDelete={() => deleteAnnouncement(ann.id)}
              onPress={() => setViewingAnnouncement(ann)}
            />
          ))}
        </div>
      )}

      <AnnouncementModal 
        isOpen={showModal} 
        onClose={() => { setShowModal(false); setEditingAnnouncement(null); }}
        onSave={handleSave}
        initialData={editingAnnouncement}
      />

      <AnnouncementDetailModal 
        isOpen={!!viewingAnnouncement}
        onClose={() => setViewingAnnouncement(null)}
        announcement={viewingAnnouncement}
      />
    </div>
  );
}
