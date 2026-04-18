import React, { useState } from 'react';
import { 
  X, Pin, Calendar, Tag, User, 
  BookOpen, Share2, Plus, ArrowLeft, Save,
  CheckCircle2, Clock, Globe, Trash2
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { RichTextEditor } from './RichTextEditor';
import { useCurrentUser } from '@/contexts/UserContext';
import { useAlert } from '@/contexts/AlertContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { allowedEventTypes } from '@/utils/permissions';
import type { CalendarEventType } from '@/types';

interface AnnouncementDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: any;
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
  general:    { label: 'General',         color: '#8E8E93' },
  erasmus:    { label: 'Erasmus+',         color: '#007AFF' },
  matricula:  { label: 'Matrícula',        color: '#34C759' },
  eventos:    { label: 'Eventos',          color: '#AF52DE' },
  fct:        { label: 'Prácticas FCT',    color: '#FF6B35' },
  becas:      { label: 'Becas',            color: '#5AC8FA' },
  evaluacion: { label: 'Evaluación',       color: '#FF3B30' },
};

const EVENT_TYPES_DATA: { id: CalendarEventType; label: string; color: string }[] = [
  { id: 'exam', label: 'Examen', color: '#FF3B30' },
  { id: 'deadline', label: 'Entrega', color: '#FF9500' },
  { id: 'class', label: 'Clase', color: '#007AFF' },
  { id: 'holiday', label: 'Festivo', color: '#AF52DE' },
  { id: 'event', label: 'Evento', color: '#34C759' },
];

