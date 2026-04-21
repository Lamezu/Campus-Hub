import React, { useRef, useState, useEffect } from 'react';
import { Reply, Play, Pause, MoreHorizontal, Smile, Trash2, Forward, X, Bookmark, Maximize2, Plus, Star, ChevronRight, ExternalLink, CheckCircle2, Download, Loader2, Image as ImageIcon, FileText, BarChart2, Mic } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { spacing } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { downloadAndOpenFile } from '@/utils/fileDownload';
import { ThemedText } from './themed-text';
import { toggleSaveMessage, isMessageSaved } from '@/services/savedItemsService';
import { Avatar } from './common/Avatar';
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
  isReadOnlyChannel?: boolean;
  channelName?: string;
  onUserClick?: (uid: string) => void;
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
  '👀', '🧠', '💪', '🤝', '🙌', '🤙', '✌️', '👌', '🌈', '☀️', '⭐'
];

function PollBubble({ poll, isOwnMessage, onVote, currentUserId, colors, chatSettings, chatTheme, textColor, t }: any) {
  const hasVoted = poll.options.some((opt: any) => opt.votes?.includes(currentUserId));
  const totalVotes = poll.options.reduce((acc: number, opt: any) => acc + (opt.votes?.length || 0), 0);
  const isMultiple = poll.multipleAnswers;

  // Find max votes to highlight winner
  const maxVotes = Math.max(...poll.options.map((o: any) => o.votes?.length || 0));

  return (
    <div style={{ padding: '8px 4px', minWidth: 260 }}>
      {/* Question */}
      <ThemedText style={{ 
        fontSize: chatSettings.fontSize, 
        fontWeight: '800', 
        marginBottom: 16, 
        display: 'block', 
        color: textColor,
        lineHeight: 1.4
      }}>
        {poll.question}
      </ThemedText>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {poll.options.map((option: any, index: number) => {
          const votes = option.votes?.length || 0;
          const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
          const isSelected = option.votes?.includes(currentUserId);
          const isWinner = totalVotes > 0 && votes === maxVotes;

          return (
            <div
              key={option.id || index}
              onClick={() => onVote?.(option.id || index.toString())}
              style={{
                height: 44, 
                borderRadius: 14, 
                overflow: 'hidden', 
                position: 'relative', 
                cursor: 'pointer',
                backgroundColor: isOwnMessage ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${isSelected ? colors.primary : 'transparent'}`,
                display: 'flex', 
                alignItems: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              {/* Progress Bar Animation */}
              <div style={{ 
                position: 'absolute', 
                left: 0, 
                top: 0, 
                bottom: 0, 
                width: hasVoted ? `${percentage}%` : '0%', 
                backgroundColor: isWinner && hasVoted 
                  ? (isOwnMessage ? 'rgba(255,255,255,0.25)' : `${colors.primary}33`) 
                  : (isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'), 
                transition: 'width 0.6s cubic-bezier(0.1, 0, 0, 1)' 
              }} />

              {/* Content */}
              <div style={{ 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '0 14px', 
                zIndex: 1, 
                position: 'relative' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ThemedText style={{ 
                    fontSize: chatSettings.fontSize - 1, 
                    fontWeight: isSelected ? '700' : '500', 
                    color: textColor 
                  }}>
                    {option.text}
                  </ThemedText>
                  {isSelected && <CheckCircle2 size={16} color={isOwnMessage ? '#fff' : colors.primary} />}
                </div>

                {hasVoted && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0 }}>
                    <ThemedText style={{ 
                      fontSize: 12, 
                      fontWeight: '800', 
                      color: isWinner && hasVoted ? (isOwnMessage ? '#fff' : colors.primary) : textColor 
                    }}>
                      {percentage.toFixed(0)}%
                    </ThemedText>
                    <ThemedText style={{ 
                      fontSize: 10, 
                      opacity: 0.6, 
                      color: textColor 
                    }}>
                      {votes} {votes === 1 ? t('chat_ui.poll.vote') : t('chat_ui.poll.votes')}
                    </ThemedText>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: 16, 
        paddingTop: 10,
        borderTop: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}` 
      }}>
        <ThemedText style={{ 
          fontSize: 11, 
          color: textColor, 
          opacity: 0.6,
          fontWeight: '600'
        }}>
          {totalVotes === 1 ? t('chat_ui.poll.total_vote', { count: totalVotes }) : t('chat_ui.poll.total_votes', { count: totalVotes })}
        </ThemedText>
        <div style={{ 
          padding: '4px 8px', 
          backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : `${colors.primary}15`, 
          borderRadius: 6 
        }}>
          <ThemedText style={{ 
            fontSize: 9, 
            color: isOwnMessage ? '#fff' : colors.primary, 
            fontWeight: '800', 
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}>
            {isMultiple ? t('chat_ui.poll.multiple') : t('chat_ui.poll.single')}
          </ThemedText>
        </div>
      </div>
    </div>
  );
}

function AudioBubble({ url, duration, textColor, senderPhoto, senderName, t }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate deterministic waveform from hash
  const waveform = React.useMemo(() => {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash) + url.charCodeAt(i);
      hash |= 0;
    }
    return Array.from({ length: 28 }).map((_, i) => {
      const h = Math.abs(Math.sin(hash + i * 0.5) * 16) + 4;
      return h;
    });
  }, [url]);

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
          const ratio = audioRef.current.currentTime / audioRef.current.duration;
          setProgress(ratio);
          setCurrentTime(audioRef.current.currentTime);
        }
      };
      audioRef.current.onended = () => { 
        setIsPlaying(false); 
        setProgress(0); 
        setCurrentTime(0);
      };
      audioRef.current.onloadedmetadata = () => {
        // Correct duration if potentially missing
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Audio play failed:", e));
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, padding: '6px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Play/Pause Button */}
        <button 
          onClick={togglePlay} 
          style={{ 
            width: 38, 
            height: 38, 
            borderRadius: '50%', 
            backgroundColor: isPlaying ? `${textColor}22` : `${textColor}15`, 
            border: `1px solid ${textColor}33`, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: textColor,
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.1, 0, 0, 1)'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isPlaying ? (
            <Pause size={18} fill={textColor} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} />
          ) : (
            <Play size={18} fill={textColor} style={{ marginLeft: 3, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} />
          )}
        </button>

        {/* Professional Waveform */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2.5, height: 28 }}>
          {waveform.map((h, i) => {
            const barProgress = (i / waveform.length);
            const isActive = barProgress <= progress;
            return (
              <div 
                key={i} 
                style={{ 
                  width: 3, 
                  height: h, 
                  borderRadius: 2, 
                  backgroundColor: isActive ? textColor : `${textColor}33`,
                  transition: 'background-color 0.1s ease, height 0.2s ease',
                  boxShadow: isActive ? `0 0 8px ${textColor}44` : 'none'
                }} 
              />
            );
          })}
        </div>

        {/* Sender Mini-Avatar (Telegram style) */}
          <Avatar src={senderPhoto} name={senderName} size={34} style={{ borderRadius: 12 }} />
      </div>

      {/* Time and Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginLeft: 50, paddingRight: 4 }}>
        <ThemedText style={{ fontSize: 10, fontWeight: '700', color: `${textColor}CC`, letterSpacing: 0.5 }}>
          {isPlaying ? formatTime(currentTime) : (duration ? formatTime(duration) : '0:00')}
        </ThemedText>
        {isPlaying && (
          <ThemedText style={{ fontSize: 9, fontWeight: '800', color: textColor, opacity: 0.5, textTransform: 'uppercase' }}>
            {t('chat_ui.audio.playing')}
          </ThemedText>
        )}
      </div>
    </div>
  );
}

function FileBubble({ file, textColor, t }: any) {
  const [downloading, setDownloading] = useState(false);

  return (
    <div 
      onClick={async () => {
        if (downloading) return;
        try {
          setDownloading(true);
          await downloadAndOpenFile(file.url, file.name || 'documento');
        } catch (e) {
          console.error("Download failed", e);
        } finally {
          setDownloading(false);
        }
      }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, cursor: downloading ? 'wait' : 'pointer', minWidth: 200, border: '1px solid rgba(0,0,0,0.05)', opacity: downloading ? 0.7 : 1 }}
    >
       <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <b style={{ color: textColor, fontSize: 11 }}>{file.name?.split('.').pop()?.toUpperCase() || 'FILE'}</b>
       </div>
       <div style={{ flex: 1, overflow: 'hidden' }}>
         <ThemedText style={{ color: textColor, fontWeight: '700', fontSize: 14, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'block' }}>{file.name}</ThemedText>
         <ThemedText style={{ color: textColor, opacity: 0.7, fontSize: 12, display: 'block' }}>
           {downloading ? (t('common.locale_code').includes('es') ? 'Descargando...' : 'Downloading...') : file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : t('chat_ui.plus_menu.file')}
         </ThemedText>
       </div>
       {downloading ? <Loader2 size={20} color={textColor} className="animate-spin" /> : <Download size={20} color={textColor} />}
    </div>
  );
}

function PostAttachmentBubble({ attachment, isOwnMessage, textColor, t }: { attachment: any, isOwnMessage: boolean, textColor: string, t: any }) {
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
          <Avatar src={attachment.postAuthorPhoto} name={attachment.postAuthorName} size={24} />
          <ThemedText style={{ fontSize: 12, fontWeight: '700', color: textColor }}>{attachment.postAuthorName}</ThemedText>
        </div>
        <ThemedText style={{ fontSize: 14, fontWeight: '800', display: 'block', marginBottom: 4, color: textColor }} numberOfLines={1}>
          {attachment.postTitle}
        </ThemedText>
        <ThemedText style={{ fontSize: 12, opacity: 0.7, color: textColor, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {attachment.postContent}
        </ThemedText>
        
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, color: colors.primary, fontSize: 12, fontWeight: '700' }}>
          {t('chat_ui.view_post')} <ChevronRight size={14} />
        </div>
      </div>
    </div>
  );
}

import { useCurrentUser } from '@/contexts/UserContext';

const ContactCardBubble = ({ card, colors, textColor, onClick, t }: { card: any; colors: any; textColor: string; onClick: () => void; t: any }) => {
  const roleBadgeColor = (role: string) => {
    if (role === 'teacher') return '#007AFF';
    if (role === 'admin') return '#AF52DE';
    return '#34C759';
  };

  const roleLabel = (role: string) => {
    if (role === 'teacher') return t('common.roles.teacher');
    if (role === 'admin') return t('common.roles.admin');
    return t('common.roles.student');
  };

  return (
    <div 
      onClick={onClick}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12, 
        padding: '12px', 
        backgroundColor: `${colors.primary}10`, 
        borderRadius: 12, 
        cursor: 'pointer',
        border: `1px solid ${colors.primary}20`,
        marginTop: 4,
        minWidth: 200,
        maxWidth: 280,
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${colors.primary}20`}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = `${colors.primary}10`}
    >
        <Avatar src={card?.photo} name={card?.name || 'Usuario'} size={44} />
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <ThemedText style={{ fontWeight: 800, fontSize: 15, display: 'block', color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card?.name || 'Usuario'}</ThemedText>
        <div style={{ padding: '2px 6px', borderRadius: 6, backgroundColor: `${roleBadgeColor(card?.role)}22`, color: roleBadgeColor(card?.role), fontSize: 10, fontWeight: 700, display: 'inline-block', marginTop: 2 }}>
          {roleLabel(card?.role)}
        </div>
      </div>
      <ChevronRight size={18} color={colors.primary} />
    </div>
  );
};

export function MessageBubble({
  message, isOwnMessage, currentUserId, onReply, onLongPress, onDoubleTap, onReplyPreviewPress, onForward, onVotePoll, highlighted, onDelete, onReact, channelId, isDM = false, participantId, searchQuery, backgroundActive, isStarred, onToggleStar, isGroup = false, isSystem = false,
  isReadOnlyChannel = false, channelName, onUserClick
}: MessageBubbleProps & { onDelete?: (id: string, all: boolean) => void; onReact?: (id: string, emoji: string) => void }) {
  const { t } = useTranslation();
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
  const fileAttachment = message.attachments?.find(a => a.type === 'file');
  
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '85%', flexDirection: isOwnMessage ? 'row-reverse' : 'row' }}>
        {!isOwnMessage && isGroup && (
          <div style={{ flexShrink: 0, marginBottom: 2 }}>
            <Avatar src={message.senderPhoto} name={message.senderName} size={28} style={{ borderRadius: 10 }} />
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
            <div onClick={() => onReplyPreviewPress?.(message.replyTo!.id)} style={{ borderLeft: `3px solid ${colors.primary}`, backgroundColor: isOwnMessage ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '4px 8px', marginBottom: 8, cursor: 'pointer' }}>
              <ThemedText style={{ fontSize: 11, fontWeight: 'bold', color: colors.primary, display: 'block' }}>{message.replyTo.senderName}</ThemedText>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {message.replyTo.type === 'image' && <ImageIcon size={10} color={textColor} style={{ opacity: 0.6 }} />}
                {message.replyTo.type === 'video' && <Play size={10} color={textColor} style={{ opacity: 0.6 }} />}
                {message.replyTo.type === 'file' && <FileText size={10} color={textColor} style={{ opacity: 0.6 }} />}
                {message.replyTo.type === 'audio' && <Mic size={10} color={textColor} style={{ opacity: 0.6 }} />}
                {message.replyTo.type === 'poll' && <BarChart2 size={10} color={textColor} style={{ opacity: 0.6 }} />}
                
                <ThemedText style={{ fontSize: 11, color: textColor, opacity: 0.8, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {message.replyTo.type === 'image' ? (message.replyTo.text || 'Foto') :
                   message.replyTo.type === 'video' ? (message.replyTo.text || 'Vídeo') :
                   message.replyTo.type === 'audio' ? 'Audio' :
                   message.replyTo.type === 'file' ? (message.replyTo.attachmentName || 'Archivo') :
                   message.replyTo.type === 'poll' ? (message.replyTo.text || 'Encuesta') :
                   message.replyTo.text}
                </ThemedText>
              </div>
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
            <AudioBubble url={audioAttachment.url} duration={audioAttachment.duration || 0} textColor={textColor} senderPhoto={message.senderPhoto} senderName={message.senderName} t={t} />
          ) : fileAttachment ? (
            <FileBubble file={fileAttachment} textColor={textColor} t={t} />
          ) : message.contactCard ? (
            <ContactCardBubble card={message.contactCard} colors={colors} textColor={textColor} onClick={() => onUserClick?.(message.contactCard!.userId)} t={t} />
          ) : message.poll ? (
            <PollBubble poll={message.poll} isOwnMessage={isOwnMessage} onVote={onVotePoll} currentUserId={currentUserId} colors={colors} chatSettings={settings} chatTheme={chatTheme} textColor={textColor} t={t} />
          ) : message.attachments?.some(a => a.type === 'post') ? (
            <PostAttachmentBubble 
              attachment={message.attachments.find(a => a.type === 'post')} 
              isOwnMessage={isOwnMessage} 
              textColor={textColor} 
              t={t}
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
              {!isReadOnlyChannel && (
                <button onClick={() => { onReply(message); setShowMenu(false); }} style={menuStyle(colors)}><Reply size={14} /> {t('chat_ui.menu.reply')}</button>
              )}
              {!isSystem && <button onClick={() => { onForward?.(message); setShowMenu(false); }} style={menuStyle(colors)}><Forward size={14} /> {t('chat_ui.menu.forward')}</button>}
              
              {!isReadOnlyChannel && channelName !== 'General' && (
                <button onClick={() => { onToggleStar?.(message); setShowMenu(false); }} style={menuStyle(colors)}>
                  <Star size={14} fill={isStarred ? "#FFD700" : "none"} color={isStarred ? "#FFD700" : "currentColor"} /> {isStarred ? t('chat_ui.menu.unstar') : t('chat_ui.menu.star')}
                </button>
              )}
              
              {!isReadOnlyChannel && (
                <button onClick={handleToggleSave} style={menuStyle(colors)}>
                  <Bookmark size={14} fill={isSaved ? colors.primary : 'none'} color={isSaved ? colors.primary : 'currentColor'} /> {isSaved ? t('chat_ui.poll_modal.unsave') : t('chat_ui.poll_modal.save_msg')}
                </button>
              )}
              
              <button onClick={() => { setShowDeleteModal(true); setShowMenu(false); }} style={{ ...menuStyle(colors), color: colors.danger }}><Trash2 size={14} /> {t('chat_ui.menu.delete')}</button>
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
              <ThemedText style={{ fontWeight: 'bold' }}>{t('feed.reply')}</ThemedText>
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
            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', display: 'block', marginBottom: 8 }}>{t('post_screen.delete.title')}</ThemedText>
            <button onClick={() => { onDelete?.(message.id, false); setShowDeleteModal(false); }} style={{ width: '100%', padding: 12, borderRadius: 10, backgroundColor: colors.backgroundSecondary, border: 'none', fontWeight: 'bold', marginBottom: 8, cursor: 'pointer' }}>{t('group_chat.only_you')}</button>
            {!isReadOnlyChannel && (isOwnMessage || isAdmin) && <button onClick={() => { onDelete?.(message.id, true); setShowDeleteModal(false); }} style={{ width: '100%', padding: 12, borderRadius: 10, backgroundColor: colors.danger, color: '#fff', border: 'none', fontWeight: 'bold', marginBottom: 8, cursor: 'pointer' }}>{t('chat_ui.channel_info.alerts.clear_confirm_all')}</button>}
            <button onClick={() => setShowDeleteModal(false)} style={{ width: '100%', padding: 12, background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}>{t('common.cancel')}</button>
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
