import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Animated, PanResponder, TouchableOpacity, Image } from 'react-native';
import { Audio } from 'expo-av';
import { Reply, Play, Pause, Mic } from 'lucide-react-native';
import { ThemedText } from './themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { Message } from '@/types';

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 80;
const SPEEDS = [1, 1.5, 2] as const;
const WAVE_BARS = [4, 8, 12, 7, 14, 6, 11, 9, 13, 5, 10, 7, 12, 5];

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  currentUserId?: string;
  onReply: (msg: Message) => void;
  onLongPress: (msg: Message) => void;
  onDoubleTap?: () => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  onQuickAudioReply?: (msg: Message) => void;
  onReplyPreviewPress?: (messageId: string) => void;
  highlighted?: boolean;
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
  const soundRef = useRef<Audio.Sound | null>(null);
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
      (status) => {
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
    } catch {}
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
    } catch {}
  };

  const cycleSpeed = async () => {
    const nextIndex = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIndex);
    if (soundRef.current) {
      try { await soundRef.current.setRateAsync(SPEEDS[nextIndex], true); } catch {}
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
              {SPEEDS[speedIndex] === 1 ? '1×' : SPEEDS[speedIndex] === 1.5 ? '1.5×' : '2×'}
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
  highlighted,
}: MessageBubbleProps) {
  const { colors } = useTheme();
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
  onSwipeStartRef.current = onSwipeStart;
  onSwipeEndRef.current = onSwipeEnd;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dx > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
      onPanResponderGrant: () => {
        onSwipeStartRef.current?.();
      },
      onPanResponderMove: (_, gs) => {
        const dx = Math.min(Math.max(gs.dx, 0), MAX_SWIPE);
        translateX.setValue(dx);
        replyIconOpacity.setValue(Math.min(dx / SWIPE_THRESHOLD, 1));
      },
      onPanResponderRelease: (_, gs) => {
        onSwipeEndRef.current?.();
        if (gs.dx >= SWIPE_THRESHOLD) onReply(message);
        Animated.parallel([
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
          Animated.timing(replyIconOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        onSwipeEndRef.current?.();
        Animated.parallel([
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
          Animated.timing(replyIconOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start();
      },
    })
  ).current;

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
          {message.replyTo.isAudio ? (
            <View style={styles.replyPreviewAudioRow}>
              <Mic size={11} color={textColor} strokeWidth={2} />
              <ThemedText style={[styles.replyPreviewText, { color: textColor }]} numberOfLines={1}>
                {'Mensaje de voz' + (message.replyTo.audioDuration ? ` (${formatAudioTime(message.replyTo.audioDuration)})` : '')}
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
      )}

      <ThemedText
        style={[styles.time, { color: timeColor, fontSize: Math.max(10, settings.fontSize - 4) }]}
      >
        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </ThemedText>

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
    </TouchableOpacity>
  );

  return (
    <View
      style={[styles.row, isOwnMessage ? styles.rowOwn : styles.rowOther]}
      {...panResponder.panHandlers}
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
          <ThemedText
            style={[
              styles.senderName,
              { color: chatTheme.nameColor },
              chatTheme.id === 'zen' && styles.senderNameZen,
            ]}
          >
            {message.senderName}
          </ThemedText>
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
    </View>
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
  time: { fontSize: 10, lineHeight: 16, includeFontPadding: false, alignSelf: 'flex-end', marginTop: 2 },
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
});
