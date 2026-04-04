import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity, Image } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Audio } from 'expo-av';
import { Reply, Play, Pause, Mic, FileText, Download, Check, Image as ReplyImageIcon, BarChart3, ChevronRight, Calendar, Star } from 'lucide-react-native';
import { ThemedText } from './themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { Message } from '@/types';

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 80;
const SPEEDS = [1, 1.5, 2] as const;
const WAVE_BARS = [4, 8, 12, 7, 14, 6, 11, 9, 13, 5, 10, 7, 12, 5];

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  currentUserId?: string;
  onReply?: (msg: Message) => void;
  onLongPress: (msg: Message) => void;
  onDoubleTap?: () => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  onQuickAudioReply?: (msg: Message) => void;
  onReplyPreviewPress?: (messageId: string) => void;
  onSenderPress?: (senderId: string) => void;
  highlighted?: boolean;
  onVotePoll?: (optionId: string) => void;
  onFilePress?: (url: string, name: string) => void;
  showReadReceipt?: boolean;
  searchHighlight?: string;
  isStarred?: boolean;
}

function HighlightedText({
  text,
  highlight,
  style,
  highlightColor,
}: {
  text: string;
  highlight: string;
  style: any;
  highlightColor: string;
}) {
  if (!highlight.trim()) return <ThemedText style={style}>{text}</ThemedText>;
  const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <ThemedText style={style}>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <ThemedText key={i} style={[style, { backgroundColor: highlightColor, borderRadius: 2 }]}>
            {part}
          </ThemedText>
        ) : (
          part
        )
      )}
    </ThemedText>
  );
}

function formatAudioTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function hexLuminance(hex: string): number {
  const clean = hex.replace('#', '').slice(0, 6);
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}


function AudioBubble({
  url,
  duration,
  bubbleBg,
  textColor,
  senderPhoto,
  senderName,
  onLongPress,
}: {
  url: string;
  duration: number;
  bubbleBg: string;
  textColor: string;
  senderPhoto?: string | null;
  senderName?: string;
  onLongPress?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(duration);
  const [speedIndex, setSpeedIndex] = useState(0);
  const soundRef = useRef<any>(null);
  const hasFinishedRef = useRef(false);
  const totalMs = duration * 1000;

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  const startSound = async () => {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, rate: SPEEDS[speedIndex], shouldCorrectPitch: true },
      (status: any) => {
        if (!status.isLoaded) return;
        const pos = status.positionMillis ?? 0;
        const total = status.durationMillis ?? totalMs;
        setProgress(total > 0 ? pos / total : 0);
        setCurrentSeconds(Math.max(0, Math.ceil((total - pos) / 1000)));
        if (status.didJustFinish) {
          hasFinishedRef.current = true;
          setIsPlaying(false);
          setProgress(0);
          setCurrentSeconds(duration);
        }
      }
    );
    soundRef.current = sound;
    setIsPlaying(true);
  };

  const togglePlay = async () => {
    try {
      if (!soundRef.current) {
        await startSound();
      } else if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        if (hasFinishedRef.current) {
          await soundRef.current.setPositionAsync(0);
          hasFinishedRef.current = false;
        }
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch { }
  };

  const handleBubblePress = async () => {
    if (isPlaying) return;
    try {
      if (!soundRef.current) {
        await startSound();
      } else {
        if (hasFinishedRef.current) {
          await soundRef.current.setPositionAsync(0);
          hasFinishedRef.current = false;
        }
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch { }
  };

  const cycleSpeed = async () => {
    const nextIndex = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIndex);
    if (soundRef.current) {
      try { await soundRef.current.setRateAsync(SPEEDS[nextIndex], true); } catch { }
    }
  };

  const bubbleLum = hexLuminance(bubbleBg.slice(0, 7));
  const isLightBubble = bubbleLum > 0.45;
  const playBtnBg = isLightBubble ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)';
  const playBtnBorder = isLightBubble ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.45)';
  const speedBg = isLightBubble ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';
  const barColor = textColor;

  return (
    <TouchableOpacity style={styles.audioBubble} onPress={handleBubblePress} onLongPress={onLongPress} delayLongPress={350} activeOpacity={1}>
      <View style={styles.audioMainRow}>
        <TouchableOpacity
          onPress={togglePlay}
          style={[styles.audioPlayBtn, { backgroundColor: playBtnBg, borderWidth: 1.5, borderColor: playBtnBorder }]}
          activeOpacity={0.7}
        >
          {isPlaying
            ? <Pause size={18} color={textColor} strokeWidth={2} />
            : <Play size={18} color={textColor} strokeWidth={2} fill={textColor} />
          }
        </TouchableOpacity>

        <View style={styles.waveform}>
          {WAVE_BARS.map((h, i) => {
            const barFrac = i / WAVE_BARS.length;
            const played = barFrac < progress;
            return (
              <View
                key={i}
                style={[styles.waveBar, { height: h, backgroundColor: played ? barColor : barColor + '55' }]}
              />
            );
          })}
        </View>

        {isPlaying ? (
          <TouchableOpacity onPress={cycleSpeed} style={[styles.speedPill, { backgroundColor: speedBg }]} activeOpacity={0.7}>
            <ThemedText style={[styles.speedText, { color: textColor }]}>
              {SPEEDS[speedIndex] === 1 ? 'x1' : SPEEDS[speedIndex] === 1.5 ? 'x1.5' : 'x2'}
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <View style={[styles.audioAvatarCircle, { backgroundColor: speedBg }]}>
            {senderPhoto
              ? <Image source={{ uri: senderPhoto }} style={styles.audioAvatarImg} />
              : <ThemedText style={[styles.audioAvatarInitial, { color: textColor }]}>
                {senderName?.[0]?.toUpperCase() ?? '?'}
              </ThemedText>
            }
          </View>
        )}
      </View>

      <ThemedText style={[styles.audioDuration, { color: textColor + 'AA' }]}>
        {formatAudioTime(currentSeconds)}
      </ThemedText>
    </TouchableOpacity>
  );
}

