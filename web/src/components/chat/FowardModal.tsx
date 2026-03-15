import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  X, Check, Forward, Search, Lock, Users, 
  MessagesSquare, CodeXml, Folders, CalendarFold, 
  MessageCircleQuestion, type LucideIcon 
} from 'lucide-react';
import { MOCK_CHANNELS } from '../../constants/mockData';

// Mapeo de strings a componentes de iconos
const CHANNEL_ICONS: Record<string, LucideIcon> = {
  'messages-square': MessagesSquare,
  'code-xml': CodeXml,
  'folders': Folders,
  'calendar-fold': CalendarFold,
  'message-circle-question': MessageCircleQuestion,
};

interface Channel {
  id: string;
  name: string;
  description: string;
  icon?: string;
  type: string;
  memberCount?: number;
  lastMessageAt?: string;
}

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForward: (selectedChannels: string[]) => void;
  message: any;
}

export default function ForwardModal({ isOpen, onClose, onForward, message }: ForwardModalProps) {
  const { colors } = useTheme();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    const loadChannels = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        setLoading(true);
        
        const channelsRef = collection(db, 'channels');
        const publicQuery = query(channelsRef, where('type', '==', 'public'));
        const snapshot = await getDocs(publicQuery);
        
        if (!snapshot.empty) {
          const channelsData: Channel[] = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            channelsData.push({
              id: doc.id,
              name: data.name || 'Sin nombre',
              description: data.description || '',
              icon: data.icon || '💬',
              type: data.type || 'public',
              memberCount: data.memberCount || 0,
              lastMessageAt: data.lastMessageAt
            });
          });
          setChannels(channelsData);
          setUsingMockData(false);
        } else {
          console.log('No hay canales en Firestore, usando MOCK_CHANNELS');
          const mockChannels: Channel[] = MOCK_CHANNELS.map(ch => ({
            id: ch.id,
            name: ch.name,
            description: ch.description,
            icon: ch.icon || '💬',
            type: ch.type,
            memberCount: ch.memberCount,
            lastMessageAt: ch.lastMessageAt || undefined
          }));
          setChannels(mockChannels);
          setUsingMockData(true);
        }
      } catch (error) {
        console.error('Error loading channels:', error);
        const mockChannels: Channel[] = MOCK_CHANNELS.map(ch => ({
          id: ch.id,
          name: ch.name,
          description: ch.description,
          icon: ch.icon || '💬',
          type: ch.type,
          memberCount: ch.memberCount,
          lastMessageAt: ch.lastMessageAt || undefined
        }));
        setChannels(mockChannels);
        setUsingMockData(true);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadChannels();
      setSelectedChannels([]);
      setSearchTerm('');
    }
  }, [isOpen]);

  const getChannelIcon = (channel: Channel) => {
    // Si hay un icono específico en el mapeo, usarlo
    if (channel.icon && CHANNEL_ICONS[channel.icon]) {
      const IconComponent = CHANNEL_ICONS[channel.icon];
      return <IconComponent size={20} color={colors.text} />;
    }
    
    // Si es un canal privado, usar Lock
    if (channel.type === 'private') {
      return <Lock size={20} color={colors.text} />;
    }
    
    // Por defecto, usar Hash
    return <Search size={20} color={colors.text} />;
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  const toggleAll = () => {
    if (selectedChannels.length === filteredChannels.length) {
      setSelectedChannels([]);
    } else {
      setSelectedChannels(filteredChannels.map(c => c.id));
    }
  };

  const handleForward = () => {
    if (selectedChannels.length > 0) {
      onForward(selectedChannels);
      onClose();
    }
  };

  const filteredChannels = channels.filter(channel =>
    channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    channel.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        backgroundColor: colors.background,
        borderRadius: '16px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: 0 }}>
            Reenviar mensaje
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Vista previa del mensaje */}
        {message && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: colors.backgroundSecondary,
            borderBottom: `1px solid ${colors.border}`,
          }}>
            <div style={{
              fontSize: '13px',
              color: colors.textSecondary,
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Forward size={14} />
              <span>Mensaje a reenviar:</span>
            </div>
            <div style={{
              fontSize: '14px',
              color: colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {message.text}
            </div>
          </div>
        )}

        {/* Indicador de modo desarrollo */}
        {usingMockData && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: colors.warning + '20',
            borderBottom: `1px solid ${colors.border}`,
            fontSize: '12px',
            color: colors.warning,
            textAlign: 'center',
          }}>
            Modo desarrollo - Usando datos de ejemplo
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '12px 16px', position: 'relative' }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '28px',
            top: '24px',
            color: colors.textSecondary,
          }} />
          <input
            type="text"
            placeholder="Buscar chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        {/* Select All */}
        {filteredChannels.length > 0 && (
          <div style={{
            padding: '8px 16px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <button
              onClick={toggleAll}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: colors.primary,
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: `2px solid ${colors.primary}`,
                backgroundColor: selectedChannels.length === filteredChannels.length ? colors.primary : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {selectedChannels.length === filteredChannels.length && (
                  <Check size={14} color="#FFF" />
                )}
              </div>
              Seleccionar todos
            </button>
            <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
              ({selectedChannels.length} seleccionados)
            </span>
          </div>
        )}

        {/* Channels List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: colors.textSecondary }}>
              Cargando chats...
            </div>
          ) : filteredChannels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: colors.textSecondary }}>
              {searchTerm ? 'No se encontraron chats' : 'No hay chats disponibles'}
            </div>
          ) : (
            filteredChannels.map((channel) => (
              <div
                key={channel.id}
                onClick={() => toggleChannel(channel.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  backgroundColor: selectedChannels.includes(channel.id) ? colors.backgroundSecondary : 'transparent',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => !selectedChannels.includes(channel.id) && (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                onMouseLeave={(e) => !selectedChannels.includes(channel.id) && (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: `2px solid ${colors.primary}`,
                  backgroundColor: selectedChannels.includes(channel.id) ? colors.primary : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {selectedChannels.includes(channel.id) && (
                    <Check size={14} color="#FFF" />
                  )}
                </div>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '20px',
                  backgroundColor: colors.backgroundSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {getChannelIcon(channel)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: '15px', 
                    fontWeight: '500', 
                    color: colors.text, 
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {channel.name}
                    {channel.type === 'private' && (
                      <span style={{
                        fontSize: '11px',
                        backgroundColor: colors.backgroundSecondary,
                        padding: '2px 6px',
                        borderRadius: '10px',
                        color: colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}>
                        <Lock size={10} />
                        Privado
                      </span>
                    )}
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    color: colors.textSecondary, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <Users size={12} />
                    <span>{channel.description || 'Sin descripción'}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              backgroundColor: 'transparent',
              color: colors.text,
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleForward}
            disabled={selectedChannels.length === 0}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: colors.primary,
              color: '#FFF',
              fontSize: '14px',
              fontWeight: '500',
              cursor: selectedChannels.length === 0 ? 'not-allowed' : 'pointer',
              opacity: selectedChannels.length === 0 ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Forward size={16} />
            Reenviar ({selectedChannels.length})
          </button>
        </div>
      </div>
    </div>
  );
}