export function AnnouncementDetailModal({ isOpen, onClose, announcement }: AnnouncementDetailModalProps) {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const { isAdmin, role, subrole } = useCurrentUser();
  const { updateAnnouncement, publishAsSocialPost } = useAnnouncements();
  const { createLinkedEvent, deleteEvent, allEvents } = useCalendarEvents();
  const { showAlert } = useAlert();

  const CATEGORIES: Record<string, { label: string; color: string }> = {
    general:    { label: t('announcements.categories.general'),    color: '#8E8E93' },
    erasmus:    { label: t('announcements.categories.erasmus'),    color: '#007AFF' },
    matricula:  { label: t('announcements.categories.matricula'),  color: '#34C759' },
    eventos:    { label: t('announcements.categories.eventos'),    color: '#AF52DE' },
    fct:        { label: t('announcements.categories.fct'),        color: '#FF6B35' },
    becas:      { label: t('announcements.categories.becas'),      color: '#5AC8FA' },
    evaluacion: { label: t('announcements.categories.evaluacion'), color: '#FF3B30' },
  };

  const EVENT_TYPES_DATA: { id: CalendarEventType; label: string; color: string }[] = [
    { id: 'exam', label: t('announcements.event_types.exam'), color: '#FF3B30' },
    { id: 'deadline', label: t('announcements.event_types.deadline'), color: '#FF9500' },
    { id: 'class', label: t('announcements.event_types.class'), color: '#007AFF' },
    { id: 'holiday', label: t('announcements.event_types.holiday'), color: '#AF52DE' },
    { id: 'event', label: t('announcements.event_types.event'), color: '#34C759' },
  ];

  const allowedTypes = allowedEventTypes(role, subrole);
  const visibleEventTypes = EVENT_TYPES_DATA.filter(t => allowedTypes.includes(t.id));

  const [view, setView] = useState<'details' | 'docs'>('details');
  const [isEditingDocs, setIsEditingDocs] = useState(false);
  const [docsContent, setDocsContent] = useState(announcement?.docsContent || '');
  const [isLinkingEvent, setIsLinkingEvent] = useState(false);
  const [linkForm, setLinkForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    type: 'event' as CalendarEventType
  });

  const existingEvent = allEvents.find(e => e.linkedAnnouncementId === announcement?.id);
  const isDocsView = view === 'docs';

  React.useEffect(() => {
    if (!isOpen) {
      setView('details');
      setIsEditingDocs(false);
      setIsLinkingEvent(false);
    } else {
      setDocsContent(announcement?.docsContent || '');
    }
  }, [isOpen, announcement]);

  if (!isOpen || !announcement) return null;

  const catKey = (announcement.category || 'general').toLowerCase();
  const category = CATEGORIES[catKey] || 
                   Object.values(CATEGORIES).find(c => c.label.toLowerCase() === catKey) || 
                   CATEGORIES.general || { label: 'General', color: '#8E8E93' };
  
  const dateStr = announcement.createdAt ? new Date(announcement.createdAt).toLocaleDateString(t('common.locale_code'), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) : t('announcements.details.date_unknown');

  const handleSaveDocs = async () => {
    await updateAnnouncement(announcement.id, {
      ...announcement,
      docsContent: docsContent
    });
    setIsEditingDocs(false);
  };

  const handleConfirmLink = async () => {
    const success = await createLinkedEvent(announcement.id, {
      title: announcement.title,
      date: new Date(linkForm.date + 'T' + linkForm.time),
      time: linkForm.time,
      type: linkForm.type
    });

    if (success) {
      showAlert({ title: t('announcements.link_modal.success_title'), message: t('announcements.link_modal.success_message'), type: 'success' });
      setIsLinkingEvent(false);
    }
  };

  const handleUnlink = async () => {
    if (existingEvent) {
      await deleteEvent(existingEvent.id);
    }
  };

  const handlePublishSocial = async () => {
    await publishAsSocialPost(announcement);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: isDocsView ? colors.background : 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1001,
      backdropFilter: isDocsView ? 'none' : 'blur(8px)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    }}>
      <div style={{
        width: isDocsView ? '100%' : 'calc(100% - 40px)',
        height: isDocsView ? '100%' : 'auto',
        maxWidth: isDocsView ? 'none' : 700,
        backgroundColor: colors.background,
        borderRadius: isDocsView ? 0 : 28,
        boxShadow: isDocsView ? 'none' : '0 30px 60px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: isDocsView ? 'none' : '90vh',
        border: isDocsView ? 'none' : `1px solid ${colors.border || '#ccc'}`,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {!isDocsView ? (
          <div style={{ position: 'relative' }}>
            {announcement.imageUrl ? (
              <div style={{ width: '100%', height: 220, overflow: 'hidden' }}>
                <img src={announcement.imageUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <div style={{ height: 12, backgroundColor: category?.color || colors.primary }} />
            )}
            
            <button 
              onClick={onClose}
              style={{
                position: 'absolute',
                top: 20, left: 20,
                width: 40, height: 40,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(4px)',
                border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10, color: '#fff'
              }}
            >
              <X size={20} />
            </button>
          </div>
        ) : (
          <div style={{ 
            padding: '24px 40px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: (colors.backgroundSecondary || '#eee') + '20'
          }}>
            <button 
              onClick={() => setView('details')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: colors.primary,
                padding: '4px 8px',
                borderRadius: 8,
                backgroundColor: colors.primary + '10'
              }}
            >
              <ArrowLeft size={18} />
              <span style={{ fontWeight: 800, fontSize: 13, textTransform: 'uppercase' }}>{t('announcements.editor.back_to_details')}</span>
            </button>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colors.primary, textTransform: 'uppercase', letterSpacing: 1 }}>DOCUMENTACIÓN /</div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.textSecondary, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{announcement.title}</h2>
            </div>
          </div>
        )}

        <div style={{ 
          padding: isDocsView ? '0' : '32px 40px', 
          overflowY: 'auto', 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: isDocsView ? (colors.backgroundSecondary || '#eee') + '10' : 'transparent'
        }}>
          {view === 'details' ? (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <div style={{ padding: '6px 12px', borderRadius: 8, backgroundColor: (category?.color || '#888') + '15', color: category?.color || '#888', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{category.label}</div>
                {announcement.pinned && <div style={{ padding: '6px 12px', borderRadius: 8, backgroundColor: (colors.primary || '#007AFF') + '15', color: colors.primary, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase' }}><Pin size={12} fill={colors.primary} />{t('announcements.details.pinned')}</div>}
              </div>

              <h1 style={{ margin: '0 0 16px 0', fontSize: 32, fontWeight: 800, color: colors.text, lineHeight: 1.2 }}>{announcement.title}</h1>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32, color: colors.textSecondary, fontSize: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><User size={16} /><span style={{ fontWeight: 600 }}>{announcement.authorName || t('common.user')}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={16} /><span>{dateStr}</span></div>
              </div>

              <div style={{ fontSize: 17, lineHeight: 1.8, color: colors.text, whiteSpace: 'pre-wrap', padding: '24px', backgroundColor: colors.backgroundSecondary, borderRadius: 20, border: `1px solid ${colors.border}`, marginBottom: 32 }}>
                {announcement.content}
              </div>

              <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 700, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BookOpen size={20} />
                  {t('announcements.details.documentation')}
                </h3>
                
                {docsContent ? (
                  <div 
                    onClick={() => setView('docs')}
                    style={{ 
                      padding: '24px', 
                      borderRadius: 24, 
                      backgroundColor: colors.background, 
                      border: `1px solid ${colors.border}`,
                      cursor: 'pointer',
                      maxHeight: 200,
                      overflow: 'hidden',
                      position: 'relative',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = colors.primary;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = colors.border;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div 
                      className="docs-viewer"
                      dangerouslySetInnerHTML={{ __html: docsContent }}
                      style={{ fontSize: 14, color: colors.text, opacity: 0.8 }}
                    />
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
                      background: `linear-gradient(transparent, ${colors.background})`,
                      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 15
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.primary }}>{t('announcements.details.expand')}</span>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => { setView('docs'); setIsEditingDocs(isAdmin); }}
                    style={{ 
                      padding: '30px', borderRadius: 24, border: `2px dashed ${colors.border}`,
                      backgroundColor: (colors.backgroundSecondary || '#eee') + '40', color: colors.textSecondary,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                      cursor: 'pointer', transition: 'all 0.2s', width: '100%'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = colors.primary}
                    onMouseLeave={e => e.currentTarget.style.borderColor = colors.border}
                  >
                    <Plus size={24} style={{ opacity: 0.5 }} />
                    <span style={{ fontWeight: 600 }}>{isAdmin ? t('announcements.details.add_docs') : t('announcements.details.no_docs')}</span>
                  </button>
                )}

                <div style={{ height: 1, backgroundColor: colors.border, margin: '20px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {isLinkingEvent ? (
                    <div style={{ padding: 24, backgroundColor: colors.backgroundSecondary + '40', borderRadius: 24, border: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: 16, color: colors.text }}>{t('announcements.link_modal.title')}</span>
                        <X size={20} onClick={() => setIsLinkingEvent(false)} style={{ cursor: 'pointer', opacity: 0.5 }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', color: colors.text }}>Fecha</label>
                          <input type="date" value={linkForm.date} onChange={e => setLinkForm({...linkForm, date: e.target.value})} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.text, fontSize: 14, outline: 'none' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <label style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', color: colors.text }}>Hora</label>
                          <input type="time" value={linkForm.time} onChange={e => setLinkForm({...linkForm, time: e.target.value})} style={{ padding: '12px 14px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.text, fontSize: 14, outline: 'none' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', color: colors.text }}>Tipo de Evento</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {visibleEventTypes.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setLinkForm({...linkForm, type: t.id})}
                              style={{
                                padding: '8px 16px',
                                borderRadius: 10,
                                border: `2px solid ${linkForm.type === t.id ? t.color : 'transparent'}`,
                                backgroundColor: linkForm.type === t.id ? t.color + '15' : colors.card,
                                color: linkForm.type === t.id ? t.color : colors.textSecondary,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: linkForm.type === t.id ? `0 4px 10px ${t.color}20` : 'none'
                              }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={handleConfirmLink} 
                        style={{ 
                          padding: '14px', borderRadius: 14, border: 'none', 
                          backgroundColor: colors.primary, color: '#fff', 
                          fontWeight: 700, cursor: 'pointer', marginTop: 8,
                          boxShadow: `0 8px 20px ${colors.primary}40`
                        }}
                      >
                        {t('announcements.link_modal.confirm')}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <button
                        onClick={existingEvent ? handleUnlink : () => setIsLinkingEvent(true)}
                        style={{
                          padding: '16px', borderRadius: 16, backgroundColor: existingEvent ? colors.danger + '10' : colors.backgroundSecondary,
                          color: existingEvent ? colors.danger : colors.text, border: `1px solid ${existingEvent ? colors.danger + '40' : colors.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                        }}
                      >
                        {existingEvent ? t('announcements.details.unlink') : t('announcements.details.link_calendar')}
                      </button>
                      <button
                        onClick={(announcement.socialId || announcement.isPublished) ? undefined : handlePublishSocial}
                        disabled={!!(announcement.socialId || announcement.isPublished)}
                        style={{
                          padding: '16px', borderRadius: 16,
                          backgroundColor: (announcement.socialId || announcement.isPublished) ? colors.backgroundSecondary : colors.primary,
                          color: (announcement.socialId || announcement.isPublished) ? colors.textSecondary : '#fff',
                          border: `1px solid ${(announcement.socialId || announcement.isPublished) ? colors.border : 'transparent'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                          fontWeight: 700, cursor: (announcement.socialId || announcement.isPublished) ? 'not-allowed' : 'pointer',
                          opacity: (announcement.socialId || announcement.isPublished) ? 0.6 : 1,
                        }}
                      >
                        <Share2 size={18} /> {(announcement.socialId || announcement.isPublished) ? t('announcements.details.already_published') : t('announcements.details.publish_social')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div style={{ 
              width: '100%', 
              margin: '0 auto', 
              padding: '40px',
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}>
              {isEditingDocs ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <RichTextEditor 
                    value={docsContent} 
                    onChange={setDocsContent} 
                    placeholder={t('announcements.editor.placeholder')}
                    minHeight={600}
                  />
                </div>
              ) : docsContent ? (
                <div style={{ backgroundColor: colors.background, padding: '40px', borderRadius: 28, border: `1px solid ${colors.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', flex: 1 }}>
                  <div 
                    className="docs-viewer"
                    dangerouslySetInnerHTML={{ __html: docsContent }}
                    style={{ fontSize: 16, lineHeight: 1.8, color: colors.text }}
                  />
                </div>
              ) : (
                <div style={{ 
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', 
                  justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
                  backgroundColor: colors.background, borderRadius: 28,
                  border: `2px dashed ${colors.border}`
                }}>
                  <div style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: (colors.primary || '#007AFF') + '10', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                    <BookOpen size={40} color={colors.primary} style={{ opacity: 0.6 }} />
                  </div>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: 22, fontWeight: 700, color: colors.text }}>{t('announcements.details.no_docs')}</h3>
                  <p style={{ margin: '0 0 32px 0', color: colors.textSecondary, fontSize: 15, maxWidth: 360, lineHeight: 1.6 }}>
                    Por ahora no se ha añadido información detallada a este anuncio. Si eres administrador, puedes empezar a redactar ahora mismo.
                  </p>
                  {isAdmin && (
                    <button 
                      onClick={() => setIsEditingDocs(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 32px', borderRadius: 16, border: 'none', backgroundColor: colors.primary, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: `0 8px 20px ${colors.primary}40` }}
                    >
                      <Plus size={20} />
                      {t('announcements.editor.create')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ 
          padding: '24px 40px', 
          borderTop: `1px solid ${colors.border}`, 
          display: 'flex', 
          justifyContent: isDocsView ? 'space-between' : 'center',
          backgroundColor: colors.background,
          zIndex: 10
        }}>
          {isDocsView ? (
            <>
              {isEditingDocs ? (
                <>
                  <button 
                    onClick={() => setIsEditingDocs(false)}
                    style={{ padding: '12px 32px', borderRadius: 16, border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.text, fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
                  >
                    {t('announcements.editor.cancel')}
                  </button>
                  <button 
                    onClick={handleSaveDocs}
                    style={{ padding: '12px 48px', borderRadius: 16, border: 'none', backgroundColor: colors.primary, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: `0 8px 20px ${colors.primary}40` }}
                  >
                    {t('announcements.editor.publish')}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ width: 140 }} />
                  {isAdmin && (
                    <button 
                      onClick={() => setIsEditingDocs(true)}
                      style={{ padding: '12px 48px', borderRadius: 16, border: 'none', backgroundColor: colors.primary, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', boxShadow: `0 8px 20px ${colors.primary}40` }}
                    >
                      {docsContent ? t('announcements.editor.edit') : t('announcements.editor.create')}
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <button 
              onClick={onClose}
              style={{ padding: '12px 48px', borderRadius: 16, border: 'none', backgroundColor: colors.primary, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}
            >
              {t('common.done')}
            </button>
          )}
        </div>
      </div>
      
      <style>{`
        .docs-viewer h1 { font-size: 32px; margin: 30px 0 20px 0; font-weight: 800; color: ${colors.text}; line-height: 1.2; }
        .docs-viewer h2 { font-size: 24px; margin: 25px 0 15px 0; font-weight: 700; color: ${colors.text}; }
        .docs-viewer p { margin-bottom: 16px; font-size: 16px; color: ${colors.text}; }
        .docs-viewer ul, .docs-viewer ol { padding-left: 25px; margin-bottom: 20px; color: ${colors.text}; }
        .docs-viewer li { margin-bottom: 8px; }
        .docs-viewer table { margin: 20px 0; border-radius: 12px; overflow: hidden; border: 1px solid ${colors.border || '#ccc'}; }
        .docs-viewer td, .docs-viewer th { padding: 12px; border: 1px solid ${colors.border || '#ccc'}; color: ${colors.text}; }
      `}</style>
    </div>
  );
}
