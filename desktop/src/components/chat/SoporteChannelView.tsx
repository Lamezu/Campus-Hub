import React, { useState, useMemo } from 'react';
import { 
  Heart, MessageSquare, Clock, CheckCircle2, 
  Send, Plus, X, ArrowLeft, Loader2,
  Calendar, User, AlertCircle, RefreshCw
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTickets, type Ticket, type TicketStatus } from '@/hooks/useTickets';
import { useCurrentUser } from '@/contexts/UserContext';
import { ThemedText } from '@/components/themed-text';

const STATUS_LABELS: Record<TicketStatus, string> = {
  'open': 'Abierto',
  'in_progress': 'En curso',
  'resolved': 'Resuelto'
};

const STATUS_COLORS: Record<TicketStatus, string> = {
  'open': '#FF9500',
  'in_progress': '#007AFF',
  'resolved': '#34C759'
};

export function SoporteChannelView() {
  const { colors } = useTheme();
  const { tickets, loading, createTicket, updateTicketStatus, sendTicketMessage, useTicketChat } = useTickets();
  const { firebaseUser, isAdmin } = useCurrentUser();
  
  const [activeTab, setActiveTab] = useState<'all' | TicketStatus>('all');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Derive selectedTicket from the fresh tickets array
  const selectedTicket = useMemo(() => 
    tickets.find(t => t.id === selectedTicketId),
    [tickets, selectedTicketId]
  );

  const filteredTickets = tickets.filter(t => activeTab === 'all' || t.status === activeTab);

  const handleCreate = async (title: string, description: string) => {
    await createTicket(title, description);
    setShowCreateModal(false);
  };

  if (selectedTicket) {
    return (
      <TicketDetailView 
        ticket={selectedTicket} 
        onBack={() => setSelectedTicketId(null)}
        updateStatus={updateTicketStatus}
        sendMessage={sendTicketMessage}
        useChat={useTicketChat}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: colors.background, position: 'relative', height: '100%' }}>
      {/* Category Chips */}
      <div style={{ 
        padding: '16px 20px', 
        display: 'flex', 
        justifyContent: 'center',
        gap: 10, 
        overflowX: 'auto', 
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        backdropFilter: 'blur(10px)',
        zIndex: 5
      }} className="hide-scrollbar">
        {(['all', 'open', 'in_progress', 'resolved'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 20px',
              borderRadius: 20,
              border: 'none',
              backgroundColor: activeTab === tab ? colors.primary : colors.backgroundSecondary,
              color: activeTab === tab ? '#fff' : colors.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {tab === 'all' ? 'Todos' : STATUS_LABELS[tab as TicketStatus]}
            <span style={{ marginLeft: 8, opacity: 0.6 }}>
              {tickets.filter(t => tab === 'all' || t.status === tab).length}
            </span>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }} className="custom-scrollbar">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}><Loader2 className="animate-spin" size={32} color={colors.primary} /></div>
        ) : filteredTickets.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', opacity: 0.5, gap: 16 }}>
            <AlertCircle size={64} color={colors.textSecondary} />
            <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>No hay tickets en esta categoría</ThemedText>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
            gap: 20, 
            maxWidth: 1200, 
            margin: '0 auto', 
            width: '100%' 
          }}>
            {filteredTickets.map(ticket => (
              <div 
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 24,
                  padding: 24,
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                   <div style={{ 
                    padding: '4px 10px', 
                    borderRadius: 8, 
                    backgroundColor: STATUS_COLORS[ticket.status] + '15', 
                    color: STATUS_COLORS[ticket.status],
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: STATUS_COLORS[ticket.status] }} />
                    {STATUS_LABELS[ticket.status]}
                  </div>
                  <div />
                </div>

                <div>
                  <ThemedText style={{ 
                    fontSize: 18, 
                    fontWeight: 900, 
                    color: colors.text, 
                    marginBottom: 8,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'block'
                  }}>
                    {ticket.title}
                  </ThemedText>
                  <ThemedText style={{ 
                    fontSize: 14, 
                    color: colors.textSecondary, 
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  } as any}>
                    {ticket.description}
                  </ThemedText>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${colors.border}40` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.backgroundSecondary }}>
                      {ticket.userPhoto ? <img src={ticket.userPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: colors.textSecondary }}>{(ticket.userName || 'U')[0]}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <ThemedText style={{ fontSize: 13, fontWeight: 800 }}>{ticket.userName}</ThemedText>
                      <ThemedText style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{new Date(ticket.createdAt).toLocaleDateString()} · {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</ThemedText>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB Overlay */}
      <button 
        onClick={() => setShowCreateModal(true)}
        style={{
          position: 'absolute',
          bottom: 30,
          right: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 24px',
          borderRadius: 24,
          backgroundColor: colors.primary,
          color: '#fff',
          border: 'none',
          boxShadow: `0 8px 16px ${colors.primary}40`,
          cursor: 'pointer',
          transition: 'transform 0.2s',
          zIndex: 100
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Plus size={20} />
        <span style={{ fontSize: 14, fontWeight: 800 }}>Nuevo ticket</span>
      </button>

      {showCreateModal && <CreateTicketModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />}
    </div>
  );
}

function CreateTicketModal({ onClose, onCreate }: { onClose: () => void, onCreate: (s: string, d: string) => void }) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const isValid = title.trim() && description.trim();

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 500, backgroundColor: colors.background, borderRadius: 28, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '24px 32px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Crear nuevo ticket</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}><X size={24} /></button>
        </div>
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 900, color: colors.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asunto de la incidencia</label>
            <input 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Problema con el campus virtual"
              style={{ padding: '16px 20px', borderRadius: 16, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, outline: 'none', fontSize: 14, fontWeight: 600 }} 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 900, color: colors.primary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descripción detallada</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Explica qué sucede con el mayor detalle posible..."
              rows={5}
              style={{ padding: '16px 20px', borderRadius: 16, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, outline: 'none', resize: 'none', fontSize: 14, lineHeight: 1.6 }} 
            />
          </div>
        </div>
        <div style={{ padding: '0 32px 32px' }}>
          <button 
            disabled={!isValid}
            onClick={() => onCreate(title, description)}
            style={{ width: '100%', padding: '18px', borderRadius: 18, border: 'none', backgroundColor: isValid ? colors.primary : colors.backgroundSecondary, color: isValid ? '#fff' : colors.textSecondary, fontWeight: 900, cursor: isValid ? 'pointer' : 'default', fontSize: 15, transition: 'all 0.2s' }}
          >
            Enviar solicitud de soporte
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
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 16, backgroundColor: colors.card, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}><ArrowLeft size={24} /></button>
        <div style={{ flex: 1 }}>
           <ThemedText style={{ fontSize: 16, fontWeight: 900 }}>{ticket.title}</ThemedText>
        </div>
        <div style={{ 
          padding: '6px 14px', borderRadius: 10, backgroundColor: STATUS_COLORS[ticket.status] + '15', color: STATUS_COLORS[ticket.status],
          fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em'
        }}>
          {STATUS_LABELS[ticket.status]}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }} className="custom-scrollbar">
        <div style={{ maxWidth: 900, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Main Info Card */}
          <div style={{ backgroundColor: colors.backgroundSecondary, borderRadius: 28, padding: 32, border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
               <div style={{ width: 44, height: 44, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.card }}>
                  {ticket.userPhoto ? <img src={ticket.userPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>{(ticket.userName || 'U')[0]}</div>}
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                 <ThemedText style={{ fontSize: 16, fontWeight: 800 }}>Creado por {ticket.userName}</ThemedText>
                 <ThemedText style={{ fontSize: 12, opacity: 0.5 }}>{new Date(ticket.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · {new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</ThemedText>
               </div>
            </div>
            
            <ThemedText style={{ fontSize: 12, fontWeight: 900, color: colors.primary, textTransform: 'uppercase', marginBottom: 16, display: 'block', letterSpacing: '0.05em' }}>Descripción del problema</ThemedText>
            <ThemedText style={{ 
              fontSize: 16, 
              lineHeight: 1.7, 
              color: colors.text, 
              fontWeight: 500, 
              display: 'block', 
              paddingBottom: 8,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word'
            }}>{ticket.description}</ThemedText>

            {/* Admin Actions */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 32, paddingTop: 24, borderTop: `1px solid ${colors.border}` }}>
              {ticket.status === 'open' && (
                <>
                  <button onClick={() => updateStatus(ticket.id, 'in_progress')} style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', borderRadius: 16, backgroundColor: colors.primary + '15', color: colors.primary, border: 'none', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <Clock size={18} /> Iniciar atención
                  </button>
                  <button onClick={() => updateStatus(ticket.id, 'resolved')} style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', borderRadius: 16, backgroundColor: '#34C75915', color: '#34C759', border: 'none', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <CheckCircle2 size={18} /> Resolver ticket
                  </button>
                </>
              )}
              {ticket.status === 'in_progress' && (
                <button onClick={() => updateStatus(ticket.id, 'resolved')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', borderRadius: 16, backgroundColor: '#34C75915', color: '#34C759', border: 'none', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                  <CheckCircle2 size={18} /> Finalizar y resolver
                </button>
              )}
              {ticket.status === 'resolved' && (
                <>
                  <button onClick={() => updateStatus(ticket.id, 'in_progress')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', borderRadius: 16, backgroundColor: colors.primary + '15', color: colors.primary, border: 'none', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <Clock size={16} /> Reabrir en curso
                  </button>
                  <button onClick={() => updateStatus(ticket.id, 'open')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', borderRadius: 16, backgroundColor: '#FF950015', color: '#FF9500', border: 'none', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}>
                    <RefreshCw size={16} /> Resetear a abierto
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Conversation Chat */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
             <ThemedText style={{ fontSize: 13, fontWeight: 900, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conversación ({replies.length})</ThemedText>
             {replies.length === 0 ? (
               <div style={{ padding: 40, textAlign: 'center', opacity: 0.4 }}>
                  <MessageSquare size={48} style={{ margin: '0 auto 16px' }} />
                  <ThemedText style={{ fontWeight: 600 }}>Aún no hay respuestas en este ticket.</ThemedText>
               </div>
             ) : replies.map((msg: any) => {
                const isMe = msg.authorId === firebaseUser?.uid;
                const isOwner = msg.authorId === ticket.userId;
                const displayName = isOwner ? msg.authorName : (msg.isStaff ? 'Staff' : msg.authorName);

                return (
                  <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <div style={{ 
                      padding: '16px 20px', 
                      borderRadius: 20, 
                      backgroundColor: isMe ? colors.primary : colors.card,
                      color: isMe ? '#fff' : colors.text,
                      border: isMe ? 'none' : `1px solid ${colors.border}`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                      overflowWrap: 'break-word'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.8 }}>
                          <ThemedText style={{ fontSize: 12, fontWeight: 900, color: 'inherit' }}>{displayName}</ThemedText>
                          {(msg.isStaff && !isOwner) && <div style={{ padding: '2px 6px', borderRadius: 4, backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : colors.primary + '20', color: isMe ? '#fff' : colors.primary, fontSize: 8, fontWeight: 900 }}>EQUIPO SOPORTE</div>}
                        </div>
                        <ThemedText style={{ fontSize: 15, color: 'inherit', lineHeight: 1.5, fontWeight: 500, whiteSpace: 'pre-wrap' }}>{msg.text}</ThemedText>
                        <ThemedText style={{ 
                          fontSize: 10, 
                          marginTop: 4, 
                          opacity: 0.5, 
                          textAlign: 'right', 
                          color: 'inherit', 
                          fontWeight: 700,
                          display: 'block'
                        }}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </ThemedText>
                      </div>
                    </div>
                 </div>
               );
             })}
          </div>
        </div>
      </div>

      {/* Message Input */}
      <div style={{ padding: '16px 20px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 12, backgroundColor: colors.card, zIndex: 10 }}>
        <input 
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Escribe tu respuesta aquí..."
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          style={{ flex: 1, padding: '16px 20px', borderRadius: 16, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, outline: 'none', fontSize: 14, fontWeight: 600 }}
        />
        <button 
          onClick={handleSend}
          disabled={!inputText.trim()}
          style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: inputText.trim() ? colors.primary : colors.backgroundSecondary, color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputText.trim() ? 'pointer' : 'default', transition: 'all 0.2s', boxShadow: inputText.trim() ? `0 4px 12px ${colors.primary}40` : 'none' }}
        >
          <Send size={22} />
        </button>
      </div>
    </div>
  );
}
