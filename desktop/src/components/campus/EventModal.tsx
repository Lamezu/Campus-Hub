import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, Type, Tag, ExternalLink, Trash2, Share2, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAlert } from '@/contexts/AlertContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { allowedEventTypes } from '@/utils/permissions';
import { DEPARTMENTS } from '@/constants/academic';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import type { CalendarEventType } from '@/types';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
  isReadOnly?: boolean;
}

export function EventModal({ isOpen, onClose, onSave, initialData, isReadOnly }: EventModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useAlert();
  const { role, subrole } = useCurrentUser();
  const { deleteEvent, publishEventToSocial } = useCalendarEvents();
  const navigate = useNavigate();
  
  const EVENT_TYPES_DATA: { id: CalendarEventType; label: string; color: string }[] = [
    { id: 'exam', label: t('calendar.event_types.exam'), color: '#FF3B30' },
    { id: 'deadline', label: t('calendar.event_types.deadline'), color: '#FF9500' },
    { id: 'class', label: t('calendar.event_types.class'), color: '#007AFF' },
    { id: 'holiday', label: t('calendar.event_types.holiday'), color: '#AF52DE' },
    { id: 'event', label: t('calendar.event_types.event'), color: '#34C759' },
  ];

  const allowedTypes = allowedEventTypes(role, subrole);
  const visibleTypes = EVENT_TYPES_DATA.filter(t => allowedTypes.includes(t.id));
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    type: 'event' as CalendarEventType,
    departmentId: 'Todos',
  });

  useEffect(() => {
    if (initialData) {
      const rawDate = initialData.date || new Date().toISOString();
      const dateStr = rawDate.includes('T')
        ? rawDate.split('T')[0]
        : rawDate;
      setForm({
        title: initialData.title || '',
        description: initialData.description || '',
        date: dateStr,
        time: initialData.time || '',
        type: initialData.type || 'event',
        departmentId: initialData.departmentId || 'Todos',
      });
    } else {
      setForm({
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '',
        type: 'event',
        departmentId: 'Todos',
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!form.title) return;
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      console.error(err);
      showAlert({ title: t('common.error'), message: t('calendar.save_error'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (initialData?.id) {
      deleteEvent(initialData.id);
      onClose();
    }
  };

  const handlePublish = async () => {
    if (initialData?.id) {
      await publishEventToSocial(initialData);
      onClose();
    }
  };

  const handleGoToAnnouncement = () => {
    if (initialData?.linkedAnnouncementId) {
      onClose();
      navigate('/tabs/campus', { 
        state: { 
          tab: 'bulletin', 
          selectedId: initialData.linkedAnnouncementId 
        } 
      });
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 500,
        backgroundColor: colors.background,
        borderRadius: 24,
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '24px 32px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: colors.text }}>
            {isReadOnly ? t('calendar.event_details') : (initialData?.id ? t('calendar.edit_event') : t('calendar.new_event'))}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {initialData?.linkedAnnouncementId && (
            <button 
              onClick={handleGoToAnnouncement}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 16,
                backgroundColor: colors.primary + '10',
                color: colors.primary,
                border: `1px solid ${colors.primary}30`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontWeight: 700,
                cursor: 'pointer',
                marginBottom: 8
              }}
            >
              <ExternalLink size={18} />
              {t('calendar.view_announcement')}
            </button>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>{t('calendar.fields.title')}</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder={t('calendar.placeholders.title')}
              disabled={isReadOnly}
              style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: isReadOnly ? colors.backgroundSecondary + '80' : colors.backgroundSecondary, color: colors.text, fontSize: 15, outline: 'none', opacity: isReadOnly ? 0.8 : 1 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>{t('calendar.fields.date')}</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                disabled={isReadOnly}
                style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: isReadOnly ? colors.backgroundSecondary + '80' : colors.backgroundSecondary, color: colors.text, fontSize: 15, outline: 'none', opacity: isReadOnly ? 0.8 : 1 }}
              />
            </div>
            <div style={{ width: 120, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>{t('calendar.fields.time')}</label>
              <input
                type="time"
                value={form.time}
                onChange={e => setForm({ ...form, time: e.target.value })}
                disabled={isReadOnly}
                style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: isReadOnly ? colors.backgroundSecondary + '80' : colors.backgroundSecondary, color: colors.text, fontSize: 15, outline: 'none', opacity: isReadOnly ? 0.8 : 1 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>{t('calendar.fields.type')}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {isReadOnly ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, backgroundColor: (EVENT_TYPES_DATA.find(t => t.id === form.type)?.color || colors.primary) + '15' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: EVENT_TYPES_DATA.find(t => t.id === form.type)?.color }} />
                  <span style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                    {EVENT_TYPES_DATA.find(t => t.id === form.type)?.label}
                  </span>
                </div>
              ) : (
                visibleTypes.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => setForm({ ...form, type: t.id })}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: `1px solid ${form.type === t.id ? t.color : colors.border}`,
                      backgroundColor: form.type === t.id ? t.color + '15' : 'transparent',
                      color: form.type === t.id ? t.color : colors.textSecondary,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {t.label}
                  </button>
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>{t('calendar.fields.description')} ({t('common.optional')})</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder={t('calendar.placeholders.description')}
              rows={3}
              disabled={isReadOnly}
              style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: isReadOnly ? colors.backgroundSecondary + '80' : colors.backgroundSecondary, color: colors.text, fontSize: 14, outline: 'none', resize: 'none', opacity: isReadOnly ? 0.8 : 1 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>{t('calendar.fields.department')}</label>
            <div style={{ position: 'relative' }}>
              <select
                value={form.departmentId}
                onChange={e => setForm({ ...form, departmentId: e.target.value })}
                disabled={isReadOnly}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: isReadOnly ? colors.backgroundSecondary + '80' : colors.backgroundSecondary,
                  color: colors.text,
                  fontSize: 15,
                  outline: 'none',
                  appearance: 'none',
                  cursor: isReadOnly ? 'default' : 'pointer',
                  fontWeight: 600,
                  opacity: isReadOnly ? 0.8 : 1
                }}
              >
                {DEPARTMENTS.map(dep => (
                  <option key={dep} value={dep}>
                    {t(`common.departments.${dep.toLowerCase().replace(/ /g, '_')}`, { defaultValue: dep })}
                  </option>
                ))}
              </select>
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }}>
                <ChevronDown size={18} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '24px 32px', borderTop: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onClose} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', backgroundColor: colors.backgroundSecondary, color: colors.text, fontWeight: 700, cursor: 'pointer' }}>{isReadOnly ? t('common.done') : t('common.cancel')}</button>
            {!isReadOnly && (
              <button 
                onClick={handleSave}
                disabled={!form.title || loading}
                style={{ padding: '12px 24px', borderRadius: 12, border: 'none', backgroundColor: colors.primary, color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (!form.title || loading) ? 0.5 : 1 }}
              >
                {loading ? t('common.loading') : initialData?.id ? t('common.update') : t('calendar.add_event')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
