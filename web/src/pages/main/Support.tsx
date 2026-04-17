import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  addDoc, collection, doc, onSnapshot, orderBy,
  query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { CheckCircle, ChevronsDown, Circle, Clock, Plus, Send, TicketCheck, X } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useTranslation } from '../../hooks/useTranslation';
import type { Ticket, TicketReply, TicketStatus } from '../../types';

const STATUS_COLORS: Record<TicketStatus, string> = {
  open: '#FF9500',
  in_progress: '#007AFF',
  resolved: '#34C759',
};


type FilterStatus = 'all' | TicketStatus;

function formatDate(ts: any, language: string = 'es'): string {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const locale = language === 'en' ? 'en-US' : 'es-ES';
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const color = STATUS_COLORS[status];
  const { t } = useTranslation();
  const STATUS_LABELS: Record<TicketStatus, string> = {
    open: t('support.status_open'),
    in_progress: t('support.status_in_progress'),
    resolved: t('support.status_resolved'),
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      borderRadius: 20, padding: '3px 8px',
      backgroundColor: color + '22', border: `1px solid ${color}55`,
      fontSize: 11, fontWeight: '600', color, flexShrink: 0,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, display: 'inline-block' }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function ReplyBubble({ reply, colors, language, isStaffViewer }: { reply: TicketReply; colors: any; language: string; isStaffViewer: boolean }) {
  const currentUser = auth.currentUser;
  const isOwnMessage = currentUser && reply.authorId === currentUser.uid;
  const showOnRight = isOwnMessage || (reply.isStaff && isStaffViewer);
  const showAuthorName = !isOwnMessage && !reply.isStaff;
  const authorDisplayName = reply.isStaff ? 'Staff' : reply.authorName;
  return (
    <div className="msg-enter" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: showOnRight ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      {reply.isStaff && !isOwnMessage && (
        <span style={{
          fontSize: 10, fontWeight: '700', color: colors.primary,
          backgroundColor: colors.primary + '18',
          borderRadius: 4, padding: '1px 6px', marginBottom: 3,
        }}>Staff</span>
      )}
      <div style={{
        maxWidth: '75%',
        padding: '10px 14px',
        borderRadius: showOnRight ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        backgroundColor: showOnRight ? colors.primary : colors.backgroundSecondary,
        border: showOnRight ? 'none' : `1px solid ${colors.border}`,
      }}>
        {showAuthorName && (
          <div style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 4 }}>
            {authorDisplayName}
          </div>
        )}
        <div style={{ fontSize: 14, lineHeight: '20px', color: showOnRight ? '#fff' : colors.text, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {reply.text}
        </div>
        <div style={{ fontSize: 11, marginTop: 4, color: showOnRight ? 'rgba(255,255,255,0.65)' : colors.textSecondary }}>
          {formatDate(reply.createdAt, language)}
        </div>
      </div>
    </div>
  );
}

function TicketDetail({ ticket, onClose, isStaff, colors, inline }: {
  ticket: Ticket;
  onClose: () => void;
  isStaff: boolean;
  colors: any;
  inline?: boolean;
}) {
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;
  const { t, language } = useTranslation();

  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 80);
  };

  const scrollToBottom = () => {
    if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
  };

  useEffect(() => {
    const q = query(
      collection(db, 'tickets', ticket.id, 'replies'),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, snap => {
      setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketReply)));
      setTimeout(() => {
        if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }, 100);
    });
  }, [ticket.id]);

  const handleSend = async () => {
    const txt = replyText.trim();
    if (!txt || !currentUser || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'tickets', ticket.id, 'replies'), {
        authorId: currentUser.uid,
        authorName: currentUser.displayName || currentUser.email || t('common.user'),
        authorPhoto: currentUser.photoURL ?? null,
        text: txt,
        isStaff,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'tickets', ticket.id), { updatedAt: serverTimestamp() });
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: TicketStatus) => {
    await updateDoc(doc(db, 'tickets', ticket.id), { status, updatedAt: serverTimestamp() });
  };

  const inner = (
    <div style={{
      backgroundColor: colors.background,
      borderRadius: inline ? 0 : 18,
      width: '100%',
      maxWidth: inline ? undefined : 600,
      maxHeight: inline ? undefined : '70vh',
      height: inline ? '100%' : undefined,
      display: 'flex', flexDirection: 'column',
      boxShadow: inline ? 'none' : '0 8px 40px rgba(0,0,0,0.18)',
      overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 16px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0,
      }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <X size={20} color={colors.text} strokeWidth={2} />
        </button>
        <span style={{ flex: 1, fontSize: 15, fontWeight: '700', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ticket.title}
        </span>
        <StatusBadge status={ticket.status} />
      </div>

      <div ref={scrollAreaRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
        <div style={{
          borderRadius: 14, padding: 14,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.backgroundSecondary,
        }}>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>
            {ticket.userName} · {formatDate(ticket.createdAt, language)}
          </div>
          <div style={{ fontSize: 14, color: colors.text, lineHeight: '22px', wordBreak: 'break-word', overflowWrap: 'break-word', maxHeight: 200, overflowY: 'auto' }}>
            {ticket.description}
          </div>
        </div>

        {isStaff && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ticket.status !== 'in_progress' && (
              <button
                onClick={() => handleStatusChange('in_progress')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '7px 12px', border: '1px solid #007AFF44', backgroundColor: '#007AFF18', cursor: 'pointer', fontSize: 13, fontWeight: '600', color: '#007AFF' }}
              >
                <Clock size={14} strokeWidth={2} color="#007AFF" /> {t('support.status_in_progress')}
              </button>
            )}
            {ticket.status !== 'resolved' && (
              <button
                onClick={() => handleStatusChange('resolved')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '7px 12px', border: '1px solid #34C75944', backgroundColor: '#34C75918', cursor: 'pointer', fontSize: 13, fontWeight: '600', color: '#34C759' }}
              >
                <CheckCircle size={14} strokeWidth={2} color="#34C759" /> {t('support.status_resolved')}
              </button>
            )}
            {ticket.status === 'resolved' && (
              <button
                onClick={() => handleStatusChange('open')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 20, padding: '7px 12px', border: '1px solid #FF950044', backgroundColor: '#FF950018', cursor: 'pointer', fontSize: 13, fontWeight: '600', color: '#FF9500' }}
              >
                <Circle size={14} strokeWidth={2} color="#FF9500" /> {t('support.mark_open')}
              </button>
            )}
          </div>
        )}

        {replies.length === 0 ? (
          <p style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', padding: '16px 0' }}>
            {t('support.no_replies')}
          </p>
        ) : (
          replies.map(r => <ReplyBubble key={r.id} reply={r} colors={colors} language={language} isStaffViewer={isStaff} />)
        )}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="btn-press animate-scale-in"
          style={{
            position: 'absolute',
            bottom: 74,
            right: 16,
            width: 40, height: 40,
            borderRadius: '50%',
            backgroundColor: colors.background,
            border: `1px solid ${colors.border}`,
            boxShadow: '0 2px 12px rgba(0,0,0,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ChevronsDown size={20} color={colors.text} strokeWidth={2} />
        </button>
      )}

      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 8,
        padding: '10px 12px', borderTop: `1px solid ${colors.border}`, flexShrink: 0,
      }}>
        <textarea
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={t('support.reply_placeholder')}
          rows={1}
          style={{
            flex: 1, resize: 'none', border: `1px solid ${colors.border}`,
            borderRadius: 20, padding: '10px 14px', fontSize: 14,
            color: colors.text, backgroundColor: colors.backgroundSecondary,
            outline: 'none', maxHeight: 100, fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!replyText.trim() || sending}
          style={{
            width: 40, height: 40, borderRadius: 20, border: 'none', flexShrink: 0,
            backgroundColor: replyText.trim() ? colors.primary : colors.border,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: replyText.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          <Send size={16} color="#fff" strokeWidth={2} />
        </button>
      </div>
    </div>
  );

  if (inline) return inner;

  return (
    <div className="animate-fade-in" style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1200, padding: 24,
    }}>
      <div className="animate-scale-in" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex' }}>
        {inner}
      </div>
    </div>
  );
}

