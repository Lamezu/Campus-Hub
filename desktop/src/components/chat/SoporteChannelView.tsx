import React, { useState, useMemo, useRef } from 'react';
import { 
  MessageSquare, Clock, CheckCircle2, 
  Send, Plus, X, Loader2,
  Camera, Trash2, ArrowLeft, Type, AlertCircle, RotateCcw, ShieldCheck
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTickets, type Ticket, type TicketStatus } from '@/hooks/useTickets';
import { useCurrentUser } from '@/contexts/UserContext';
import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/contexts/LanguageContext';
import { STATUS_COLORS } from '@/constants/styles';

export function SoporteChannelView({ initialTicketId }: { initialTicketId?: string | null }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { tickets, loading, createTicket, updateTicketStatus, sendTicketMessage, useTicketChat } = useTickets();
  const { isAdmin } = useCurrentUser();
  
  const [activeTab, setActiveTab] = useState<'all' | TicketStatus>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(initialTicketId || null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  React.useEffect(() => {
    if (initialTicketId) setSelectedTicketId(initialTicketId);
  }, [initialTicketId]);
  
  const selectedTicket = useMemo(() => 
    tickets.find(t => t.id === selectedTicketId),
    [tickets, selectedTicketId]
  );

  const filteredTickets = tickets.filter(t => activeTab === 'all' || t.status === activeTab);

  const handleCreate = async (title: string, description: string) => {
    await createTicket(title, description);
    setShowCreateModal(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', backgroundColor: colors.background, height: '100%', overflow: 'hidden' }}>
      {/* Left Sidebar: Ticket List */}
      <div style={{ 
        width: 580, 
        display: 'flex', 
        flexDirection: 'column', 
        borderRight: `1px solid ${colors.border}`, 
        backgroundColor: colors.background,
        position: 'relative'
      }}>
        {/* Header - Sidebar */}
        <div style={{ padding: '0px 24px 20px' }}>
           <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10,
            marginTop: 20,
            overflowX: 'auto',
            paddingBottom: 4
           }} className="hide-scrollbar">
            {(['all', 'open', 'in_progress', 'resolved'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 14,
                  backgroundColor: activeTab === tab ? colors.primary : colors.card,
                  color: activeTab === tab ? '#fff' : colors.textSecondary,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  boxShadow: activeTab === tab ? `0 4px 15px ${colors.primary}40` : 'none',
                  border: activeTab === tab ? 'none' : `1px solid ${colors.border}`
                }}
              >
                {tab === 'all' ? t('common.all') : t(`desktop.actions.${tab}`)}
                <span style={{ 
                  backgroundColor: activeTab === tab ? 'rgba(255,255,255,0.2)' : `${colors.primary}15`,
                  padding: '2px 8px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700
                }}>
                  {tickets.filter(t => tab === 'all' || t.status === tab).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Ticket List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }} className="custom-scrollbar">
          {loading ? (
             <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}><Loader2 className="animate-spin" size={24} color={colors.primary} /></div>
          ) : filteredTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
              <ThemedText style={{ fontSize: 13 }}>{t('support.no_tickets')}</ThemedText>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredTickets.map(ticket => (
                <div 
                  key={ticket.id}
                  onClick={() => setSelectedTicketId(ticket.id)}
                  style={{
                    backgroundColor: selectedTicketId === ticket.id ? `${colors.primary}10` : colors.card,
                    borderRadius: 14,
                    padding: 14,
                    border: `1px solid ${selectedTicketId === ticket.id ? colors.primary : colors.border}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                    <div style={{ 
                      padding: '4px 10px', borderRadius: 8, 
                      backgroundColor: STATUS_COLORS[ticket.status] + '15', color: STATUS_COLORS[ticket.status],
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      {t(`desktop.actions.${ticket.status}`)}
                    </div>
                  </div>
                  <ThemedText style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 4, display: 'block', letterSpacing: '-0.02em' }}>{ticket.title}</ThemedText>
                  <ThemedText style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12, display: 'block', opacity: 0.8, lineHeight: 1.5 }} numberOfLines={2}>{ticket.description}</ThemedText>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.backgroundSecondary }}>
                      {ticket.userPhoto ? <img src={ticket.userPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{(ticket.userName || 'U')[0]}</div>}
                    </div>
                    <ThemedText style={{ fontSize: 12, fontWeight: 500, color: colors.textSecondary }}>{ticket.userName} • {new Date(ticket.createdAt).toLocaleDateString()}</ThemedText>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Button */}
        {!isAdmin && (
          <div style={{ padding: 12, borderTop: `1px solid ${colors.border}` }}>
             <button 
                onClick={() => setShowCreateModal(true)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  color: '#fff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <Plus size={16} /> {t('desktop.new_ticket')}
              </button>
          </div>
        )}
      </div>

      {/* Right Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {selectedTicket ? (
           <TicketDetailView 
            ticket={selectedTicket} 
            onBack={() => setSelectedTicketId(null)}
            updateStatus={updateTicketStatus}
            sendMessage={sendTicketMessage}
            useChat={useTicketChat}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5, gap: 16 }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: 20, textAlign: 'center', borderBottom: `1px solid ${colors.border}` }}>
               <ThemedText style={{ fontSize: 15, fontWeight: 800 }}>{t('desktop.support_center')}</ThemedText>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={28} />
              </div>
              <ThemedText style={{ fontSize: 14, fontWeight: 700 }}>{t('desktop.select_ticket')}</ThemedText>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && <CreateTicketModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />}
    </div>
  );
}

function CreateTicketModal({ onClose, onCreate }: { onClose: () => void, onCreate: (s: string, d: string) => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const isValid = title.trim() && description.trim();

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 450, backgroundColor: colors.background, borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{t('support.new_ticket')}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}><X size={20} /></button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 10, fontWeight: 900, color: colors.primary, textTransform: 'uppercase' }}>{t('support.ticket_title')}</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              placeholder={t('support.ticket_title_placeholder')}
              style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, outline: 'none', fontSize: 13, fontWeight: 600 }} 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 10, fontWeight: 900, color: colors.primary, textTransform: 'uppercase' }}>{t('support.ticket_description')}</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder={t('support.ticket_description_placeholder')}
              rows={4}
              style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, outline: 'none', resize: 'none', fontSize: 13, lineHeight: 1.5 }} 
            />
          </div>
        </div>
        <div style={{ padding: '0 24px 24px' }}>
          <button 
            disabled={!isValid}
            onClick={() => onCreate(title, description)}
            style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', backgroundColor: isValid ? colors.primary : colors.backgroundSecondary, color: isValid ? '#fff' : colors.textSecondary, fontWeight: 900, cursor: isValid ? 'pointer' : 'default', fontSize: 14 }}
          >
            {t('support.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketDetailView({ ticket, onBack, updateStatus, sendMessage, useChat }: { 
  ticket: Ticket, 
  onBack: () => void, 
  updateStatus: (id: string, s: TicketStatus) => Promise<void>, 
  sendMessage: (id: string, t: string) => Promise<void>, 
  useChat: (id: string) => any 
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isAdmin, firebaseUser } = useCurrentUser();
  const replies = useChat(ticket.id);
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(ticket.id, inputText.trim());
    setInputText('');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: colors.background, height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 16, backgroundColor: colors.card, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}><X size={22} /></button>
        <div style={{ flex: 1 }}>
           <ThemedText style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: colors.text }}>{ticket.title}</ThemedText>
        </div>
        <div style={{ 
          padding: '6px 14px', borderRadius: 10, backgroundColor: STATUS_COLORS[ticket.status] + '15', color: STATUS_COLORS[ticket.status],
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em'
        }}>
          {t(`desktop.actions.${ticket.status}`)}
        </div>
      </div>

      {/* Detail Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} className="custom-scrollbar">
        <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, border: `1px solid ${colors.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
               <div style={{ width: 44, height: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.backgroundSecondary }}>
                  {ticket.userPhoto ? <img src={ticket.userPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 600 }}>{(ticket.userName || 'U')[0]}</div>}
               </div>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <ThemedText style={{ fontSize: 14, fontWeight: 700 }}>{ticket.userName}</ThemedText>
                 <ThemedText style={{ fontSize: 11, opacity: 0.5, fontWeight: 500 }}>{new Date(ticket.createdAt).toLocaleDateString()} • {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</ThemedText>
               </div>
            </div>
            
            <ThemedText style={{ fontSize: 15, lineHeight: 1.7, color: colors.text, whiteSpace: 'pre-wrap', fontWeight: 500 }}>{ticket.description}</ThemedText>

             {isAdmin && (
               <div style={{ display: 'flex', gap: 12, marginTop: 24, paddingTop: 20, borderTop: `1px solid ${colors.border}` }}>
                 {ticket.status === 'open' && (
                   <button 
                    onClick={() => updateStatus(ticket.id, 'in_progress')} 
                    style={{ padding: '10px 20px', borderRadius: 12, backgroundColor: `${colors.primary}10`, color: colors.primary, border: `1px solid ${colors.primary}20`, fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = `${colors.primary}20`}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = `${colors.primary}10`}
                  >
                     <Clock size={18} /> {t('desktop.actions.mark_in_progress')}
                   </button>
                 )}
                 {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                   <button 
                    onClick={() => updateStatus(ticket.id, 'resolved')} 
                    style={{ padding: '10px 20px', borderRadius: 12, backgroundColor: '#34C75910', color: '#34C759', border: '1px solid #34C75920', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#34C75920'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#34C75910'}
                  >
                     <CheckCircle2 size={18} /> {t('desktop.actions.resolve')}
                   </button>
                 )}
                 {ticket.status === 'resolved' && (
                   <button 
                    onClick={() => updateStatus(ticket.id, 'open')} 
                    style={{ padding: '10px 20px', borderRadius: 12, backgroundColor: '#FF950010', color: '#FF9500', border: '1px solid #FF950020', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF950020'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FF950010'}
                  >
                     <RotateCcw size={18} /> {t('desktop.actions.reopen')}
                   </button>
                 )}
               </div>
             )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 20 }}>
             {replies.length === 0 ? (
               <div style={{ padding: 40, textAlign: 'center', opacity: 0.3 }}>
                  <ThemedText style={{ fontWeight: 600, fontSize: 12 }}>{t('support.no_replies')}</ThemedText>
               </div>
             ) : replies.map((msg: any) => {
                const isMe = msg.authorId === firebaseUser?.uid;
                return (
                  <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    <ThemedText style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, marginBottom: 4, marginLeft: 8, marginRight: 8 }}>
                      {msg.isStaff ? t('support.unknown_user') : msg.authorName}
                    </ThemedText>
                    <div style={{ 
                      padding: '12px 18px', 
                      borderRadius: 20, 
                      borderTopRightRadius: isMe ? 4 : 20,
                      borderTopLeftRadius: isMe ? 20 : 4,
                      backgroundColor: isMe ? colors.primary : colors.backgroundSecondary,
                      color: isMe ? '#fff' : colors.text,
                      border: isMe ? 'none' : `1px solid ${colors.border}`,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    }}>
                      <ThemedText style={{ fontSize: 14, color: 'inherit', lineHeight: 1.6, fontWeight: 500 }}>{msg.text}</ThemedText>
                    </div>
                  </div>
                );
             })}
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 10, backgroundColor: colors.card }}>
        <input 
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder={t('support.reply_placeholder')}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          style={{ flex: 1, padding: '10px 16px', borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, outline: 'none', fontSize: 13 }}
        />
        <button 
          onClick={handleSend}
          disabled={!inputText.trim()}
          style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: inputText.trim() ? colors.primary : colors.backgroundSecondary, color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputText.trim() ? 'pointer' : 'default' }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
