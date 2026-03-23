import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { CornerDownRight, Copy, Trash2, Forward, Smile, Mic, Bookmark } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import AudioMessage from './AudioMessage';
import type { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  onReply?: (message: Message) => void;
  onDelete?: (message: Message, forEveryone: boolean) => void;
  onForward?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
  onCopy?: (text: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  onAudioReply?: (message: Message) => void;
  onSave?: (message: Message) => void;
}


function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '').slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getLuminance(hex: string): number {
  const h = hex.replace('#', '').slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export default function MessageBubble({
  message,
  isOwnMessage,
  onReply,
  onDelete,
  onForward,
  onReact,
  onCopy,
  onScrollToMessage,
  onAudioReply,
  onSave,
}: MessageBubbleProps) {
  const { colors } = useTheme();
  const chatTheme = colors.chat;
  const settings = colors.chatSettings;

  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [emojiPosition, setEmojiPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const deleteModalRef = useRef<HTMLDivElement>(null);

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const audioAttachment = message.attachments?.find(a => a.type === 'audio');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (deleteModalRef.current && !deleteModalRef.current.contains(event.target as Node)) {
        setShowDeleteModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    const menuWidth = 200;
    const menuHeight = isOwnMessage ? 250 : 200;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = e.clientX;
    let top = e.clientY;

    if (isOwnMessage) {
      left = left - menuWidth - 10;
    }

    if (left + menuWidth > viewportWidth) {
      left = viewportWidth - menuWidth - 10;
    }

    if (left < 10) {
      left = 10;
    }

    if (top + menuHeight > viewportHeight) {
      top = viewportHeight - menuHeight - 10;
    }

    if (top < 10) {
      top = 10;
    }

    setMenuPosition({ left, top });
    setShowMenu(true);
  };

  const handleEmojiButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    const pickerWidth = 320;
    const pickerHeight = 400;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = e.clientX;
    let top = e.clientY;

    if (isOwnMessage) {
      left = left - pickerWidth - 10;
    }

    if (left + pickerWidth > viewportWidth) {
      left = viewportWidth - pickerWidth - 10;
    }

    if (left < 10) {
      left = 10;
    }

    if (top + pickerHeight > viewportHeight) {
      top = viewportHeight - pickerHeight - 10;
    }

    if (top < 10) {
      top = 10;
    }

    setEmojiPosition({ left, top });
    setShowEmojiPicker(true);
    setShowMenu(false);
  };

  const handleEmojiSelect = (emojiData: any) => {
    onReact?.(message, emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleDeleteClick = () => {
    setShowMenu(false);
    setShowDeleteModal(true);
  };

  const handleDeleteOption = (forEveryone: boolean) => {
    onDelete?.(message, forEveryone);
    setShowDeleteModal(false);
  };

  const bubbleBg = isOwnMessage ? chatTheme.bubbleOwn : chatTheme.bubbleOther;
  const bubbleIsLight = getLuminance(bubbleBg) > 0.35;
  const bubbleText = bubbleIsLight ? '#1C1C1E' : '#FFFFFF';

  const chatBgIsLight = getLuminance(chatTheme.background === 'transparent' ? colors.background : chatTheme.background) > 0.35;
  const adaptedNameColor = chatBgIsLight
    ? (getLuminance(chatTheme.nameColor) > 0.5 ? colors.textSecondary : chatTheme.nameColor)
    : (getLuminance(chatTheme.nameColor) < 0.2 ? colors.textSecondary : chatTheme.nameColor);

  const bubbleStyle = {
    backgroundColor: bubbleBg,
    color: bubbleText,
    padding: audioAttachment ? '8px 12px' : '12px 16px',
    borderRadius: '18px',
    maxWidth: '100%',
    position: 'relative' as const,
    fontSize: settings.fontSize,
    fontWeight: settings.fontWeight,
    fontStyle: settings.fontStyle,
    wordBreak: 'break-word' as const,
    overflowWrap: 'break-word' as const,
    cursor: 'context-menu',
  };

  const timeStyle = {
    fontSize: '11px',
    color: hexToRgba(bubbleText, 0.7),
    textAlign: 'right' as const,
    marginTop: '4px',
  };

  const senderNameStyle = {
    fontSize: '12px',
    color: adaptedNameColor,
    marginBottom: '4px',
    marginLeft: '8px',
    fontWeight: '600' as const,
  };

  const menuStyle = {
    position: 'fixed' as const,
    left: `${menuPosition.left}px`,
    top: `${menuPosition.top}px`,
    backgroundColor: colors.background,
    border: `1px solid ${colors.border}`,
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    padding: '8px 0',
    minWidth: '200px',
    zIndex: 1000,
  };

  const menuItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    color: colors.text,
    transition: 'background-color 0.2s',
  };

  const emojiPickerStyle = {
    position: 'fixed' as const,
    left: `${emojiPosition.left}px`,
    top: `${emojiPosition.top}px`,
    zIndex: 1001,
  };

  const deleteModalStyle = {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: colors.background,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
    zIndex: 2000,
    width: '320px',
    maxWidth: '90%',
  };

  const deleteModalOverlayStyle = {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1999,
  };

  const deleteOptionStyle = {
    padding: '16px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500' as const,
    textAlign: 'center' as const,
    transition: 'background-color 0.2s',
  };

  const reactionsContainerStyle = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginTop: '8px',
    justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
  };

  const reactionStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: hexToRgba(bubbleText, 0.12),
    borderRadius: '16px',
    fontSize: '13px',
    cursor: 'pointer',
    color: bubbleText,
  };

  const forwardedStyle = {
    fontSize: '11px',
    color: hexToRgba(bubbleText, 0.65),
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  };

  const replyContainerStyle = {
    marginBottom: '8px',
    maxWidth: '100%',
    backgroundColor: hexToRgba(bubbleText, 0.08),
    borderRadius: '8px',
    padding: '6px 8px',
  };

  const replyStyle = {
    borderLeft: `3px solid ${hexToRgba(bubbleText, 0.6)}`,
    paddingLeft: '8px',
    paddingTop: '2px',
    paddingBottom: '2px',
  };

  const replyNameStyle = {
    color: bubbleText,
    fontWeight: '600',
    fontSize: '11px',
    marginBottom: '2px',
  };

  const replyTextStyle = {
    color: hexToRgba(bubbleText, 0.75),
    fontSize: '12px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    maxWidth: '250px',
  };


  const avatar = (
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      flexShrink: 0,
      alignSelf: 'flex-end',
      overflow: 'hidden',
      backgroundColor: colors.backgroundSecondary,
    }}>
      {message.senderPhoto
        ? <img src={message.senderPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: '600', color: colors.textSecondary,
          }}>
            {message.senderName?.[0]?.toUpperCase() || '?'}
          </div>
      }
    </div>
  );

  return (
    <div
      data-message-id={message.id}
      style={{
        display: 'flex',
        flexDirection: 'row' as const,
        alignItems: 'flex-end',
        justifyContent: isOwnMessage ? 'flex-end' : 'flex-start',
        gap: '8px',
        marginBottom: '16px',
        width: '100%',
        position: 'relative' as const,
      }}
      onContextMenu={handleContextMenu}
    >
      {!isOwnMessage && avatar}

      {isOwnMessage && audioAttachment && onAudioReply && (
        <button
          onClick={(e) => { e.stopPropagation(); onAudioReply(message); }}
          title="Responder con audio"
          style={{
            alignSelf: 'center',
            background: colors.backgroundSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            color: colors.primary,
          }}
        >
          <Mic size={14} />
        </button>
      )}

      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column' as const, alignItems: isOwnMessage ? 'flex-end' : 'flex-start' }}>
      {!isOwnMessage && (
        <div style={senderNameStyle}>
          {message.senderName}
        </div>
      )}
        {message.isForwarded && (
          <div style={forwardedStyle}>
            <Forward size={12} />
            <span>
              Reenviado {message.originalSender && `de ${message.originalSender}`}
            </span>
          </div>
        )}

        <div style={bubbleStyle}>
          {message.replyTo && (
            <div
              style={{ ...replyContainerStyle, cursor: 'pointer' }}
              onClick={() => message.replyTo?.id && onScrollToMessage?.(message.replyTo.id)}
            >
              <div style={replyStyle}>
                <div style={replyNameStyle}>{message.replyTo.senderName}</div>
                <div style={replyTextStyle}>{message.replyTo.text}</div>
              </div>
            </div>
          )}

          {audioAttachment ? (
            <AudioMessage
              url={audioAttachment.url}
              duration={audioAttachment.duration || 0}
              isOwnMessage={isOwnMessage}
            />
          ) : (
            <div>
              {message.text}
            </div>
          )}
          <div style={timeStyle}>
            {formatTimestamp(message.createdAt)}
          </div>
        </div>

        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div style={reactionsContainerStyle}>
            {Object.entries(message.reactions)
              .filter(([_, users]) => users.length > 0)
              .map(([emoji, users]) => (
                <div
                  key={emoji}
                  style={reactionStyle}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReact?.(message, emoji);
                  }}
                >
                  <span>{emoji}</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{users.length}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {!isOwnMessage && audioAttachment && onAudioReply && (
        <button
          onClick={(e) => { e.stopPropagation(); onAudioReply(message); }}
          title="Responder con audio"
          style={{
            alignSelf: 'center',
            background: colors.backgroundSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: '50%',
            width: '30px',
            height: '30px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            color: colors.primary,
          }}
        >
          <Mic size={14} />
        </button>
      )}

      {isOwnMessage && avatar}

      {showMenu && (
        <div ref={menuRef} style={menuStyle}>
          <div
            style={menuItemStyle}
            onClick={() => {
              onReply?.(message);
              setShowMenu(false);
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <CornerDownRight size={16} color={colors.primary} />
            <span>Responder</span>
          </div>

          <div
            style={menuItemStyle}
            onClick={handleEmojiButtonClick}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Smile size={16} color={colors.warning} />
            <span>Reaccionar</span>
          </div>

          <div
            style={menuItemStyle}
            onClick={() => {
              onCopy?.(message.text);
              setShowMenu(false);
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Copy size={16} color={colors.textSecondary} />
            <span>Copiar</span>
          </div>

          <div
            style={menuItemStyle}
            onClick={() => {
              onSave?.(message);
              setShowMenu(false);
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Bookmark size={16} color={colors.primary} />
            <span>Guardar mensaje</span>
          </div>

          {isOwnMessage && (
            <div
              style={menuItemStyle}
              onClick={() => {
                onForward?.(message);
                setShowMenu(false);
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Forward size={16} color={colors.success} />
              <span>Reenviar</span>
            </div>
          )}

          <div
            style={{ ...menuItemStyle, color: colors.danger }}
            onClick={handleDeleteClick}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Trash2 size={16} color={colors.danger} />
            <span>{isOwnMessage ? 'Eliminar' : 'Eliminar para mí'}</span>
          </div>
        </div>
      )}

      {showEmojiPicker && (
        <div ref={emojiPickerRef} style={emojiPickerStyle}>
          <EmojiPicker
            onEmojiClick={handleEmojiSelect}
            autoFocusSearch={false}
            width={320}
            height={400}
            searchPlaceholder="Buscar emoji..."
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {showDeleteModal && (
        <>
          <div style={deleteModalOverlayStyle} />
          <div ref={deleteModalRef} style={deleteModalStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, marginBottom: '16px', textAlign: 'center' }}>
              Eliminar mensaje
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => handleDeleteOption(false)}
                style={{
                  ...deleteOptionStyle,
                  backgroundColor: colors.backgroundSecondary,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
              >
                Eliminar para mí
              </button>

              {isOwnMessage && (
                <button
                  onClick={() => handleDeleteOption(true)}
                  style={{
                    ...deleteOptionStyle,
                    backgroundColor: colors.danger,
                    color: '#FFF',
                    border: 'none',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Eliminar para todos
                </button>
              )}

              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  ...deleteOptionStyle,
                  backgroundColor: 'transparent',
                  color: colors.textSecondary,
                  border: 'none',
                  marginTop: '8px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
