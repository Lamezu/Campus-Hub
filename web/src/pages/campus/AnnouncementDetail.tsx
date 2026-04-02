import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, updateDoc, deleteDoc, addDoc, collection,
  onSnapshot, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { ChevronLeft, Pin, Megaphone, X, Pencil, Trash2, CalendarDays, ChevronRight, ImagePlus, FileText, Search, AlignLeft } from 'lucide-react';
import RichTextEditor from '../../components/RichTextEditor';
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useCurrentUser } from '../../hooks/campus/useCurrentUser';
import { useCalendarEvents } from '../../hooks/campus/useCalendarEvents';
import { getCategoryConfig, ANNOUNCEMENT_CATEGORIES } from '../../constants/announcementCategories';
import { uploadAnnouncementImage } from '../../config/cloudinary';
import Layout from '../../components/Layout';
import { useWindowSize } from '../../hooks/useWindowSize';
import type { Post, CalendarEvent, CalendarEventType } from '../../types';

type PinDuration = 'permanent' | '1d' | '3d' | '1w' | '1m';

const EVENT_TYPE_CONFIG: Record<CalendarEventType, { label: string; color: string }> = {
  exam:     { label: 'Examen',   color: '#FF3B30' },
  deadline: { label: 'Entrega',  color: '#FF9500' },
  holiday:  { label: 'Festivo',  color: '#34C759' },
  event:    { label: 'Evento',   color: '#007AFF' },
  class:    { label: 'Clase',    color: '#AF52DE' },
};

const EVENT_TYPES: CalendarEventType[] = ['event', 'exam', 'deadline', 'class', 'holiday'];

const PIN_LABELS: Record<PinDuration, string> = { '1d': '1 día', '3d': '3 días', '1w': '1 sem', '1m': '1 mes', permanent: 'Siempre' };

function getPinExpiryText(pinnedUntil: string | null | undefined): string | null {
  if (!pinnedUntil) return null;
  const remaining = new Date(pinnedUntil).getTime() - Date.now();
  if (remaining <= 0) return 'Fijado (expirado)';
  const days = Math.ceil(remaining / 86400000);
  if (days < 2) return 'Fijado · expira hoy';
  if (days < 8) return `Fijado · expira en ${days}d`;
  return `Fijado · expira en ${Math.ceil(days / 7)}sem`;
}

