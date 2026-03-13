import React, { useRef, useState, useEffect } from 'react';
import { Reply, Play, Pause, Mic, Heart, MoreHorizontal, Smile, Trash2, Forward, X } from 'lucide-react';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from './themed-text';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  currentUserId?: string;
  onReply: (msg: Message) => void;
  onLongPress: (msg: Message) => void;
  onDoubleTap?: () => void;
  onQuickAudioReply?: (msg: Message) => void;
  onReplyPreviewPress?: (messageId: string) => void;
  highlighted?: boolean;
}

function formatAudioTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function AudioBubble({
  url,
  duration,
  bubbleBg,
  textColor,
  senderPhoto,
  senderName,
}: {
  url: string;
  duration: number;
  bubbleBg: string;
  textColor: string;
  senderPhoto?: string | null;
  senderName?: string;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          const p = audioRef.current.currentTime / audioRef.current.duration;
          setProgress(p);
          setCurrentSeconds(Math.max(0, Math.ceil(audioRef.current.duration - audioRef.current.currentTime)));
        }
      };
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setProgress(0);
        setCurrentSeconds(duration);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const WAVE_BARS = [4, 8, 12, 7, 14, 6, 11, 9, 13, 5, 10, 7, 12, 5];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200, padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={togglePlay}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: textColor,
          }}
        >
          {isPlaying ? <Pause size={18} fill={textColor} /> : <Play size={18} fill={textColor} />}
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 24, gap: 2 }}>
          {WAVE_BARS.map((h, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: h,
                borderRadius: 2,
                backgroundColor: (i / WAVE_BARS.length) < progress ? textColor : `${textColor}55`,
              }}
            />
          ))}
        </div>

        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {senderPhoto ? (
            <img src={senderPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          ) : (
            <ThemedText style={{ fontSize: 12, color: textColor }}>{senderName?.[0]?.toUpperCase()}</ThemedText>
          )}
        </div>
      </div>
      <ThemedText style={{ fontSize: 10, color: `${textColor}AA`, marginLeft: 48 }}>
        {formatAudioTime(currentSeconds)}
      </ThemedText>
    </div>
  );
}

