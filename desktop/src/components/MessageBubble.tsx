import React, { useRef, useState, useEffect } from 'react';
import { Reply, Play, Pause, MoreHorizontal, Smile, Trash2, Forward, X, Bookmark, Maximize2, Plus, Star, ChevronRight, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { spacing } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from './themed-text';
import { toggleSaveMessage, isMessageSaved } from '@/services/savedItemsService';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  currentUserId?: string;
  onReply: (msg: Message) => void;
  onLongPress: (msg: Message) => void;
  onDoubleTap?: () => void;
  onReplyPreviewPress?: (messageId: string) => void;
  onForward?: (msg: Message) => void;
  onVotePoll?: (optionId: string) => void;
  highlighted?: boolean;
  channelId?: string;
  isDM?: boolean;
  participantId?: string;
  searchQuery?: string;
  backgroundActive?: boolean;
  isStarred?: boolean;
  onToggleStar?: (msg: Message) => void;
  isGroup?: boolean;
  isSystem?: boolean;
}

const HighlightText = ({ text, query, colors }: { text: string; query?: string; colors: any }) => {
  if (!query || !query.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => (
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} style={{ backgroundColor: '#FFD700', color: '#000', borderRadius: 2, padding: '0 2px' }}>{part}</span>
        ) : part
      ))}
    </>
  );
};

const COMMON_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];
const ALL_EMOJIS = [
  '❤️', '😂', '😮', '😢', '🔥', '👍', '🙏', '✨', '👏', '🎉', '💔', '💯',
  '🫠', '💀', '🤡', '🥺', '😤', '🤯', '🥳', '😎', '🤔', '😏', '🥱', '😴',
  '👀', '🧠', '💪', '🤝', '🙌', '🤙', '✌️', '👌', '🤝', '🌈', '☀️', '⭐'
];

