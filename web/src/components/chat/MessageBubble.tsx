import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { CornerDownRight, Copy, Trash2, Forward, Smile, Mic, Bookmark, FileText, Download, ChevronRight } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import AudioMessage from './AudioMessage';
import type { Message } from '../../types';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { auth } from '../../config/firebase';
import { getOrCreateConversation } from '../../services/firebase/directMessageService';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  chatId?: string;
  isConversation?: boolean;
  chatCollection?: 'conversations' | 'channels' | 'groupConversations';
  isSaved?: boolean;
  onReply?: (message: Message) => void;
  onDelete?: (message: Message, forEveryone: boolean) => void;
  onForward?: (message: Message) => void;
  onReact?: (message: Message, emoji: string) => void;
  onCopy?: (text: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  onAudioReply?: (message: Message) => void;
  onSave?: (message: Message) => void;
  onAvatarClick?: (senderId: string) => void;
}


function hexToRgba(hex: string, alpha: number): string {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(128,128,128,${alpha})`;
  const h = hex.replace('#', '').slice(0, 6);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getLuminance(hex: string): number {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return 0.5;
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
  chatId,
  isConversation = false,
  chatCollection,
  isSaved = false,
  onReply,
  onDelete,
  onForward,
  onReact,
  onCopy,
  onScrollToMessage,
  onAudioReply,
  onSave,
  onAvatarClick,
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

  const navigate = useNavigate();
  const audioAttachment = message.attachments?.find(a => a.type === 'audio');
  const imageAttachment = message.attachments?.find(a => a.type === 'image');
  const fileAttachment = message.attachments?.find(a => a.type === 'file');
  const postAttachment = message.attachments?.find(a => a.type === 'post');
  const contactAttachment = message.attachments?.find(a => a.type === 'contact');
  const currentUid = auth.currentUser?.uid ?? '';

  const handleContactClick = async (userId: string) => {
    if (!currentUid || !userId || userId === currentUid) return;
    try {
      const convId = await getOrCreateConversation(currentUid, userId);
      navigate('/messages/' + convId);
    } catch {}
  };
  const poll = (message.poll && typeof message.poll === 'object' && !Array.isArray(message.poll) && typeof message.poll.question === 'string' && Array.isArray(message.poll.options))
    ? message.poll
    : null;

  const handleVote = async (optionIndex: number) => {
    if (!poll || !chatId || !currentUid) return;
    const collection_ = chatCollection ?? (isConversation ? 'conversations' : 'channels');
    const msgRef = doc(db, collection_, chatId, 'messages', message.id);
    const key = `poll.votes.${optionIndex}`;
    const pollVotes = poll.votes || {};
    const alreadyVoted = ((pollVotes[optionIndex] ?? pollVotes[String(optionIndex)]) ?? []).includes(currentUid);
    if (alreadyVoted) {
      await updateDoc(msgRef, { [key]: arrayRemove(currentUid) });
    } else {
      if (!poll.multipleAnswers) {
        const updates: Record<string, any> = {};
        poll.options.forEach((_, i) => {
          const v = ((pollVotes)[i] ?? (pollVotes)[String(i)]) ?? [];
          if (v.includes(currentUid)) {
            updates[`poll.votes.${i}`] = arrayRemove(currentUid);
          }
        });
        updates[key] = arrayUnion(currentUid);
        await updateDoc(msgRef, updates);
      } else {
        await updateDoc(msgRef, { [key]: arrayUnion(currentUid) });
      }
    }
  };

  const downloadFile = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      window.open(url, '_blank');
    }
  };

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

  useEffect(() => {
    if (!showMenu) return;
    const handleScroll = () => setShowMenu(false);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [showMenu]);


  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 210;
    const menuHeight = 300;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    let left = e.clientX;
    if (left + menuWidth > vw - margin) left = e.clientX - menuWidth;
    if (left < margin) left = margin;

    let top = e.clientY + margin;
    if (top + menuHeight > vh - margin) top = e.clientY - menuHeight;
    if (top < margin) top = margin;

    setMenuPosition({ left, top });
    setShowMenu(true);
  };

  const handleEmojiButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    const pickerWidth = 320;
    const pickerHeight = 400;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8;

    let left = isOwnMessage
      ? e.clientX - pickerWidth - margin
      : e.clientX + margin;

    if (left + pickerWidth > viewportWidth - margin) left = viewportWidth - pickerWidth - margin;
    if (left < margin) left = margin;

    let top: number;
    if (e.clientY + pickerHeight + margin <= viewportHeight) {
      top = e.clientY;
    } else {
      top = e.clientY - pickerHeight;
    }

    if (top + pickerHeight > viewportHeight - margin) top = viewportHeight - pickerHeight - margin;
    if (top < margin) top = margin;

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
    <div
      onClick={() => onAvatarClick?.(message.senderId)}
      style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        flexShrink: 0,
        alignSelf: 'flex-end',
        overflow: 'hidden',
        backgroundColor: colors.backgroundSecondary,
        cursor: onAvatarClick ? 'pointer' : 'default',
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
      className="msg-enter"
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

        <div style={bubbleStyle} onContextMenu={handleContextMenu}>
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
          ) : imageAttachment ? (
            <div>
              <img
                src={imageAttachment.url}
                alt={imageAttachment.name}
                style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 10, display: 'block', cursor: 'pointer' }}
                onClick={() => window.open(imageAttachment.url, '_blank')}
              />
              {message.text ? <div style={{ marginTop: 6 }}>{message.text}</div> : null}
            </div>
          ) : fileAttachment ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.2)' : colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={20} color={isOwnMessage ? '#fff' : colors.primary} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileAttachment.name}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{(fileAttachment.size / 1024).toFixed(0)} KB</div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); downloadFile(fileAttachment.url, fileAttachment.name); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', opacity: 0.7 }}
                title="Descargar"
              >
                <Download size={16} color={bubbleText} />
              </button>
            </div>
          ) : postAttachment ? (
            <div
              onClick={() => postAttachment.postId && window.open(`/post/${postAttachment.postId}`, '_self')}
              style={{
                borderRadius: 10,
                overflow: 'hidden',
                cursor: 'pointer',
                backgroundColor: hexToRgba(bubbleText, 0.08),
                minWidth: 200,
                maxWidth: 280,
              }}
            >
              {postAttachment.url && (
                <img
                  src={postAttachment.url}
                  alt=""
                  style={{ width: '100%', maxHeight: 140, objectFit: 'cover', display: 'block' }}
                />
              )}
              <div style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {postAttachment.postAuthorPhoto ? (
                    <img src={postAttachment.postAuthorPhoto} alt="" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: hexToRgba(bubbleText, 0.25), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                      {postAttachment.postAuthorName?.[0]?.toUpperCase()}
                    </div>
                  )}
                  <span style={{ fontSize: 11, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {postAttachment.postAuthorName}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {postAttachment.postTitle}
                </div>
                {postAttachment.postContent && (
                  <div style={{ fontSize: 12, opacity: 0.7, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                    {postAttachment.postContent}
                  </div>
                )}
              </div>
            </div>
          ) : contactAttachment ? (
            <div
              onClick={() => contactAttachment.userId && handleContactClick(contactAttachment.userId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 12,
                backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                cursor: contactAttachment.userId ? 'pointer' : 'default',
                width: 220,
              }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, backgroundColor: hexToRgba(bubbleText, 0.15), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {contactAttachment.url
                  ? <img src={contactAttachment.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 18, fontWeight: '700', color: bubbleText }}>{contactAttachment.name[0]?.toUpperCase()}</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: '700', color: bubbleText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contactAttachment.name}</div>
                <div style={{ fontSize: 12, color: hexToRgba(bubbleText, contactAttachment.bio ? 0.7 : 0.5), marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {contactAttachment.bio || 'Alumno/a'}
                </div>
              </div>
              <ChevronRight size={18} color={hexToRgba(bubbleText, 0.5)} />
            </div>
          ) : poll ? (
            <div style={{ minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{poll.question}</div>
              {poll.options.map((opt, i) => {
                const pollVotes = poll.votes || {};
                const votes = (pollVotes[i] ?? pollVotes[String(i)]) ?? [];
                const totalVotes = Object.values(pollVotes).reduce((s: number, v: any) => s + (Array.isArray(v) ? v.length : 0), 0);
                const pct = totalVotes > 0 ? Math.round((votes.length / totalVotes) * 100) : 0;
                const voted = Array.isArray(votes) && votes.includes(currentUid);
                return (
                  <div
                    key={i}
                    onClick={() => handleVote(i)}
                    style={{ position: 'relative', marginBottom: 8, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: `1.5px solid ${voted ? (isOwnMessage ? 'rgba(255,255,255,0.6)' : colors.primary) : 'rgba(128,128,128,0.3)'}`, padding: '8px 12px' }}
                  >
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: voted ? (isOwnMessage ? 'rgba(255,255,255,0.15)' : colors.primary + '22') : 'transparent', width: `${pct}%`, transition: 'width 0.3s' }} />
                    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13 }}>{opt}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                {Object.values(poll.votes || {}).reduce((s: number, v: any) => s + (Array.isArray(v) ? v.length : 0), 0)} voto{Object.values(poll.votes || {}).reduce((s: number, v: any) => s + (Array.isArray(v) ? v.length : 0), 0) !== 1 ? 's' : ''}
                {poll.multipleAnswers ? ' · Varias respuestas' : ''}
              </div>
            </div>
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

      {showMenu && createPortal(
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
            <Bookmark size={16} color={colors.primary} fill={isSaved ? colors.primary : 'none'} />
            <span style={{ color: isSaved ? colors.primary : colors.text }}>
              {isSaved ? 'Quitar de guardados' : 'Guardar mensaje'}
            </span>
          </div>

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

          <div
            style={{ ...menuItemStyle, color: colors.danger }}
            onClick={handleDeleteClick}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Trash2 size={16} color={colors.danger} />
            <span>{isOwnMessage ? 'Eliminar' : 'Eliminar para mí'}</span>
          </div>
        </div>,
        document.body
      )}

      {showEmojiPicker && createPortal(
        <div ref={emojiPickerRef} style={emojiPickerStyle}>
          <EmojiPicker
            onEmojiClick={handleEmojiSelect}
            autoFocusSearch={false}
            width={320}
            height={400}
            searchPlaceholder="Buscar emoji..."
            previewConfig={{ showPreview: false }}
          />
        </div>,
        document.body
      )}

      {showDeleteModal && createPortal(
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
        </>,
        document.body
      )}
    </div>
  );
}