export function MessageBubble({
  message,
  isOwnMessage,
  currentUserId,
  onReply,
  onLongPress,
  onDoubleTap,
  onQuickAudioReply,
  onReplyPreviewPress,
  highlighted,
  onDelete,
  onReact,
}: MessageBubbleProps & { onDelete?: (id: string, all: boolean) => void; onReact?: (id: string, emoji: string) => void }) {
  const { colors } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const chatTheme = colors.chat;
  const settings = colors.chatSettings;

  useEffect(() => {
    const saved = localStorage.getItem('recent_emojis');
    if (saved) setRecentEmojis(JSON.parse(saved));
    else setRecentEmojis(['❤️', '😂', '😮', '😢', '🔥', '👍']);
  }, []);

  if (currentUserId && message.deletedForUsers?.includes(currentUserId)) return null;

  const audioAttachment = message.attachments?.find(a => a.type === 'audio');
  const bubbleBg = isOwnMessage ? chatTheme.bubbleOwn : chatTheme.bubbleOther;
  const textColor = isOwnMessage ? chatTheme.textOwn : chatTheme.textOther;
  const timeColor = `${textColor}99`;
  const allReactions = Object.entries(message.reactions ?? {}).filter(([, users]) => (users as string[]).length > 0);

  const EMOJI_CATEGORIES = [
    { name: 'Populares', emojis: ['❤️', '😂', '😮', '😢', '🔥', '👍', '🙏', '✨', '💯', '🎉'] },
    { name: 'Caras', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🫣', '🫢', '🫡', '🫠', '🫠'] },
    { name: 'Gente', emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '🫱', '🫲', '🫸', '🫷', '🫄', '🫅', '🫃'] },
    { name: 'Gestos', emojis: ['👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🫱', '🤝', '🙏', '✍️', '💅', '🤳', '💪'] },
    { name: 'Corazones', emojis: ['💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍'] },
  ];

  const handleEmojiSelect = (emoji: string) => {
    if (onReact) onReact(message.id, emoji);
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 10);
    setRecentEmojis(updated);
    localStorage.setItem('recent_emojis', JSON.stringify(updated));
    setShowReactionPicker(false);
    setShowFullEmojiPicker(false);
  };

  const handleDoubleClick = () => {
    onDoubleTap?.();
  };

  const handleDelete = (all: boolean) => {
    if (onDelete) onDelete(message.id, all);
    setShowDeleteModal(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
        marginBottom: spacing.sm,
        padding: `0 ${spacing.md}px`,
        position: 'relative',
      }}
    >
      {!isOwnMessage && (
        <ThemedText style={{ fontSize: 12, color: chatTheme.nameColor, marginBottom: 2, marginLeft: 8 }}>
          {message.senderName}
        </ThemedText>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '85%', flexDirection: isOwnMessage ? 'row-reverse' : 'row' }}>
        <div
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => { e.preventDefault(); onLongPress(message); }}
          style={{
            backgroundColor: bubbleBg,
            padding: `${spacing.xs + 4}px ${spacing.md}px`,
            borderRadius: 20,
            borderBottomRightRadius: isOwnMessage ? 4 : 20,
            borderBottomLeftRadius: isOwnMessage ? 20 : 4,
            transition: 'transform 0.1s, background-color 0.2s',
            cursor: 'default',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            animation: highlighted ? 'highlight-fade 2s ease-out' : 'none',
            position: 'relative',
          }}
        >
          {/* Reply Preview */}
          {message.replyTo && (
            <div
              onClick={() => onReplyPreviewPress?.(message.replyTo!.id)}
              style={{
                borderLeft: `3px solid ${colors.primary}`,
                backgroundColor: 'rgba(0,0,0,0.08)',
                borderRadius: 6,
                padding: '4px 8px',
                marginBottom: spacing.xs,
                cursor: 'pointer',
                maxWidth: '100%',
              }}
            >
              <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: colors.primary, display: 'block' }}>
                {message.replyTo.senderName}
              </ThemedText>
              <ThemedText style={{ 
                fontSize: 11, 
                color: textColor, 
                opacity: 0.8, 
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 100
              }}>
                {message.replyTo.isAudio ? '🎤 Mensaje de voz' : message.replyTo.text}
              </ThemedText>
            </div>
          )}

          {audioAttachment ? (
            <AudioBubble
              url={audioAttachment.url}
              duration={audioAttachment.duration ?? 0}
              bubbleBg={bubbleBg}
              textColor={textColor}
              senderPhoto={message.senderPhoto}
              senderName={message.senderName}
            />
          ) : (
            <ThemedText
              style={{
                color: textColor,
                fontSize: settings.fontSize,
                fontWeight: settings.fontWeight,
                fontStyle: settings.fontStyle,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message.text}
            </ThemedText>
          )}

          <ThemedText style={{ fontSize: 10, color: timeColor, textAlign: 'right', display: 'block', marginTop: 2 }}>
            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </ThemedText>
        </div>

        {/* Actions Button (3 dots) */}
        <div 
          className="message-actions-trigger" 
          style={{ 
            opacity: showMenu || showReactionPicker ? 1 : 0, 
            transition: 'opacity 0.2s',
            pointerEvents: 'auto',
            position: 'relative'
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); setShowReactionPicker(false); }}
            style={{ 
              padding: 6, 
              borderRadius: '50%', 
              border: 'none', 
              backgroundColor: colors.card, 
              cursor: 'pointer', 
              color: colors.textSecondary,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <MoreHorizontal size={18} />
          </button>
          
          {showMenu && (
            <>
              <div 
                onClick={() => setShowMenu(false)} 
                style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
              />
              <div style={{
                position: 'absolute',
                bottom: '100%',
                [isOwnMessage ? 'right' : 'left']: 0,
                backgroundColor: colors.card,
                borderRadius: 12,
                padding: 6,
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 999,
                minWidth: 150,
                border: `1px solid ${colors.border}`,
                marginBottom: 12,
                animation: 'slideUp 0.15s ease-out'
              }}>
                <button onClick={() => { onReply(message); setShowMenu(false); }} style={menuItemStyle(colors)}>
                  <Reply size={14} /> Responder
                </button>
                <button 
                  onClick={() => { 
                    setShowReactionPicker(true);
                    setShowMenu(false);
                  }} 
                  style={menuItemStyle(colors)}
                >
                  <Smile size={14} /> Reaccionar
                </button>
                <button style={menuItemStyle(colors)}>
                  <Forward size={14} /> Reenviar
                </button>
                <div style={{ height: 1, backgroundColor: colors.border, margin: '4px 8px' }} />
                <button 
                  onClick={() => {
                    setShowDeleteModal(true);
                    setShowMenu(false);
                  }} 
                  style={{ ...menuItemStyle(colors), color: colors.danger }}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            </>
          )}

          {showReactionPicker && (
            <>
              <div 
                onClick={() => setShowReactionPicker(false)} 
                style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
              />
              <div style={{
                position: 'absolute',
                bottom: '100%',
                [isOwnMessage ? 'right' : 'left']: 0,
                backgroundColor: colors.card,
                borderRadius: 24,
                padding: '4px 8px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                zIndex: 999,
                border: `1px solid ${colors.border}`,
                marginBottom: 12,
                animation: 'slideUp 0.15s ease-out'
              }}>
                {recentEmojis.slice(0, 6).map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiSelect(emoji)}
                    style={{
                      fontSize: 20,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 4,
                      borderRadius: '50%',
                      transition: 'transform 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowFullEmojiPicker(true);
                    setShowReactionPicker(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: colors.backgroundSecondary,
                    cursor: 'pointer',
                    color: colors.textSecondary
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Quick Audio Reply Button */}
        {audioAttachment && onQuickAudioReply && !isOwnMessage && (
           <button
            onClick={() => onQuickAudioReply(message)}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: 'none',
              backgroundColor: colors.card, color: colors.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            <Mic size={18} />
          </button>
        )}
      </div>

      {allReactions.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4,
          alignSelf: isOwnMessage ? 'flex-end' : 'flex-start'
        }}>
          {allReactions.map(([emoji, users]) => (
            <div 
              key={emoji} 
              onClick={() => onReact?.(message.id, emoji)}
              style={{
                backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 12,
                padding: '2px 8px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                cursor: 'pointer', transition: 'transform 0.1s',
                color: chatTheme.isDark ? '#FFFFFF' : '#1C1C1E'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <span>{emoji}</span>
              <span style={{ opacity: 0.7 }}>{(users as string[]).length}</span>
            </div>
          ))}
        </div>
      )}

      {/* Full Emoji Picker Modal */}
      {showFullEmojiPicker && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2100,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: colors.card,
            borderRadius: 24,
            width: 400,
            maxHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 48px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <ThemedText style={{ fontSize: 18, fontWeight: 'bold' }}>Reaccionar</ThemedText>
              <button onClick={() => setShowFullEmojiPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {EMOJI_CATEGORIES.map(cat => (
                <div key={cat.name} style={{ marginBottom: 20 }}>
                  <ThemedText style={{ fontSize: 12, fontWeight: 'bold', opacity: 0.5, display: 'block', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>{cat.name}</ThemedText>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                    {cat.emojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiSelect(emoji)}
                        style={{
                          fontSize: 24,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 8,
                          borderRadius: 12,
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.backgroundColor = colors.backgroundSecondary;
                          e.currentTarget.style.transform = 'scale(1.2)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{ backgroundColor: colors.card, borderRadius: 20, padding: spacing.xl, width: 350, textAlign: 'center' }}>
            <Trash2 size={48} color={colors.danger} style={{ margin: '0 auto 16px' }} />
            <ThemedText style={{ fontSize: 20, fontWeight: 'bold', display: 'block', marginBottom: 8 }}>¿Eliminar mensaje?</ThemedText>
            <ThemedText style={{ fontSize: 14, opacity: 0.6, display: 'block', marginBottom: spacing.xl }}>
              Esta acción no se puede deshacer.
            </ThemedText>

            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              <button
                onClick={() => handleDelete(false)}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, backgroundColor: colors.backgroundSecondary,
                  color: colors.text, border: 'none', fontWeight: 'bold', cursor: 'pointer'
                }}
              >
                Eliminar para mí
              </button>
              
              <button
                onClick={() => handleDelete(true)}
                disabled={!isOwnMessage}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, 
                  backgroundColor: isOwnMessage ? colors.danger : colors.border,
                  color: isOwnMessage ? '#FFF' : colors.textSecondary, 
                  border: 'none', fontWeight: 'bold', 
                  cursor: isOwnMessage ? 'pointer' : 'not-allowed',
                  opacity: isOwnMessage ? 1 : 0.5
                }}
              >
                Eliminar para todos
              </button>

              <button 
                onClick={() => setShowDeleteModal(false)} 
                style={{ width: '100%', padding: '12px', background: 'transparent', border: 'none', color: colors.text, opacity: 0.6, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .message-actions-trigger { display: flex; align-items: center; }
        div:hover > .message-actions-trigger { opacity: 1 !important; }
        @keyframes highlight-fade {
          from { background-color: rgba(100, 180, 255, 0.4); }
          to { background-color: transparent; }
        }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const menuItemStyle = (colors: any): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  backgroundColor: 'transparent',
  color: colors.text,
  fontSize: 13,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background-color 0.15s',
  whiteSpace: 'nowrap',
});