function PollBubble({ poll, isOwnMessage, onVote, currentUserId, colors, chatSettings, chatTheme }: any) {
  const hasVoted = poll.options.some((opt: any) => opt.votes?.includes(currentUserId));
  const totalVotes = poll.totalVotes || 0;

  return (
    <div style={{ padding: '8px 4px', minWidth: 240 }}>
      <ThemedText style={{ fontSize: chatSettings.fontSize, fontWeight: '700', marginBottom: 12, display: 'block', color: isOwnMessage ? chatTheme.textOwn : chatTheme.textOther }}>
        {poll.question}
      </ThemedText>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {poll.options.map((option: any, index: number) => {
          const votes = option.votes?.length || 0;
          const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
          const isSelected = option.votes?.includes(currentUserId);

          return (
            <div
              key={option.id || index}
              onClick={() => !hasVoted && onVote?.(option.id || index.toString())}
              style={{
                height: 36, borderRadius: 10, overflow: 'hidden', position: 'relative', cursor: hasVoted ? 'default' : 'pointer',
                backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                border: isSelected ? `1.5px solid ${colors.primary}` : 'none', display: 'flex', alignItems: 'center'
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${percentage}%`, backgroundColor: isSelected ? `${colors.primary}44` : (isOwnMessage ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'), transition: 'width 0.3s' }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', zIndex: 1, position: 'relative' }}>
                <ThemedText style={{ fontSize: chatSettings.fontSize - 2, fontWeight: '500', color: isOwnMessage ? chatTheme.textOwn : chatTheme.textOther }}>{option.text}</ThemedText>
                {hasVoted && <ThemedText style={{ fontSize: chatSettings.fontSize - 4, opacity: 0.7, color: isOwnMessage ? chatTheme.textOwn : chatTheme.textOther }}>{votes}</ThemedText>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AudioBubble({ url, duration, textColor, senderPhoto, senderName }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(duration);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setProgress(audioRef.current.currentTime / audioRef.current.duration);
          setCurrentSeconds(Math.max(0, Math.ceil(audioRef.current.duration - audioRef.current.currentTime)));
        }
      };
      audioRef.current.onended = () => { setIsPlaying(false); setProgress(0); setCurrentSeconds(duration); };
    }
    isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200, padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={togglePlay} style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor }}>
          {isPlaying ? <Pause size={18} fill={textColor} /> : <Play size={18} fill={textColor} />}
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ width: 3, height: 8 + Math.random() * 8, borderRadius: 2, backgroundColor: (i / 14) < progress ? textColor : `${textColor}55` }} />
          ))}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          {senderPhoto ? <img src={senderPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: textColor, fontSize: 12 }}>{senderName?.[0]}</div>}
        </div>
      </div>
      <ThemedText style={{ fontSize: 10, color: `${textColor}AA`, marginLeft: 48 }}>{currentSeconds.toFixed(1)}s</ThemedText>
    </div>
  );
}

function PostAttachmentBubble({ attachment, isOwnMessage, textColor }: { attachment: any, isOwnMessage: boolean, textColor: string }) {
  const { colors } = useTheme();
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`/post/${attachment.postId}`)}
      style={{ 
        width: 260, cursor: 'pointer', borderRadius: 12, overflow: 'hidden',
        backgroundColor: isOwnMessage ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
        border: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      {attachment.url && (
        <img src={attachment.url} style={{ width: '100%', height: 120, objectFit: 'cover' }} alt="" />
      )}
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {attachment.postAuthorPhoto ? (
            <img src={attachment.postAuthorPhoto} style={{ width: 24, height: 24, borderRadius: 12 }} />
          ) : (
            <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff' }}>
              {attachment.postAuthorName?.[0]?.toUpperCase()}
            </div>
          )}
          <ThemedText style={{ fontSize: 12, fontWeight: '700', color: textColor }}>{attachment.postAuthorName}</ThemedText>
        </div>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', display: 'block', marginBottom: 4, color: textColor }} numberOfLines={1}>
          {attachment.postTitle}
        </ThemedText>
        <ThemedText style={{ fontSize: 12, opacity: 0.7, color: textColor, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {attachment.postContent}
        </ThemedText>
        
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, color: colors.primary, fontSize: 12, fontWeight: '700' }}>
          Ver publicación <ChevronRight size={14} />
        </div>
      </div>
    </div>
  );
}

import { useCurrentUser } from '@/contexts/UserContext';

export function MessageBubble({
  message, isOwnMessage, currentUserId, onReply, onLongPress, onDoubleTap, onReplyPreviewPress, onForward, onVotePoll, highlighted, onDelete, onReact, channelId, isDM = false, participantId, searchQuery, backgroundActive, isStarred, onToggleStar, isGroup = false, isSystem = false
}: MessageBubbleProps & { onDelete?: (id: string, all: boolean) => void; onReact?: (id: string, emoji: string) => void }) {
  const { colors } = useTheme();
  const { isAdmin } = useCurrentUser();
  const [showMenu, setShowMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const chatTheme = colors.chat;
  const settings = colors.chatSettings;
  const reactions = Object.entries(message.reactions ?? {}).filter(([, users]) => (users as string[]).length > 0);

  useEffect(() => {
    if (currentUserId && message.id) isMessageSaved(currentUserId, message.id).then(setIsSaved);
  }, [currentUserId, message.id]);

  if (currentUserId && message.deletedForUsers?.includes(currentUserId)) return null;

  const audioAttachment = message.attachments?.find(a => a.type === 'audio');
  const mediaAttachment = message.attachments?.find(a => a.type === 'image' || a.type === 'video');
  
  // Use system high-contrast colors (iOS style) if a custom background is active
  const bubbleBg = backgroundActive 
    ? (isOwnMessage ? '#007AFF' : '#FFFFFF') 
    : (isOwnMessage ? chatTheme.bubbleOwn : chatTheme.bubbleOther);
    
  const textColor = backgroundActive
    ? (isOwnMessage ? '#FFFFFF' : '#1C1C1E')
    : (isOwnMessage ? chatTheme.textOwn : chatTheme.textOther);

  const handleToggleSave = async () => {
    if (currentUserId && channelId) {
      const result = await toggleSaveMessage(currentUserId, message, channelId, { isDM, participantId });
      setIsSaved(result);
      setShowMenu(false);
    }
  };

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: isOwnMessage ? 'flex-end' : 'flex-start', 
        marginBottom: spacing.sm, 
        padding: `0 ${spacing.md}px`, 
        position: 'relative' 
      }}
    >
      {!isOwnMessage && isGroup && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, marginLeft: 44 }}>
          <ThemedText style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
            {message.senderName}
          </ThemedText>
          {isSystem && <CheckCircle2 size={12} color={colors.primary} fill={`${colors.primary}20`} />}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, maxWidth: '85%', flexDirection: isOwnMessage ? 'row-reverse' : 'row' }}>
        {!isOwnMessage && isGroup && (
          <div style={{ flexShrink: 0, marginBottom: 2 }}>
            {message.senderPhoto ? (
              <img src={message.senderPhoto} alt="" style={{ width: 28, height: 28, borderRadius: 10, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: `${colors.primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: colors.primary, fontSize: 12, fontWeight: 'bold' }}>{message.senderName[0]}</span>
              </div>
            )}
          </div>
        )}
        <div
          onDoubleClick={() => onDoubleTap?.()}
          onContextMenu={(e) => { e.preventDefault(); onLongPress(message); }}
          style={{
            backgroundColor: bubbleBg, padding: mediaAttachment ? 8 : `${spacing.xs + 4}px ${spacing.md}px`, borderRadius: 20, 
            borderBottomRightRadius: isOwnMessage ? 4 : 20, borderBottomLeftRadius: isOwnMessage ? 20 : 4,
            boxShadow: highlighted ? `0 0 0 4px ${colors.primary}66` : '0 1px 2px rgba(0,0,0,0.1)',
            position: 'relative'
          }}
        >
          {message.replyTo && (
            <div onClick={() => onReplyPreviewPress?.(message.replyTo!.id)} style={{ borderLeft: `3px solid ${colors.primary}`, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 6, padding: '4px 8px', marginBottom: 8, cursor: 'pointer' }}>
              <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: colors.primary, display: 'block' }}>{message.replyTo.senderName}</ThemedText>
              <ThemedText style={{ fontSize: 11, color: textColor, opacity: 0.8, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {message.replyTo.isAudio ? '🎤 Audio' : message.replyTo.text}
              </ThemedText>
            </div>
          )}

          {mediaAttachment ? (
            <div style={{ position: 'relative', width: '100%', maxWidth: 320, borderRadius: 12, overflow: 'hidden' }}>
              {mediaAttachment.type === 'image' ? (
                <img src={mediaAttachment.url} onClick={() => setFullscreenMedia(mediaAttachment.url)} style={{ width: '100%', height: 'auto', maxHeight: 300, display: 'block', cursor: 'pointer', objectFit: 'cover' }} alt="" />
              ) : (
                <div style={{ position: 'relative' }}>
                  <video ref={videoRef} src={mediaAttachment.url} style={{ width: '100%', height: 'auto', maxHeight: 300, display: 'block', cursor: 'pointer' }} />
                  <button onClick={() => setFullscreenMedia(mediaAttachment.url)} style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 8, padding: 6, color: '#fff', cursor: 'pointer' }}>
                    <Maximize2 size={16} />
                  </button>
                </div>
              )}
              {message.text && <div style={{ padding: '8px 4px 0' }}><ThemedText style={{ color: textColor, fontSize: settings.fontSize, fontWeight: settings.fontWeight, fontStyle: settings.fontStyle }}>{message.text}</ThemedText></div>}
            </div>
          ) : audioAttachment ? (
            <AudioBubble url={audioAttachment.url} duration={audioAttachment.duration || 0} textColor={textColor} senderPhoto={message.senderPhoto} senderName={message.senderName} />
          ) : message.poll ? (
            <PollBubble poll={message.poll} isOwnMessage={isOwnMessage} onVote={onVotePoll} currentUserId={currentUserId} colors={colors} chatSettings={settings} chatTheme={chatTheme} />
          ) : message.attachments?.some(a => a.type === 'post') ? (
            <PostAttachmentBubble 
              attachment={message.attachments.find(a => a.type === 'post')} 
              isOwnMessage={isOwnMessage} 
              textColor={textColor} 
            />
          ) : (
            <ThemedText style={{ color: textColor, fontSize: settings.fontSize, fontWeight: settings.fontWeight, fontStyle: settings.fontStyle, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              <HighlightText text={message.text} query={searchQuery} colors={colors} />
            </ThemedText>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 2 }}>
            {isStarred && <Star size={10} fill="#FFD700" color="#FFD700" />}
            <ThemedText style={{ fontSize: 10, color: `${textColor}99` }}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</ThemedText>
          </div>
        </div>

        <div style={{ opacity: isHovered || showMenu ? 1 : 0, transition: 'opacity 0.2s', position: 'relative', flexShrink: 0 }}>
          <button 
            onClick={() => setShowMenu(!showMenu)} 
            style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', backgroundColor: colors.card, cursor: 'pointer', color: colors.textSecondary }}
          >
            <MoreHorizontal size={18} />
          </button>
          
          {showMenu && (
            <div style={{ position: 'absolute', bottom: '100%', [isOwnMessage ? 'right' : 'left']: 0, backgroundColor: colors.card, borderRadius: 12, padding: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 999, minWidth: 200, border: `1px solid ${colors.border}`, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 4, padding: '4px 8px', borderBottom: `1px solid ${colors.border}`, marginBottom: 6, alignItems: 'center' }}>
                {COMMON_EMOJIS.map(emoji => (
                  <button key={emoji} onClick={() => { onReact?.(message.id, emoji); setShowMenu(false); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 4, borderRadius: 6 }}>{emoji}</button>
                ))}
                <button onClick={() => setShowFullEmojiPicker(true)} style={{ background: 'none', border: 'none', color: colors.primary, cursor: 'pointer', padding: 4, display: 'flex' }}><Plus size={18} /></button>
              </div>
              <button onClick={() => { onReply(message); setShowMenu(false); }} style={menuStyle(colors)}><Reply size={14} /> Responder</button>
              {!isSystem && <button onClick={() => { onForward?.(message); setShowMenu(false); }} style={menuStyle(colors)}><Forward size={14} /> Reenviar</button>}
              <button onClick={() => { onToggleStar?.(message); setShowMenu(false); }} style={menuStyle(colors)}>
                <Star size={14} fill={isStarred ? "#FFD700" : "none"} color={isStarred ? "#FFD700" : "currentColor"} /> {isStarred ? 'Quitar destacado' : 'Destacar'}
              </button>
              <button onClick={handleToggleSave} style={menuStyle(colors)}>
                <Bookmark size={14} fill={isSaved ? colors.primary : 'none'} color={isSaved ? colors.primary : 'currentColor'} /> {isSaved ? 'Quitar de guardados' : 'Guardar mensaje'}
              </button>
              <button onClick={() => { setShowDeleteModal(true); setShowMenu(false); }} style={{ ...menuStyle(colors), color: colors.danger }}><Trash2 size={14} /> Eliminar</button>
            </div>
          )}
        </div>
      </div>

      {reactions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {reactions.map(([emoji, users]) => (
            <div key={emoji} onClick={() => onReact?.(message.id, emoji)} style={{ backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 12, padding: '2px 8px', fontSize: 12, display: 'flex', gap: 4, cursor: 'pointer' }}>
              <span>{emoji}</span><span style={{ opacity: 0.7 }}>{(users as string[]).length}</span>
            </div>
          ))}
        </div>
      )}

      {showFullEmojiPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: 20, padding: 20, width: 320, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <ThemedText style={{ fontWeight: 'bold' }}>Reaccionar</ThemedText>
              <button onClick={() => setShowFullEmojiPicker(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, maxHeight: 300, overflowY: 'auto', paddingRight: 4 }}>
              {ALL_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { onReact?.(message.id, emoji); setShowFullEmojiPicker(false); setShowMenu(false); }} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', padding: 4, borderRadius: 8, transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>{emoji}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {fullscreenMedia && (
        <div onClick={() => setFullscreenMedia(null)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <button onClick={() => setFullscreenMedia(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={32} /></button>
          {fullscreenMedia.includes('.mp4') || mediaAttachment?.type === 'video' ? (
            <video src={fullscreenMedia} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : (
            <img src={fullscreenMedia} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
          )}
        </div>
      )}

      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: colors.card, borderRadius: 20, padding: 24, width: 320, textAlign: 'center' }}>
            <Trash2 size={48} color={colors.danger} style={{ margin: '0 auto 16px' }} />
            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', display: 'block', marginBottom: 8 }}>¿Eliminar mensaje?</ThemedText>
            <button onClick={() => { onDelete?.(message.id, false); setShowDeleteModal(false); }} style={{ width: '100%', padding: 12, borderRadius: 10, backgroundColor: colors.backgroundSecondary, border: 'none', fontWeight: 'bold', marginBottom: 8, cursor: 'pointer' }}>Para mí</button>
            {(isOwnMessage || isAdmin) && <button onClick={() => { onDelete?.(message.id, true); setShowDeleteModal(false); }} style={{ width: '100%', padding: 12, borderRadius: 10, backgroundColor: colors.danger, color: '#fff', border: 'none', fontWeight: 'bold', marginBottom: 8, cursor: 'pointer' }}>Para todos</button>}
            <button onClick={() => setShowDeleteModal(false)} style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

const menuStyle = (colors: any) => ({
  width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none', backgroundColor: 'transparent',
  color: colors.text, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
  whiteSpace: 'nowrap'
});