function NewTicketModal({ onClose, colors }: { onClose: () => void; colors: any }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const currentUser = auth.currentUser;
  const { t } = useTranslation();
  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !currentUser) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'tickets'), {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || t('common.user'),
        userPhoto: currentUser.photoURL ?? null,
        title: title.trim(),
        description: description.trim(),
        status: 'open' as TicketStatus,
        repliesCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: '100%', border: `1px solid ${colors.border}`, borderRadius: 12,
    padding: '12px 14px', fontSize: 15, color: colors.text,
    backgroundColor: colors.backgroundSecondary, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div className="animate-fade-in" style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1200, padding: 24,
    }}>
      <div className="animate-scale-in" style={{
        backgroundColor: colors.background, borderRadius: 18,
        width: '100%', maxWidth: 500, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{t('support.new_ticket')}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
            <X size={20} color={colors.text} strokeWidth={2} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{t('support.ticket_title')}</label>
          <input
            type="text"
            placeholder={t('support.ticket_title_placeholder')}
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={120}
            style={fieldStyle}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{t('support.ticket_description')}</label>
          <textarea
            placeholder={t('support.ticket_description_placeholder')}
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={2000}
            rows={5}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-press"
          style={{
            width: '100%', padding: '14px', borderRadius: 14, border: 'none',
            backgroundColor: canSubmit ? colors.primary : colors.border,
            color: '#fff', fontSize: 15, fontWeight: '700',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? '...' : t('support.submit')}
        </button>
      </div>
    </div>
  );
}

function TicketList({ filtered, tickets, filter, setFilter, loading, isStaff, selectedTicketId, onSelect, onNewTicket, colors }: {
  filtered: Ticket[];
  tickets: Ticket[];
  filter: FilterStatus;
  setFilter: (f: FilterStatus) => void;
  loading: boolean;
  isStaff: boolean;
  selectedTicketId: string | null;
  onSelect: (id: string) => void;
  onNewTicket?: () => void;
  colors: any;
}) {
  const { t, language } = useTranslation();
  const countFor = (s: TicketStatus) => tickets.filter(tk => tk.status === s).length;

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: t('support.all_tickets') },
    { key: 'open', label: t('support.status_open') },
    { key: 'in_progress', label: t('support.status_in_progress') },
    { key: 'resolved', label: t('support.status_resolved') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {!isStaff && onNewTicket && (
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          <button
            onClick={onNewTicket}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 0', borderRadius: 12, border: 'none',
              backgroundColor: colors.primary, color: '#fff',
              fontSize: 14, fontWeight: '700', cursor: 'pointer',
            }}
          >
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            {t('support.new_ticket')}
          </button>
        </div>
      )}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 12px',
        borderBottom: `1px solid ${colors.border}`, flexShrink: 0,
        justifyContent: 'center',
      }}>
        {FILTERS.map(f => {
          const count = f.key === 'all' ? tickets.length : countFor(f.key as TicketStatus);
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                borderRadius: 20, padding: '4px 10px', border: 'none', cursor: 'pointer',
                backgroundColor: active ? colors.primary : 'rgba(120,120,128,0.12)',
                color: active ? '#fff' : colors.textSecondary,
                fontSize: 12, fontWeight: '600', whiteSpace: 'nowrap',
              }}
            >
              {f.label}
              {count > 0 && (
                <span style={{
                  borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center',
                  backgroundColor: active ? 'rgba(255,255,255,0.3)' : colors.primary + '22',
                  color: active ? '#fff' : colors.primary, fontSize: 11, fontWeight: '700',
                }}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', scrollSnapType: 'y proximity' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${colors.backgroundSecondary}`, borderTopColor: colors.primary, animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px', gap: 12 }}>
            <TicketCheck size={44} color={colors.textSecondary} strokeWidth={1.2} />
            <span style={{ fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
              {t('support.no_tickets')}
            </span>
            {!isStaff && (
              <span style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: '20px' }}>
                {t('support.subtitle')}
              </span>
            )}
          </div>
        ) : (
          <div style={{ padding: '10px 12px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(ticket => {
              const isSelected = ticket.id === selectedTicketId;
              return (
                <div
                  key={ticket.id}
                  onClick={() => onSelect(ticket.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    borderRadius: 12, padding: 14, cursor: 'pointer',
                    border: `1px solid ${isSelected ? colors.primary + '88' : colors.border}`,
                    backgroundColor: isSelected ? colors.primary + '10' : colors.background,
                    transition: 'background-color 0.12s, border-color 0.12s',
                    scrollSnapAlign: 'start',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = colors.backgroundSecondary; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = colors.background; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 14, fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {ticket.title}
                      </span>
                      <StatusBadge status={ticket.status} />
                    </div>
                    <p style={{ fontSize: 12, color: colors.textSecondary, margin: 0, lineHeight: '18px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {ticket.description}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      {ticket.userPhoto
                        ? <img src={ticket.userPhoto} style={{ width: 14, height: 14, borderRadius: 7, objectFit: 'cover' }} alt="" />
                        : <div style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 8, color: '#fff', fontWeight: '700' }}>{(ticket.userName || '?')[0].toUpperCase()}</span>
                        </div>
                      }
                      <span style={{ fontSize: 11, color: colors.textSecondary }}>{ticket.userName}</span>
                      <span style={{ fontSize: 11, color: colors.textSecondary }}>·</span>
                      <span style={{ fontSize: 11, color: colors.textSecondary }}>{formatDate(ticket.createdAt, language)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Support() {
  const { colors } = useTheme();
  const isDesktop = useWindowSize();

  useLayoutEffect(() => {
    if (!isDesktop) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isDesktop]);
  const { t, language } = useTranslation();
  const currentUser = auth.currentUser;
  const [userData, setUserData] = useState<any>(undefined);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const selectedTicket = selectedTicketId ? tickets.find(t => t.id === selectedTicketId) ?? null : null;
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!currentUser) { setUserData(null); return; }
    const unsub = onSnapshot(doc(db, 'users', currentUser.uid), snap => {
      setUserData(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [currentUser?.uid]);

  const userDataReady = userData !== undefined;
  const isStaff = userData?.role === 'admin' || userData?.role === 'teacher' || userData?.subrole === 'coordinator';

  useEffect(() => {
    if (!currentUser) return;
    const col = collection(db, 'tickets');
    const q = isStaff
      ? query(col, orderBy('createdAt', 'desc'))
      : query(col, where('userId', '==', currentUser.uid));

    return onSnapshot(q, snap => {
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
      if (!isStaff) {
        list = list.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? new Date(a.createdAt).getTime();
          const tb = b.createdAt?.toMillis?.() ?? new Date(b.createdAt).getTime();
          return tb - ta;
        });
      }
      setTickets(list);
      setLoading(false);
    }, () => setLoading(false));
  }, [currentUser?.uid, isStaff]);

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  if (isDesktop) {
    return (
      <Layout title={t('support.title')} showBackButton>
        <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
          <div style={{
            width: 460, flexShrink: 0, borderRight: `1px solid ${colors.border}`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {userDataReady && (
              <TicketList
                filtered={filtered}
                tickets={tickets}
                filter={filter}
                setFilter={setFilter}
                loading={loading}
                isStaff={isStaff}
                selectedTicketId={selectedTicketId}
                onSelect={setSelectedTicketId}
                onNewTicket={() => setShowNew(true)}
                colors={colors}
              />
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {selectedTicket ? (
              <TicketDetail
                ticket={selectedTicket}
                onClose={() => setSelectedTicketId(null)}
                isStaff={isStaff}
                colors={colors}
                inline
              />
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 }}>
                <TicketCheck size={56} color={colors.border} strokeWidth={1.2} />
                <span style={{ fontSize: 17, fontWeight: '600', color: colors.textSecondary }}>
                  {t('support.select_ticket')}
                </span>
              </div>
            )}
          </div>
        </div>

        {showNew && (
          <NewTicketModal onClose={() => setShowNew(false)} colors={colors} />
        )}
      </Layout>
    );
  }

  return (
    <Layout title={t('support.title')} showBackButton>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 0 80px' }}>

        <div style={{
          display: 'flex', gap: 8, padding: '12px 16px',
          borderBottom: `1px solid ${colors.border}`, overflowX: 'auto',
        }}>
          {([
            { key: 'all', label: t('support.all_tickets') },
            { key: 'open', label: t('support.status_open') },
            { key: 'in_progress', label: t('support.status_in_progress') },
            { key: 'resolved', label: t('support.status_resolved') },
          ] as { key: FilterStatus; label: string }[]).map(f => {
            const count = f.key === 'all' ? tickets.length : tickets.filter(t => t.status === f.key).length;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
                  borderRadius: 20, padding: '6px 13px', border: 'none', cursor: 'pointer',
                  backgroundColor: active ? colors.primary : 'rgba(120,120,128,0.12)',
                  color: active ? '#fff' : colors.textSecondary,
                  fontSize: 13, fontWeight: '600',
                }}
              >
                {f.label}
                {count > 0 && (
                  <span style={{
                    borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center',
                    backgroundColor: active ? 'rgba(255,255,255,0.3)' : colors.primary + '22',
                    color: active ? '#fff' : colors.primary, fontSize: 11, fontWeight: '700',
                  }}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${colors.backgroundSecondary}`, borderTopColor: colors.primary, animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 32px', gap: 12 }}>
            <TicketCheck size={52} color={colors.textSecondary} strokeWidth={1.2} />
            <span style={{ fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' }}>
              {t('support.no_tickets')}
            </span>
            {!isStaff && (
              <span style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: '22px' }}>
                {t('support.subtitle')}
              </span>
            )}
          </div>
        ) : (
          <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(ticket => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  borderRadius: 12, padding: 14, cursor: 'pointer',
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.background,
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.backgroundSecondary; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.background; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 15, fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {ticket.title}
                    </span>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <p style={{ fontSize: 13, color: colors.textSecondary, margin: 0, lineHeight: '18px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {ticket.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    {ticket.userPhoto
                      ? <img src={ticket.userPhoto} style={{ width: 16, height: 16, borderRadius: 8, objectFit: 'cover' }} alt="" />
                      : <div style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>{(ticket.userName || '?')[0].toUpperCase()}</span>
                      </div>
                    }
                    <span style={{ fontSize: 12, color: colors.textSecondary }}>{ticket.userName}</span>
                    <span style={{ fontSize: 12, color: colors.textSecondary }}>·</span>
                    <span style={{ fontSize: 12, color: colors.textSecondary }}>{formatDate(ticket.createdAt, language)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isStaff && (
        <button
          onClick={() => setShowNew(true)}
          style={{
            position: 'fixed', bottom: 24, right: 24,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '13px 20px', borderRadius: 28, border: 'none',
            backgroundColor: colors.primary, color: '#fff',
            fontSize: 15, fontWeight: '700', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          }}
        >
          <Plus size={20} color="#fff" strokeWidth={2.5} />
          {t('support.new_ticket')}
        </button>
      )}

      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          onClose={() => setSelectedTicketId(null)}
          isStaff={isStaff}
          colors={colors}
        />
      )}
      {showNew && (
        <NewTicketModal onClose={() => setShowNew(false)} colors={colors} />
      )}
    </Layout>
  );
}