export default function AnnouncementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { can, department } = useCurrentUser();
  const isMobile = !useWindowSize();
  const currentUser = auth.currentUser;
  const { createLinkedEvent } = useCalendarEvents();

  const [announcement, setAnnouncement] = useState<Post | null>(null);
  const [linkedEvent, setLinkedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '', content: '', pinned: false,
    pinnedUntil: 'permanent' as PinDuration, category: 'general', imageUrl: null as string | null,
  });

  const [showDocsEditor, setShowDocsEditor] = useState(false);
  const [showDocsViewer, setShowDocsViewer] = useState(false);
  const [docsContent, setDocsContent] = useState('');
  const [savingDocs, setSavingDocs] = useState(false);
  const [docsSearchQuery, setDocsSearchQuery] = useState('');
  const [showDocsSearch, setShowDocsSearch] = useState(false);

  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const today = new Date();
  const [eventDate, setEventDate] = useState(today.toISOString().slice(0, 10));
  const [eventTime, setEventTime] = useState('');
  const [eventForm, setEventForm] = useState({ title: '', type: 'event' as CalendarEventType });

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'posts', id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const ann = {
          id: snap.id, ...d,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          updatedAt: null,
        } as Post;
        setAnnouncement(ann);
        setEditForm({
          title: ann.title, content: ann.content, pinned: !!ann.pinned,
          pinnedUntil: (ann.pinnedUntil as PinDuration) || 'permanent',
          category: ann.category || 'general', imageUrl: ann.imageUrl || null,
        });
        setDocsContent(ann.docsContent || '');
        setEventForm(f => ({ ...f, title: ann.title }));
      }
      setLoading(false);
    }, (err) => {
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!announcement?.linkedEventId) { setLinkedEvent(null); return; }
    getDoc(doc(db, 'events', announcement.linkedEventId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setLinkedEvent({
          id: snap.id,
          title: data.title ?? '',
          description: data.description ?? '',
          date: data.startDate instanceof Timestamp ? data.startDate.toDate().toISOString() : new Date().toISOString(),
          endDate: null,
          allDay: data.allDay ?? true,
          time: data.time ?? null,
          type: (data.category ?? data.type ?? 'event') as CalendarEventType,
          authorId: data.creatorId ?? '',
          authorName: data.authorName ?? '',
          createdAt: new Date().toISOString(),
          linkedAnnouncementId: id ?? null,
        });
      }
    }).catch(() => {});
  }, [announcement?.linkedEventId]);

  const isAuthor = !!(currentUser && announcement?.authorId === currentUser.uid);
  const canLinkEvent = isAuthor && (can('createAcademicEvent') || can('createGeneralEvent'));

  const handleDelete = async () => {
    if (window.confirm('¿Seguro que quieres eliminar este anuncio?')) {
      await deleteDoc(doc(db, 'posts', id!));
      navigate(-1);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditImageFile(file);
    setEditImagePreview(URL.createObjectURL(file));
    setEditForm(f => ({ ...f, imageUrl: null }));
    e.target.value = '';
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim() || !editForm.content.trim()) return;
    let pinnedUntil: string | null = null;
    if (editForm.pinned) {
      const durations: Record<string, number> = { '1d': 86400000, '3d': 3 * 86400000, '1w': 7 * 86400000, '1m': 30 * 86400000 };
      if (durations[editForm.pinnedUntil]) pinnedUntil = new Date(Date.now() + durations[editForm.pinnedUntil]).toISOString();
    }
    let imageUrl = editImageFile ? null : editForm.imageUrl;
    if (editImageFile) {
      setUploadingImage(true);
      try { imageUrl = await uploadAnnouncementImage(editImageFile); }
      catch { imageUrl = editForm.imageUrl; }
      finally { setUploadingImage(false); }
    }
    await updateDoc(doc(db, 'posts', id!), {
      title: editForm.title.trim(), content: editForm.content.trim(),
      pinned: editForm.pinned, pinnedUntil, category: editForm.category,
      imageUrl: imageUrl ?? null,
      updatedAt: serverTimestamp(),
    });
    if (announcement?.socialId) {
      await updateDoc(doc(db, 'posts', announcement.socialId), {
        title: editForm.title.trim(),
        content: editForm.content.trim(),
        mediaUrl: imageUrl ?? null,
        mediaType: imageUrl ? 'image' : null,
        updatedAt: serverTimestamp(),
      });
    }
    setEditImageFile(null);
    setEditImagePreview(null);
    setShowEdit(false);
  };

  const handlePublishSocial = async () => {
    if (!currentUser || !announcement) return;
    if (!window.confirm('¿Publicar este anuncio como post en el feed social?')) return;
    const docRef = await addDoc(collection(db, 'posts'), {
      title: announcement.title, content: announcement.content,
      authorId: announcement.authorId, authorName: announcement.authorName,
      authorPhoto: announcement.authorPhoto ?? null,
      postType: 'post',
      mediaUrl: announcement.imageUrl ?? null,
      mediaType: announcement.imageUrl ? 'image' : null,
      likes: [], likesCount: 0, commentsCount: 0,
      viewsCount: 0, views: [], createdAt: serverTimestamp(), updatedAt: null,
      tags: ['anuncio'],
    });
    await updateDoc(doc(db, 'posts', id!), { socialId: docRef.id });
  };

  const handleCreateEvent = async () => {
    if (!eventForm.title.trim()) return;
    setSavingEvent(true);
    await createLinkedEvent(id!, {
      title: eventForm.title.trim(),
      date: new Date(eventDate),
      time: eventTime || null,
      type: eventForm.type,
      departmentId: department,
    });
    setSavingEvent(false);
    setShowCreateEvent(false);
  };

  const handleSaveDocs = async () => {
    if (!id) return;
    setSavingDocs(true);
    await updateDoc(doc(db, 'posts', id), { docsContent: docsContent || null });
    setSavingDocs(false);
    setShowDocsEditor(false);
  };

  const handleDeleteDocs = async () => {
    if (!id || !window.confirm('¿Eliminar toda la documentación?')) return;
    await updateDoc(doc(db, 'posts', id), { docsContent: null });
    setDocsContent('');
    setShowDocsEditor(false);
  };

  const highlightSearchInHtml = (html: string, query: string): string => {
    if (!query.trim()) return html;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return html.replace(new RegExp(`(${escaped})`, 'gi'), '<mark style="background:#FFD60A55;border-radius:2px;padding:0 2px;">$1</mark>');
  };

  if (loading) {
    return (
      <Layout title="Anuncio">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${colors.border}`, borderTopColor: colors.primary, animation: 'spin 0.8s linear infinite' }} />
        </div>
      </Layout>
    );
  }

  if (!announcement) {
    return (
      <Layout title="Anuncio">
        <div style={{ textAlign: 'center', marginTop: 60, color: colors.textSecondary }}>Anuncio no encontrado.</div>
      </Layout>
    );
  }

  const category = getCategoryConfig(announcement.category);
  const pinExpiry = getPinExpiryText(announcement.pinnedUntil);

  return (
    <Layout title="Anuncio">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: `1px solid ${colors.border}` }}>
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontSize: 15 }}>
            <ChevronLeft size={22} color={colors.primary} strokeWidth={2} />
            Tablón
          </button>
          {isAuthor && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setShowEdit(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}>
                <Pencil size={19} color={colors.primary} strokeWidth={1.8} />
              </button>
              <button onClick={handleDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}>
                <Trash2 size={19} color="#FF3B30" strokeWidth={1.8} />
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${colors.border}` }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: colors.textSecondary }}>
            {announcement.authorName} · {new Date(announcement.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>

        {announcement.imageUrl ? (
          <div style={{ width: '100%', height: 220, overflow: 'hidden' }}>
            <img src={announcement.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `center ${announcement.imageOffsetY ?? 50}%`, display: 'block' }} />
          </div>
        ) : (
          <div style={{ height: 5, backgroundColor: category.color }} />
        )}

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, backgroundColor: category.color + '18' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: category.color }}>{category.label.toUpperCase()}</span>
            </div>
            {announcement.pinned && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, backgroundColor: colors.primary + '12' }}>
                <Pin size={10} color={colors.primary} strokeWidth={2} />
                <span style={{ fontSize: 11, fontWeight: 700, color: colors.primary }}>{pinExpiry ?? 'FIJADO'}</span>
              </div>
            )}
          </div>

          <h1 style={{ fontSize: 24, fontWeight: 800, color: colors.text, margin: 0, lineHeight: '32px' }}>{announcement.title}</h1>

          <div style={{ borderRadius: 12, padding: 16, backgroundColor: colors.backgroundSecondary, border: `1px solid ${colors.border}` }}>
            <p style={{ fontSize: 16, color: colors.text, margin: 0, lineHeight: '26px', whiteSpace: 'pre-wrap' }}>{announcement.content}</p>
          </div>

          {(announcement.docsContent || isAuthor) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {announcement.docsContent && (
                <button
                  onClick={() => setShowDocsViewer(true)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  <FileText size={16} strokeWidth={2} />
                  Ver documentación
                </button>
              )}
              {isAuthor && (
                <button
                  onClick={() => setShowDocsEditor(true)}
                  style={{ flex: announcement.docsContent ? 0 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, border: `1px dashed ${colors.primary}60`, backgroundColor: colors.primary + '08', color: colors.primary, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  {announcement.docsContent
                    ? <Pencil size={15} strokeWidth={2} />
                    : <><AlignLeft size={15} strokeWidth={2} /> Añadir documentación</>
                  }
                </button>
              )}
            </div>
          )}

          {linkedEvent ? (
            <div
              onClick={() => navigate('/campus')}
              style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, border: `1px solid ${EVENT_TYPE_CONFIG[linkedEvent.type].color}30`, padding: 14, backgroundColor: EVENT_TYPE_CONFIG[linkedEvent.type].color + '10', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, backgroundColor: EVENT_TYPE_CONFIG[linkedEvent.type].color + '20' }}>
                <CalendarDays size={13} color={EVENT_TYPE_CONFIG[linkedEvent.type].color} strokeWidth={2} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3, color: EVENT_TYPE_CONFIG[linkedEvent.type].color }}>
                  {EVENT_TYPE_CONFIG[linkedEvent.type].label.toUpperCase()}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{linkedEvent.title}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {new Date(linkedEvent.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {linkedEvent.time ? ` · ${linkedEvent.time}` : ''}
                </div>
              </div>
              <ChevronRight size={16} color={EVENT_TYPE_CONFIG[linkedEvent.type].color} strokeWidth={2} />
            </div>
          ) : canLinkEvent ? (
            <button
              onClick={() => setShowCreateEvent(true)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, border: `1px dashed ${colors.primary}50`, padding: '14px', backgroundColor: colors.primary + '08', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: colors.primary }}
            >
              <CalendarDays size={16} color={colors.primary} strokeWidth={2} />
              Vincular evento al calendario
            </button>
          ) : null}

          {isAuthor && (
            announcement.socialId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 10, border: '1px solid #FF950040', backgroundColor: '#FF950012' }}>
                <Megaphone size={13} color="#FF9500" strokeWidth={2} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#FF9500' }}>Ya publicado como post</span>
              </div>
            ) : (
              <button
                onClick={handlePublishSocial}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 10, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                <Megaphone size={16} color="#fff" strokeWidth={2} />
                Publicar como post
              </button>
            )
          )}

        </div>
      </div>

      {showEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: colors.background, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${colors.border}` }}>
              <button onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={22} color={colors.text} strokeWidth={2} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>Editar anuncio</span>
              <button
                onClick={handleSaveEdit}
                disabled={!editForm.title.trim() || !editForm.content.trim() || uploadingImage}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: (editForm.title.trim() && editForm.content.trim() && !uploadingImage) ? colors.primary : colors.textSecondary }}
              >
                {uploadingImage ? '...' : 'Guardar'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

              {(editImagePreview || editForm.imageUrl) ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 140 }}>
                  <img src={editImagePreview ?? editForm.imageUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => { setEditImageFile(null); setEditImagePreview(null); setEditForm(f => ({ ...f, imageUrl: null })); }}
                    style={{ position: 'absolute', top: 8, right: 8, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, cursor: 'pointer', padding: 4, display: 'flex' }}
                  >
                    <X size={14} color={colors.text} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `1px solid ${colors.border}`, borderRadius: 12, height: 100, backgroundColor: colors.backgroundSecondary, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <ImagePlus size={22} color={colors.textSecondary} strokeWidth={1.5} />
                  <span style={{ fontSize: 13, color: colors.textSecondary }}>Imagen de portada (opcional)</span>
                </button>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ANNOUNCEMENT_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setEditForm(f => ({ ...f, category: cat.id }))}
                    style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${editForm.category === cat.id ? cat.color : colors.border}`, backgroundColor: editForm.category === cat.id ? cat.color : colors.backgroundSecondary, color: editForm.category === cat.id ? '#fff' : colors.text, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {cat.label}
                  </button>
                ))}
              </div>

              <input type="text" placeholder="Título" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                style={{ fontSize: 18, fontWeight: 700, border: 'none', borderBottom: `1px solid ${colors.border}`, outline: 'none', background: 'transparent', color: colors.text, padding: '8px 0', fontFamily: 'inherit' }} />

              <textarea placeholder="Contenido..." value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} rows={5}
                style={{ fontSize: 15, border: 'none', outline: 'none', background: 'transparent', color: colors.text, resize: 'vertical', fontFamily: 'inherit', lineHeight: '22px' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Pin size={16} color={colors.text} strokeWidth={2} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>Fijar anuncio</span>
                </div>
                <button onClick={() => setEditForm(f => ({ ...f, pinned: !f.pinned }))}
                  style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', backgroundColor: editForm.pinned ? colors.primary : colors.border, position: 'relative' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', position: 'absolute', top: 2, left: editForm.pinned ? 20 : 2, transition: 'left 0.2s' }} />
                </button>
              </div>

              {editForm.pinned && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: `1px solid ${colors.border}` }}>
                  {(['1d', '3d', '1w', '1m', 'permanent'] as PinDuration[]).map(opt => (
                    <button key={opt} onClick={() => setEditForm(f => ({ ...f, pinnedUntil: opt }))}
                      style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${editForm.pinnedUntil === opt ? colors.primary : colors.border}`, backgroundColor: editForm.pinnedUntil === opt ? colors.primary + '15' : 'transparent', color: editForm.pinnedUntil === opt ? colors.primary : colors.textSecondary, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {PIN_LABELS[opt]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showDocsViewer && announcement?.docsContent && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0, backgroundColor: colors.background }}>
            <button onClick={() => { setShowDocsViewer(false); setShowDocsSearch(false); setDocsSearchQuery(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 6 }}>
              <X size={22} color={colors.text} strokeWidth={2} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} color={colors.textSecondary} strokeWidth={2} />
              <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>Documentación</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => { setShowDocsSearch(v => !v); setDocsSearchQuery(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', borderRadius: 8, backgroundColor: showDocsSearch ? colors.primary + '15' : 'transparent' }}
              >
                <Search size={17} color={showDocsSearch ? colors.primary : colors.textSecondary} strokeWidth={2} />
              </button>
              {isAuthor && (
                <button
                  onClick={() => { setShowDocsViewer(false); setShowDocsEditor(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 8, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Pencil size={13} strokeWidth={2} /> Editar
                </button>
              )}
            </div>
          </div>

          {showDocsSearch && (
            <div style={{ padding: '8px 16px', borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.background, flexShrink: 0 }}>
              <input
                type="text"
                placeholder="Buscar en documentación..."
                value={docsSearchQuery}
                onChange={e => setDocsSearchQuery(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 14, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', backgroundColor: isMobile ? '#fff' : '#e8eaed', padding: isMobile ? 0 : '40px 24px' }}>
            <div style={{ maxWidth: isMobile ? '100%' : 860, margin: '0 auto', backgroundColor: '#ffffff', boxShadow: isMobile ? 'none' : '0 1px 5px rgba(0,0,0,0.18)', borderRadius: isMobile ? 0 : 2, padding: isMobile ? '20px 16px 40px' : '72px 96px', minHeight: isMobile ? 'auto' : 1040 }}>
              <div style={{ marginBottom: isMobile ? 16 : 32, paddingBottom: 12, borderBottom: '1px solid #e0e0e0' }}>
                <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#202124', margin: 0 }}>{announcement.title}</h2>
              </div>
              <div
                className="ch-prose"
                style={{ fontSize: 15, lineHeight: '28px', color: '#202124' }}
                dangerouslySetInnerHTML={{
                  __html: docsSearchQuery.trim()
                    ? highlightSearchInHtml(announcement.docsContent, docsSearchQuery)
                    : announcement.docsContent,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showDocsEditor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0, backgroundColor: colors.background }}>
            <button onClick={() => setShowDocsEditor(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 6 }}>
              <X size={22} color={colors.text} strokeWidth={2} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={15} color={colors.textSecondary} strokeWidth={2} />
              <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>Documentación</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {announcement?.docsContent && (
                <button onClick={handleDeleteDocs} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}>
                  <Trash2 size={18} color="#FF3B30" strokeWidth={1.8} />
                </button>
              )}
              <button
                onClick={handleSaveDocs}
                disabled={savingDocs}
                style={{ padding: '6px 16px', borderRadius: 8, border: 'none', backgroundColor: savingDocs ? colors.border : colors.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: savingDocs ? 'default' : 'pointer' }}
              >
                {savingDocs ? '...' : 'Guardar'}
              </button>
            </div>
          </div>
          <RichTextEditor
            content={docsContent}
            onChange={setDocsContent}
            colors={colors}
            placeholder="Añade información adicional, instrucciones, recursos o cualquier detalle relevante..."
            pageMode
            pageTitle={announcement?.title}
          />
        </div>
      )}

      {showCreateEvent && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: colors.background, borderRadius: 16, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${colors.border}` }}>
              <button onClick={() => setShowCreateEvent(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={22} color={colors.text} strokeWidth={2} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>Vincular evento</span>
              <button onClick={handleCreateEvent} disabled={!eventForm.title.trim() || savingEvent}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: (eventForm.title.trim() && !savingEvent) ? colors.primary : colors.textSecondary }}>
                {savingEvent ? '...' : 'Crear'}
              </button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="text" placeholder="Nombre del evento" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))}
                style={{ fontSize: 18, fontWeight: 700, border: 'none', borderBottom: `1px solid ${colors.border}`, outline: 'none', background: 'transparent', color: colors.text, padding: '8px 0', fontFamily: 'inherit', width: '100%' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 15, fontFamily: 'inherit', outline: 'none' }} />
                <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 15, fontFamily: 'inherit', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {EVENT_TYPES.map(t => {
                  const cfg = EVENT_TYPE_CONFIG[t];
                  const active = eventForm.type === t;
                  return (
                    <button key={t} onClick={() => setEventForm(f => ({ ...f, type: t }))}
                      style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${active ? cfg.color : colors.border}`, backgroundColor: active ? cfg.color : colors.backgroundSecondary, color: active ? '#fff' : colors.text, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
