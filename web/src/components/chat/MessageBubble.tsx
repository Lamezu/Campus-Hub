import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface MessageBubbleProps {
  message: {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  };
  isOwnMessage: boolean;
}

export default function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  const { colors } = useTheme();
  const chatTheme = colors.chat;
  const settings = colors.chatSettings;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const bubbleStyle = {
    backgroundColor: isOwnMessage ? chatTheme.bubbleOwn : chatTheme.bubbleOther,
    color: isOwnMessage ? chatTheme.textOwn : chatTheme.textOther,
    padding: '12px 16px',
    borderRadius: '18px',
    maxWidth: '80%',
    position: 'relative' as const,
    fontSize: settings.fontSize,
    fontWeight: settings.fontWeight,
    fontStyle: settings.fontStyle,
  };

  const timeStyle = {
    fontSize: '11px',
    color: isOwnMessage ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)',
    textAlign: 'right' as const,
    marginTop: '4px',
  };

  const senderNameStyle = {
    fontSize: '12px',
    color: chatTheme.nameColor,
    marginBottom: '4px',
    marginLeft: '8px',
    fontWeight: '600' as const,
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
      marginBottom: '16px',
      width: '100%'
    }}>
      {!isOwnMessage && (
        <div style={senderNameStyle}>
          {message.senderName}
        </div>
      )}
      
      <div style={bubbleStyle}>
        <div>
          {message.text}
        </div>
        <div style={timeStyle}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}