function PollBubble({
  poll,
  isOwnMessage,
  onVote,
  currentUserId,
  textColor,
  bubbleBg,
}: {
  poll: any;
  isOwnMessage: boolean;
  onVote?: (id: string) => void;
  currentUserId?: string;
  textColor: string;
  bubbleBg: string;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const hasVoted = poll.options.some((opt: any) => opt.votes?.includes(currentUserId));
  const totalVotes = poll.totalVotes || 0;
  const isLightBubble = hexLuminance(bubbleBg.slice(0, 7)) > 0.45;
  const optionTextColor = isLightBubble ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)';

  return (
    <View style={styles.pollContainer}>
      <ThemedText style={[styles.pollQuestion, { color: textColor }]}>{poll.question}</ThemedText>
      <View style={styles.pollOptions}>
        {poll.options.map((option: any, index: number) => {
          const optionId = option.id || index.toString();
          const votes = option.votes?.length || 0;
          const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
          const isSelected = option.votes?.includes(currentUserId);
          const optionLabel = typeof option === 'string'
            ? option
            : (option.text || option.label || option.option || option.value || option.title || option.name || option.answer || option.content || option.choice ||
               (Object.entries(option as Record<string, unknown>).find(([k, v]) => typeof v === 'string' && (v as string).length > 0 && k !== 'id')?.[1] as string ?? ''));

          return (
            <TouchableOpacity
              key={optionId}
              style={[
                styles.pollOption,
                { backgroundColor: 'rgba(0,0,0,0.06)' },
                isSelected && { borderColor: colors.primary, borderWidth: 1 }
              ]}
              onPress={() => onVote?.(optionId)}
              activeOpacity={0.7}
            >
              <View style={[styles.pollProgress, { width: `${percentage}%`, backgroundColor: isSelected ? colors.primary + '44' : 'rgba(0,0,0,0.05)' }]} />
              <View style={styles.pollOptionContent}>
                <ThemedText style={[styles.pollOptionText, { color: optionTextColor }]}>{optionLabel}</ThemedText>
                <View style={styles.pollOptionRight}>
                  {hasVoted && (
                    <ThemedText style={[styles.pollVotes, { color: optionTextColor, opacity: 0.7 }]}>{votes}</ThemedText>
                  )}
                  {isSelected && (
                    <View style={styles.pollCheck}>
                      <BarChart3 size={14} color={colors.primary} />
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <ThemedText style={[styles.pollFooter, { color: textColor, opacity: 0.65, marginTop: 10 }]}>
        {totalVotes} {totalVotes === 1 ? (t('dm.votes.one') || 'voto') : (t('dm.votes.other') || 'votos')} • {poll.multipleAnswers ? (t('dm.poll_multiple_selection') || 'Poll Multiple Selection') : (t('dm.poll_single_selection') || 'Poll Single Selection')}
      </ThemedText>
    </View>
  );
}

function EventBubble({
  metadata,
  textColor,
}: {
  metadata: any;
  textColor: string;
}) {
  const { colors } = useTheme();

  const handlePress = () => {
    if (metadata?.eventDate) {
      router.replace(`/(tabs)/explore?tab=Calendario&highlightDay=${metadata.eventDate}` as any);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      style={styles.eventBubbleContainer}
    >
      <View style={[styles.eventIconContainer, { backgroundColor: colors.primary + '15' }]}>
        <Calendar size={20} color={colors.primary} strokeWidth={2.5} />
      </View>
      <View style={styles.eventInfo}>
        <ThemedText style={[styles.eventTitle, { color: textColor }]}>
          {metadata?.title || 'Evento'}
        </ThemedText>
        <ThemedText style={[styles.eventDate, { color: textColor, opacity: 0.7 }]}>
          {metadata?.eventDate ? new Date(metadata.eventDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : ''}
        </ThemedText>
      </View>
      <View style={styles.eventAction}>
        <ChevronRight size={18} color={textColor} opacity={0.5} />
      </View>
    </TouchableOpacity>
  );
}

export function MessageBubble({
  message,
  isOwnMessage,
  currentUserId,
  onReply,
  onLongPress,
  onDoubleTap,
  onSwipeStart,
  onSwipeEnd,
  onQuickAudioReply,
  onReplyPreviewPress,
  onSenderPress,
  highlighted,
  onVotePoll,
  onFilePress,
  showReadReceipt,
  searchHighlight,
  isStarred,
}: MessageBubbleProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const chatTheme = colors.chat;
  const settings = colors.chatSettings;

  const highlightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!highlighted) return;
    highlightAnim.setValue(1);
    Animated.timing(highlightAnim, { toValue: 0, duration: 1400, useNativeDriver: false }).start();
  }, [highlighted]);

  const lastTapRef = useRef(0);
  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) onDoubleTap?.();
    lastTapRef.current = now;
  };

  const translateX = useRef(new Animated.Value(0)).current;
  const replyIconOpacity = useRef(new Animated.Value(0)).current;

  const onSwipeStartRef = useRef(onSwipeStart);
  const onSwipeEndRef = useRef(onSwipeEnd);
  const onReplyRef = useRef(onReply);
  const messageRef = useRef(message);
  onSwipeStartRef.current = onSwipeStart;
  onSwipeEndRef.current = onSwipeEnd;
  onReplyRef.current = onReply;
  messageRef.current = message;

  const swipeGesture = useMemo(() => {
    const doStart = () => { onSwipeStartRef.current?.(); };
    const doUpdate = (dx: number) => {
      translateX.setValue(dx);
      replyIconOpacity.setValue(Math.min(dx / SWIPE_THRESHOLD, 1));
    };
    const doFinalize = (tx: number, doReply: boolean) => {
      onSwipeEndRef.current?.();
      if (doReply) onReplyRef.current?.(messageRef.current);
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
        Animated.timing(replyIconOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    };
    return Gesture.Pan()
      .activeOffsetX(5)
      .failOffsetY([-10, 10])
      .onStart(() => { runOnJS(doStart)(); })
      .onUpdate(({ translationX: tx }) => {
        runOnJS(doUpdate)(Math.min(Math.max(tx, 0), MAX_SWIPE));
      })
      .onFinalize(({ translationX: tx }, success) => {
        runOnJS(doFinalize)(tx, !!(success && tx >= SWIPE_THRESHOLD));
      });
  }, []);

  if (currentUserId && message.deletedForUsers?.includes(currentUserId)) return null;

  const audioAttachment = message.attachments?.find(a => a.type === 'audio');
  const bubbleBg = isOwnMessage ? chatTheme.bubbleOwn : chatTheme.bubbleOther;
  const textColor = isOwnMessage ? chatTheme.textOwn : chatTheme.textOther;
  const timeColor = textColor.slice(0, 7) + '99';
  const allReactions = Object.entries(message.reactions ?? {}).filter(([, users]) => (users as string[]).length > 0);

  const bubbleTouchable = (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      onLongPress={() => onLongPress(message)}
      delayLongPress={350}
      style={[
        styles.bubble,
        {
          backgroundColor: bubbleBg,
          borderBottomRightRadius: isOwnMessage ? 4 : 20,
          borderBottomLeftRadius: isOwnMessage ? 20 : 4,
          paddingHorizontal: spacing.xs + settings.fontSize,
          paddingVertical: spacing.xs + Math.round(settings.fontSize * 0.25),
        },
      ]}
    >
      {!!message.replyTo && (
        <TouchableOpacity
          activeOpacity={onReplyPreviewPress ? 0.65 : 1}
          onPress={() => onReplyPreviewPress?.(message.replyTo!.id)}
          style={[
            styles.replyPreview,
            {
              borderLeftColor: colors.primary,
              backgroundColor: isOwnMessage ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.07)',
            },
          ]}
        >
          <ThemedText style={[styles.replyPreviewName, { color: colors.primary }]}>
            {message.replyTo.senderName}
          </ThemedText>
          {message.replyTo.type === 'audio' || message.replyTo.isAudio ? (
            <View style={styles.replyPreviewAudioRow}>
              <Mic size={11} color={textColor} strokeWidth={2} />
              <ThemedText style={[styles.replyPreviewText, { color: textColor }]} numberOfLines={1}>
                {(t('dm.reply_types.audio') || 'Audio') + (message.replyTo.audioDuration ? ` (${formatAudioTime(message.replyTo.audioDuration)})` : '')}
              </ThemedText>
            </View>
          ) : message.replyTo.type === 'image' ? (
            <View style={styles.replyPreviewAudioRow}>
              <ReplyImageIcon size={11} color={textColor} strokeWidth={2} />
              <ThemedText style={[styles.replyPreviewText, { color: textColor }]} numberOfLines={1}>
                {t('dm.reply_types.image') || 'Image'}
              </ThemedText>
            </View>
          ) : message.replyTo.type === 'poll' ? (
            <View style={styles.replyPreviewAudioRow}>
              <BarChart3 size={11} color={textColor} strokeWidth={2} />
              <ThemedText style={[styles.replyPreviewText, { color: textColor }]} numberOfLines={1}>
                {t('dm.reply_types.poll') || 'Poll'}: {message.replyTo.text}
              </ThemedText>
            </View>
          ) : message.replyTo.type === 'file' ? (
            <View style={styles.replyPreviewAudioRow}>
              <FileText size={11} color={textColor} strokeWidth={2} />
              <ThemedText style={[styles.replyPreviewText, { color: textColor }]} numberOfLines={1}>
                {t('dm.reply_types.file') || 'File'}: {message.replyTo.attachmentName || message.replyTo.text}
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={[styles.replyPreviewText, { color: textColor }]} numberOfLines={1}>
              {message.replyTo.text}
            </ThemedText>
          )}
        </TouchableOpacity>
      )}

      {audioAttachment ? (
        <AudioBubble
          url={audioAttachment.url}
          duration={audioAttachment.duration ?? 0}
          bubbleBg={bubbleBg}
          textColor={textColor}
          senderPhoto={message.senderPhoto}
          senderName={message.senderName}
          onLongPress={() => onLongPress(message)}
        />
      ) : message.poll ? (
        <PollBubble
          poll={message.poll}
          isOwnMessage={isOwnMessage}
          onVote={onVotePoll}
          currentUserId={currentUserId}
          textColor={textColor}
          bubbleBg={bubbleBg}
        />
      ) : message.type === 'event' ? (
        <EventBubble
          metadata={message.metadata}
          textColor={textColor}
        />
      ) : message.attachments?.some(a => a.type === 'image') ? (
        <View style={styles.mediaContainer}>
          {message.attachments.filter(a => a.type === 'image').map((att, idx) => (
            <TouchableOpacity key={idx} activeOpacity={0.9} onLongPress={() => onLongPress(message)}>
              <Image
                source={{ uri: att.url }}
                style={[
                  styles.imageAttachment,
                  att.imageWidth && att.imageHeight ? { aspectRatio: att.imageWidth / att.imageHeight } : { height: 200, width: '100%' }
                ]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
          {message.text ? (
            <ThemedText style={[styles.messageText, { color: textColor, marginTop: spacing.xs, fontSize: settings.fontSize }]}>
              {message.text}
            </ThemedText>
          ) : null}
        </View>
      ) : message.attachments?.some(a => a.type === 'contact') ? (
        <View style={styles.contactContainer}>
          {message.attachments.filter(a => (a as any).type === 'contact').map((att: any, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.contactCard, { backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              onPress={() => router.push(`/dm/${att.userId}/profile` as any)}
            >
              {att.url ? (
                <Image source={{ uri: att.url }} style={styles.contactAvatar} />
              ) : (
                <View style={[styles.contactAvatar, { backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center' }]}>
                  <ThemedText style={{ color: colors.primary, fontWeight: 'bold' }}>{att.name[0]}</ThemedText>
                </View>
              )}
              <View style={styles.contactInfo}>
                <ThemedText style={[styles.contactName, { color: textColor }]} numberOfLines={1}>{att.name}</ThemedText>
                {att.bio ? (
                  <ThemedText style={[styles.contactBio, { color: textColor, opacity: 0.7 }]} numberOfLines={2}>
                    {att.bio}
                  </ThemedText>
                ) : (
                  <ThemedText style={[styles.contactBio, { color: textColor, opacity: 0.5 }]}>{t('roles.student') || 'Student'}</ThemedText>
                )}
              </View>
              <ChevronRight size={18} color={textColor} opacity={0.5} />
            </TouchableOpacity>
          ))}
          {message.text && !message.text.startsWith('👤') ? (
            <ThemedText style={[styles.messageText, { color: textColor, marginTop: spacing.xs, fontSize: settings.fontSize }]}>
              {message.text}
            </ThemedText>
          ) : null}
        </View>
      ) : message.attachments?.some(a => a.type === 'file') ? (
        <View style={styles.fileContainer}>
          {message.attachments.filter(a => a.type === 'file').map((att, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.fileCard, { backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}
              onPress={() => onFilePress?.(att.url, att.name)}
              onLongPress={() => onLongPress(message)}
              activeOpacity={0.75}
            >
              <View style={styles.fileIconWrap}>
                <FileText size={22} color={textColor} strokeWidth={1.8} />
              </View>
              <View style={styles.fileInfo}>
                <ThemedText style={[styles.fileName, { color: textColor }]} numberOfLines={2}>
                  {att.name}
                </ThemedText>
                {att.size > 0 && (
                  <ThemedText style={[styles.fileSize, { color: textColor, opacity: 0.65 }]}>
                    {att.size < 1024 * 1024
                      ? `${Math.round(att.size / 1024)} KB`
                      : `${(att.size / (1024 * 1024)).toFixed(1)} MB`}
                  </ThemedText>
                )}
              </View>
              <Download size={18} color={textColor} strokeWidth={1.8} opacity={0.7} />
            </TouchableOpacity>
          ))}
          {!!message.text && (
            <ThemedText style={[styles.messageText, { color: textColor, marginTop: spacing.xs, fontSize: settings.fontSize }]}>
              {message.text}
            </ThemedText>
          )}
        </View>
      ) : message.attachments?.some((a: any) => a.type === 'post') ? (
        <View>
          {message.attachments.filter((a: any) => a.type === 'post').map((att: any, idx: number) => (
            <TouchableOpacity
              key={idx}
              style={[styles.postCard, { backgroundColor: isOwnMessage ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
              onPress={() => router.push(`/post/${att.postId}` as any)}
              onLongPress={() => onLongPress(message)}
              activeOpacity={0.8}
            >
              {att.url ? (
                <Image source={{ uri: att.url }} style={styles.postCardImage} resizeMode="cover" />
              ) : null}
              <View style={styles.postCardBody}>
                <View style={styles.postCardAuthorRow}>
                  {att.postAuthorPhoto ? (
                    <Image source={{ uri: att.postAuthorPhoto }} style={styles.postCardAvatar} />
                  ) : (
                    <View style={[styles.postCardAvatar, { backgroundColor: colors.primary + '30', justifyContent: 'center', alignItems: 'center' }]}>
                      <ThemedText style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}>
                        {att.postAuthorName?.[0]?.toUpperCase() ?? '?'}
                      </ThemedText>
                    </View>
                  )}
                  <ThemedText style={[styles.postCardAuthorName, { color: textColor }]} numberOfLines={1}>
                    {att.postAuthorName}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.postCardTitle, { color: textColor }]} numberOfLines={2}>
                  {att.postTitle || att.name}
                </ThemedText>
                {att.postContent ? (
                  <ThemedText style={[styles.postCardContent, { color: textColor }]} numberOfLines={2}>
                    {att.postContent}
                  </ThemedText>
                ) : null}
              </View>
              <View style={styles.postCardFooter}>
                <ChevronRight size={14} color={textColor} opacity={0.4} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : searchHighlight && message.text ? (
        <HighlightedText
          text={message.text}
          highlight={searchHighlight}
          style={[
            styles.messageText,
            {
              color: textColor,
              fontSize: settings.fontSize,
              lineHeight: Math.round(settings.fontSize * 1.35),
              fontWeight: settings.fontWeight,
              fontStyle: settings.fontStyle,
            },
          ]}
          highlightColor={colors.primary + '55'}
        />
      ) : (
        <ThemedText
          style={[
            styles.messageText,
            {
              color: textColor,
              fontSize: settings.fontSize,
              lineHeight: Math.round(settings.fontSize * 1.35),
              fontWeight: settings.fontWeight,
              fontStyle: settings.fontStyle,
            },
          ]}
        >
          {message.text}
        </ThemedText>
      )
      }

      <View style={styles.timeRow}>
        {isStarred && <Star size={11} color="#FFD60A" fill="#FFD60A" strokeWidth={2} />}
        <ThemedText
          style={[styles.time, { color: timeColor, fontSize: Math.max(10, settings.fontSize - 4) }]}
        >
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </ThemedText>
        {showReadReceipt && isOwnMessage && (
          <View style={styles.ticks}>
            <Check size={11} color={message.status === 'read' ? colors.primary : timeColor} strokeWidth={3} />
            <View style={styles.tick2}>
              <Check size={11} color={message.status === 'read' ? colors.primary : timeColor} strokeWidth={3} />
            </View>
          </View>
        )}
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: 20,
            backgroundColor: highlightAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(100,180,255,0)', 'rgba(100,180,255,0.38)'],
            }),
          },
        ]}
      />
    </TouchableOpacity >
  );

  return (
    <GestureDetector gesture={swipeGesture}>
    <Animated.View
      style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther]}
    >
      <Animated.View style={[styles.replyIconWrap, { opacity: replyIconOpacity }]}>
        <Reply size={18} color={colors.textSecondary} strokeWidth={1.8} />
      </Animated.View>

      <Animated.View
        style={[
          styles.container,
          isOwnMessage ? styles.ownContainer : styles.otherContainer,
          { transform: [{ translateX }] },
        ]}
      >
        {!isOwnMessage && (
          <TouchableOpacity
            onPress={() => onSenderPress?.(message.senderId)}
            disabled={!onSenderPress}
            activeOpacity={0.6}
          >
            <ThemedText
              style={[
                styles.senderName,
                { color: chatTheme.nameColor },
                chatTheme.id === 'zen' && styles.senderNameZen,
              ]}
            >
              {message.senderName}
            </ThemedText>
          </TouchableOpacity>
        )}

        {audioAttachment && onQuickAudioReply ? (
          <View style={[styles.audioMessageRow, isOwnMessage && styles.audioMessageRowOwn]}>
            {bubbleTouchable}
            <TouchableOpacity
              style={[styles.quickReplyMicBtn, { backgroundColor: colors.card }]}
              onPress={() => onQuickAudioReply(message)}
              activeOpacity={0.7}
            >
              <Mic size={20} color={colors.text} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        ) : bubbleTouchable}

        {allReactions.length > 0 && (
          <View style={[styles.reactionRow, isOwnMessage ? styles.reactionOwn : styles.reactionOther]}>
            {allReactions.map(([emoji, users]) => (
              <View key={emoji} style={styles.reactionPill}>
                <ThemedText style={styles.reactionText}>
                  {emoji} {(users as string[]).length}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  replyIconWrap: { width: 28, alignItems: 'center', position: 'absolute', left: 4, zIndex: 0 },
  container: { maxWidth: '85%' },
  ownContainer: { alignItems: 'flex-end' },
  otherContainer: { alignItems: 'flex-start' },
  senderName: { fontSize: typography.sizes.xs, lineHeight: 15, marginBottom: 2, marginLeft: 12 },
  senderNameZen: { fontWeight: '700' },
  bubble: {
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.xs,
  },
  replyPreviewName: { fontSize: typography.sizes.xs, lineHeight: 14, fontWeight: '600', marginBottom: 1 },
  replyPreviewText: { fontSize: typography.sizes.xs, lineHeight: 14, opacity: 0.85 },
  messageText: { fontSize: typography.sizes.md },
  time: { fontSize: 10, lineHeight: 16, includeFontPadding: false },
  audioBubble: {
    minWidth: 220,
    gap: 4,
  },
  audioMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  audioPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  fileContainer: { gap: 4 },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: 10,
    minWidth: 200,
  },
  fileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: typography.sizes.sm, fontWeight: '600', lineHeight: 18 },
  fileSize: { fontSize: typography.sizes.xs, lineHeight: 15, marginTop: 1 },
  contactContainer: { width: 220, gap: 4 },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
  },
  contactAvatar: { width: 44, height: 44, borderRadius: 22 },
  contactInfo: { flex: 1, gap: 2 },
  contactName: { fontSize: 15, fontWeight: '700' },
  contactBio: { fontSize: 12, lineHeight: 16 },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },
  speedPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  speedText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  audioDuration: {
    fontSize: 11,
    lineHeight: 13,
    fontVariant: ['tabular-nums'],
  },
  audioAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  audioAvatarImg: {
    width: 36,
    height: 36,
  },
  audioAvatarInitial: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '700',
  },
  audioMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  audioMessageRowOwn: {
    flexDirection: 'row-reverse',
  },
  quickReplyMicBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  replyPreviewAudioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  reactionOwn: { alignSelf: 'flex-end' },
  reactionOther: { alignSelf: 'flex-start' },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reactionText: { fontSize: 12, lineHeight: 16 },
  mediaContainer: {
    width: 240,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageAttachment: {
    width: '100%',
    borderRadius: 8,
  },
  pollContainer: {
    width: 240,
    paddingVertical: 5,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  pollOptions: {
    gap: 8,
  },
  pollOption: {
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    position: 'relative',
  },
  pollProgress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  pollOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    zIndex: 1,
  },
  pollOptionText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  pollOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pollVotes: {
    fontSize: 12,
  },
  pollCheck: {
    zIndex: 2,
  },
  pollFooter: {
    fontSize: 11,
    marginTop: 10,
    textAlign: 'right',
  },
  eventBubbleContainer: {
    width: 240,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  eventIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  eventDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  eventAction: {
    paddingLeft: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 2,
    gap: 2,
  },
  ticks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tick2: {
    marginLeft: -6,
  },
  postCard: {
    width: 240,
    borderRadius: 12,
    overflow: 'hidden',
  },
  postCardImage: {
    width: '100%',
    height: 120,
  },
  postCardBody: {
    padding: 10,
    gap: 4,
  },
  postCardAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  postCardAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  postCardAuthorName: {
    fontSize: 11,
    flex: 1,
    opacity: 0.7,
  },
  postCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  postCardContent: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.7,
  },
  postCardFooter: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
});
