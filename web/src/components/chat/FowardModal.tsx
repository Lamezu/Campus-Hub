import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import { 
  X, Check, Forward, Search, Lock, Users, 
  MessagesSquare, CodeXml, Folders, CalendarFold, 
  MessageCircleQuestion, type LucideIcon 
} from 'lucide-react';
import { useSystemChannels } from '../../hooks/useSystemChannels';

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
  const { t } = useTranslation();
  const systemChannels = useSystemChannels();
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [loading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Only public channels can receive forwarded messages
  const channels: Channel[] = systemChannels.filter(ch => ch.type !== 'announcement');

  useEffect(() => {
    if (isOpen) {
      setSelectedChannels([]);
      setSearchTerm('');
    }
  }, [isOpen]);

  const getChannelIcon = (channel: Channel) => {
    if (channel.icon && CHANNEL_ICONS[channel.icon]) {
      const IconComponent = CHANNEL_ICONS[channel.icon];
      return <IconComponent size={20} color={colors.text} />;
    }
    if (channel.type === 'private') {
      return <Lock size={20} color={colors.text} />;
    }
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
        <div style={{
          padding: '16px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: 0 }}>
            {t('chat.forward_modal.title')}
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
              <span>{t('chat.forward_modal.message_label')}</span>
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

        {usingMockData && (
          <div style={{
            padding: '8px 16px',
            backgroundColor: colors.warning + '20',
            borderBottom: `1px solid ${colors.border}`,
            fontSize: '12px',
            color: colors.warning,
            textAlign: 'center',
          }}>
            {t('chat.forward_modal.dev_mode')}
          </div>
        )}

        <div style={{ padding: '12px 16px', position: 'relative' }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '28px',
            top: '24px',
            color: colors.textSecondary,
          }} />
          <input
            type="text"
            placeholder={t('chat.forward_modal.search_placeholder')}
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
              {t('chat.forward_modal.select_all')}
            </button>
            <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
              {t('chat.forward_modal.selected_count', { count: selectedChannels.length })}
            </span>
          </div>
        )}

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: colors.textSecondary }}>
              {t('chat.forward_modal.loading')}
            </div>
          ) : filteredChannels.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: colors.textSecondary }}>
              {searchTerm ? t('chat.forward_modal.no_results') : t('chat.forward_modal.no_chats')}
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
                        {t('chat.forward_modal.private')}
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
                    <span>{channel.description || t('common.no_description')}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

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
            {t('common.cancel')}
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
            {t('chat.forward_modal.forward_btn', { count: selectedChannels.length })}
          </button>
        </div>
      </div>
    </div>
  );
}