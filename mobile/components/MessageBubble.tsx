import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Animated, PanResponder, TouchableOpacity } from 'react-native';
import { Audio } from 'expo-av';
import { Reply, Play, Pause, Mic } from 'lucide-react-native';
import { ThemedText } from './themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { Message } from '@/types';

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 80;

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  currentUserId?: string;
  onReply: (msg: Message) => void;
  onLongPress: (msg: Message) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
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

const WAVE_BARS =[3, 6, 10, 7, 12, 5, 9, 14, 8, 6, 11, 4, 9, 7, 13, 5, 8, 10, 6, 4];

function AudioBubble({
  url,
  duration,
  bubbleBg,
  textColor,
}: {
  url: string;
  duration: number;
  bubbleBg: string;
  textColor: string;
}) {
  const { colors } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(duration);
  const soundRef = useRef<Audio.Sound | null>(null);
  const hasFinishedRef = useRef(false);
  const totalMs = duration * 1000;

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, []);

  const togglePlay = async () => {
    try {
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: true },
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

  const bubbleLum = hexLuminance(bubbleBg.slice(0, 7));
  const isLightBubble = bubbleLum > 0.45;
  const playBtnBg = isLightBubble ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)';
  const playBtnBorder = isLightBubble ? 'rgba(0,0,0,0.38)' : 'rgba(255,255,255,0.45)';
  const barColor = textColor;

  return (
    <View style={styles.audioBubble}>
      <TouchableOpacity onPress={togglePlay} style={[styles.audioPlayBtn, { backgroundColor: playBtnBg, borderWidth: 1.5, borderColor: playBtnBorder }]} activeOpacity={0.7}>
        {isPlaying
          ? <Pause size={16} color={textColor} strokeWidth={2} />
          : <Play size={16} color={textColor} strokeWidth={2} fill={textColor} />
        }
      </TouchableOpacity>

      <View style={styles.waveform}>
        {WAVE_BARS.map((h, i) => {
          const barFrac = i / WAVE_BARS.length;
          const played = barFrac < progress;
          return (
            <View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: h,
                  backgroundColor: played ? barColor : barColor + '55',
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.audioMeta}>
        <Mic size={11} color={textColor + '99'} strokeWidth={1.8} />
        <ThemedText style={[styles.audioDuration, { color: textColor + 'CC' }]}>
          {formatAudioTime(currentSeconds)}
        </ThemedText>
      </View>
    </View>
  );
}

export function MessageBubble({
  message,
  isOwnMessage,
  currentUserId,
  onReply,
  onLongPress,
  onSwipeStart,
  onSwipeEnd,
}: MessageBubbleProps) {
  const { colors } = useTheme();
  const chatTheme = colors.chat;
  const settings = colors.chatSettings;

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

        <TouchableOpacity
          activeOpacity={0.85}
          onLongPress={() => onLongPress(message)}
          delayLongPress={350}
          style={[
            styles.bubble,
            {
              backgroundColor: bubbleBg,
              borderBottomRightRadius: isOwnMessage ? 4 : 20,
              borderBottomLeftRadius: isOwnMessage ? 20 : 4,
            },
          ]}
        >
          {!!message.replyTo && (
            <View
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
              <ThemedText style={[styles.replyPreviewText, { color: textColor }]} numberOfLines={1}>
                {message.replyTo.text}
              </ThemedText>
            </View>
          )}

          {audioAttachment ? (
            <AudioBubble
              url={audioAttachment.url}
              duration={audioAttachment.duration ?? 0}
              bubbleBg={bubbleBg}
              textColor={textColor}
            />
          ) : (
            <ThemedText
              style={[
                styles.messageText,
                {
                  color: textColor,
                  fontSize: settings.fontSize,
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
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  replyIconWrap: { width: 28, alignItems: 'center', position: 'absolute', left: 4, zIndex: 0 },
  container: { maxWidth: '80%' },
  ownContainer: { alignItems: 'flex-end' },
  otherContainer: { alignItems: 'flex-start' },
  senderName: { fontSize: typography.sizes.xs, marginBottom: 4, marginLeft: 12 },
  senderNameZen: { fontWeight: '700' },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  replyPreviewName: { fontSize: typography.sizes.xs, fontWeight: '600', marginBottom: 2 },
  replyPreviewText: { fontSize: typography.sizes.xs, opacity: 0.85 },
  messageText: { fontSize: typography.sizes.md },
  time: { fontSize: 10, alignSelf: 'flex-end', marginTop: 2 },
  // Audio bubble
  audioBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 180,
  },
  audioPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 28,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
    flex: 0,
  },
  audioMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  audioDuration: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
});
