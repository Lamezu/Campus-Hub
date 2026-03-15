import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  PanResponder,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { X, Mic, Lock, LockOpen, Trash2, ChevronLeft, ChevronUp, Play, Pause, Square, Plus, Image as ImageIcon, Camera, FileText, BarChart3 } from 'lucide-react-native';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import type { ReplyPreview } from '@/types';
import { uploadAudio, uploadChatImage, uploadChatFile, uploadChatVideo } from '@/config/cloudinary';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { PollModal } from './PollModal';

export interface MessageInputHandle {
  startRecording: () => Promise<void>;
  startRecordingLocked: () => Promise<void>;
}

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendAudio?: (url: string, duration: number) => void;
  onSendImage?: (url: string, width: number, height: number) => void;
  onSendFile?: (name: string, url: string, size: number) => void;
  onSendPoll?: (poll: { question: string; options: string[]; multipleAnswers: boolean }) => void;
  replyTo?: ReplyPreview | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').slice(0, 6);
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

function getContrastForBlend(fgHex: string, bgHex: string, alpha = 0.4): string {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const r = alpha * fg.r + (1 - alpha) * bg.r;
  const g = alpha * fg.g + (1 - alpha) * bg.g;
  const b = alpha * fg.b + (1 - alpha) * bg.b;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1C1C1E' : '#FFFFFF';
}

const LOCK_THRESHOLD = -70;
const CANCEL_THRESHOLD = -80;

const PREVIEW_BARS = [3, 6, 10, 7, 12, 5, 9, 14, 8, 6, 11, 4, 9, 7, 13, 5, 8, 10, 6, 4];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function WaveDots({ color }: { color: string }) {
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(a, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={waveDotStyles.row}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            waveDotStyles.dot,
            { backgroundColor: color, opacity: Animated.add(0.4, Animated.multiply(0.6, a)) },
          ]}
        />
      ))}
    </View>
  );
}

const waveDotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(function MessageInput({
  onSend,
  onSendAudio,
  onSendImage,
  onSendFile,
  onSendPoll,
  replyTo,
  onCancelReply,
  disabled = false,
}, ref) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');

  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewSeconds, setPreviewSeconds] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const stoppedAudioRef = useRef<{ uri: string; duration: number } | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const isLockedRef = useRef(false);
  const previewSoundRef = useRef<Audio.Sound | null>(null);
  const previewHasFinishedRef = useRef(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ uri: string, width: number, height: number } | null>(null);
  const sheetAnim = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const plusRotateAnim = useRef(new Animated.Value(0)).current;

  const lockProgressAnim = useRef(new Animated.Value(0)).current;
  const cancelProgressAnim = useRef(new Animated.Value(0)).current;
  const lockBadgeY = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const micScaleAnim = useRef(new Animated.Value(1)).current;

  const chatTheme = colors.chat;
  const isDefault = chatTheme.id === 'default';

  const openSheet = () => {
    setShowAttachmentMenu(true);
    sheetAnim.setValue(300);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 320, mass: 0.7 }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(plusRotateAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const dismissSheet = () => {
    Animated.parallel([
      Animated.timing(sheetAnim, { toValue: 300, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(plusRotateAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setShowAttachmentMenu(false));
  };

  const closeSheetImmediate = () => {
    setShowAttachmentMenu(false);
    Animated.timing(plusRotateAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  };

  const inputBgColor = isDefault
    ? colors.backgroundSecondary
    : chatTheme.bubbleOther + '66';
  const containerBgColor = isDefault ? colors.background : chatTheme.background;
  const inputTextColor = isDefault
    ? colors.text
    : getContrastForBlend(chatTheme.bubbleOther, chatTheme.background, 0.4);
  const placeholderColor = isDefault ? colors.textSecondary : inputTextColor + '80';

  useEffect(() => {
    if (isRecording && !isStopped) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.5, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => { pulse.stop(); pulseAnim.setValue(1); };
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, isStopped]);

  const startDurationTimer = () => {
    durationIntervalRef.current = setInterval(() => {
      setRecordDuration(prev => prev + 1);
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  const startRecording = async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Se necesitan permisos de micrófono para enviar audios.');
        return false;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      recordStartTimeRef.current = Date.now();
      setRecordDuration(0);
      setIsRecording(true);
      startDurationTimer();
      return true;
    } catch {
      return false;
    }
  };

  const stopRecordingRaw = async (): Promise<{ uri: string; duration: number } | null> => {
    if (!recordingRef.current) return null;
    try {
      const duration = Math.max(1, Math.round((Date.now() - recordStartTimeRef.current) / 1000));
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      stopDurationTimer();
      if (!uri) return null;
      return { uri, duration };
    } catch {
      return null;
    }
  };

  const stopPreview = async () => {
    if (previewSoundRef.current) {
      try { await previewSoundRef.current.unloadAsync(); } catch { }
      previewSoundRef.current = null;
    }
    previewHasFinishedRef.current = false;
    setIsPreviewPlaying(false);
    setPreviewProgress(0);
    setPreviewSeconds(0);
  };

  const resetAll = () => {
    setIsRecording(false);
    setIsLocked(false);
    setIsStopped(false);
    setRecordDuration(0);
    isLockedRef.current = false;
    stoppedAudioRef.current = null;
    lockProgressAnim.setValue(0);
    cancelProgressAnim.setValue(0);
    lockBadgeY.setValue(0);
  };

  const cancelRecording = async () => {
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync(); } catch { }
      recordingRef.current = null;
    }
    stopDurationTimer();
    await stopPreview();
    resetAll();
  };

  const handlePauseRecording = async () => {
    const audioData = await stopRecordingRaw();
    if (audioData) {
      stoppedAudioRef.current = audioData;
      setPreviewSeconds(audioData.duration);
      setIsStopped(true);
    }
  };

  const handleResumeRecording = async () => {
    await stopPreview();
    stoppedAudioRef.current = null;
    setIsStopped(false);
    const started = await startRecording();
    if (!started) setIsStopped(true);
  };

  const togglePreview = async () => {
    const audioData = stoppedAudioRef.current;
    if (!audioData) return;
    try {
      if (!previewSoundRef.current) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const totalMs = audioData.duration * 1000;
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioData.uri },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;
            const pos = status.positionMillis ?? 0;
            const total = status.durationMillis ?? totalMs;
            setPreviewProgress(total > 0 ? pos / total : 0);
            setPreviewSeconds(Math.max(0, Math.ceil((total - pos) / 1000)));
            if (status.didJustFinish) {
              previewHasFinishedRef.current = true;
              setIsPreviewPlaying(false);
              setPreviewProgress(0);
              setPreviewSeconds(audioData.duration);
            }
          }
        );
        previewSoundRef.current = sound;
        setIsPreviewPlaying(true);
      } else if (isPreviewPlaying) {
        await previewSoundRef.current.pauseAsync();
        setIsPreviewPlaying(false);
      } else {
        if (previewHasFinishedRef.current) {
          await previewSoundRef.current.setPositionAsync(0);
          previewHasFinishedRef.current = false;
        }
        await previewSoundRef.current.playAsync();
        setIsPreviewPlaying(true);
      }
    } catch { }
  };

  const sendAudio = async () => {
    const audioData = stoppedAudioRef.current ?? await stopRecordingRaw();
    await stopPreview();
    resetAll();
    if (!audioData || !onSendAudio) return;
    setIsUploading(true);
    try {
      const url = await uploadAudio(audioData.uri);
      onSendAudio(url, audioData.duration);
    } catch {
      alert('Error al enviar el audio.');
    } finally {
      setIsUploading(false);
    }
  };

  const micPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: async () => {
        if (isLockedRef.current) return;
        Animated.spring(micScaleAnim, { toValue: 1.2, useNativeDriver: true }).start();
        await startRecording();
      },
      onPanResponderMove: (_, gs) => {
        if (isLockedRef.current) return;

        if (gs.dy < 0) {
          const progress = Math.min(Math.abs(gs.dy) / Math.abs(LOCK_THRESHOLD), 1);
          lockProgressAnim.setValue(progress);
          lockBadgeY.setValue(Math.max(gs.dy * 0.6, LOCK_THRESHOLD * 1.2));
        }
        if (gs.dx < 0) {
          cancelProgressAnim.setValue(Math.min(Math.abs(gs.dx) / Math.abs(CANCEL_THRESHOLD), 1));
        }
        if (gs.dy < LOCK_THRESHOLD && !isLockedRef.current) {
          isLockedRef.current = true;
          lockProgressAnim.setValue(0);
          cancelProgressAnim.setValue(0);
          lockBadgeY.setValue(0);
          Animated.spring(micScaleAnim, { toValue: 1, useNativeDriver: true }).start();
          setIsLocked(true);
        }
      },
      onPanResponderRelease: (_, gs) => {
        Animated.spring(micScaleAnim, { toValue: 1, useNativeDriver: true }).start();
        lockProgressAnim.setValue(0);
        cancelProgressAnim.setValue(0);
        lockBadgeY.setValue(0);

        if (isLockedRef.current) return;

        if (gs.dx < CANCEL_THRESHOLD) {
          cancelRecording();
          return;
        }
        sendAudio();
      },
      onPanResponderTerminate: () => {
        Animated.spring(micScaleAnim, { toValue: 1, useNativeDriver: true }).start();
        lockProgressAnim.setValue(0);
        cancelProgressAnim.setValue(0);
        lockBadgeY.setValue(0);
        if (!isLockedRef.current) cancelRecording();
      },
    })
  ).current;

  const handlePickImage = async () => {
    closeSheetImmediate();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.type === 'video') {
        setIsUploading(true);
        try {
          const url = await uploadChatVideo(asset.uri);
          const name = asset.fileName || `video_${Date.now()}.mp4`;
          onSendFile?.(name, url, asset.fileSize ?? 0);
        } catch {
          alert('Error al enviar el video.');
        } finally {
          setIsUploading(false);
        }
      } else {
        const { uri, width, height } = asset;
        setPreviewImage({ uri, width: width ?? 0, height: height ?? 0 });
      }
    }
  };

  const handleTakePhoto = async () => {
    closeSheetImmediate();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Se necesitan permisos de cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0].uri) {
      const { uri, width, height } = result.assets[0];
      setPreviewImage({ uri, width, height });
    }
  };

  const handleSendImageConfirm = async () => {
    if (!previewImage) return;
    setIsUploading(true);
    const { uri, width, height } = previewImage;
    setPreviewImage(null);
    try {
      const url = await uploadChatImage(uri);
      onSendImage?.(url, width, height);
    } catch (error) {
      console.error('Error sending image:', error);
      alert('Error al enviar la imagen');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickFile = async () => {
    closeSheetImmediate();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          'text/csv',
          'application/zip',
          'application/x-zip-compressed',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0].uri) {
        const asset = result.assets[0];
        setIsUploading(true);
        try {
          const url = await uploadChatFile(asset.uri, asset.name, asset.mimeType || undefined);
          onSendFile?.(asset.name, url, asset.size || 0);
        } catch {
          alert('Error al subir el archivo');
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenPoll = () => {
    dismissSheet();
    setTimeout(() => setShowPollModal(true), 250);
  };

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      onCancelReply?.();
    }
  };

  useImperativeHandle(ref, () => ({
    startRecording: async () => {
      if (!isRecording && !isStopped) {
        await startRecording();
      }
    },
    startRecordingLocked: async () => {
      if (!isRecording && !isStopped) {
        const success = await startRecording();
        if (success) {
          isLockedRef.current = true;
          setIsLocked(true);
        }
      }
    },
  }));

  const hasText = !!text.trim();

  return (
    <View style={styles.outerContainer}>
      {isRecording && !isLocked && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.lockBadge,
            { backgroundColor: colors.primary },
            {
              opacity: Animated.add(0.65, Animated.multiply(0.35, lockProgressAnim)),
              transform: [
                { scale: Animated.add(0.82, Animated.multiply(0.18, lockProgressAnim)) },
                { translateY: lockBadgeY },
              ],
            },
          ]}
        >
          <ChevronUp size={14} color="#FFFFFF" strokeWidth={2.5} />
          <LockOpen size={20} color="#FFFFFF" strokeWidth={2} />
        </Animated.View>
      )}
      {isRecording && isLocked && (
        <View style={[styles.lockBadge, { backgroundColor: colors.primary }]} pointerEvents="none">
          <Lock size={26} color="#FFFFFF" strokeWidth={2} />
        </View>
      )}

      <View
        style={[
          styles.container,
          {
            backgroundColor: containerBgColor,
            borderTopColor: isDefault ? colors.border : 'transparent',
            paddingBottom: Platform.OS === 'ios'
              ? Math.max(insets.bottom - 20, 4)
              : Math.max(insets.bottom, spacing.sm),
          },
        ]}
      >
        {replyTo && !isRecording && !isLocked && (
          <View
            style={[
              styles.replyBar,
              {
                borderLeftColor: colors.primary,
                backgroundColor: isDefault ? colors.backgroundSecondary : inputBgColor,
              },
            ]}
          >
            <View style={styles.replyBarContent}>
              <ThemedText style={[styles.replyBarName, { color: colors.primary }]} numberOfLines={1}>
                {replyTo.senderName}
              </ThemedText>
              <View style={styles.replyBarAudioRow}>
                {replyTo.type === 'audio' || replyTo.isAudio ? (
                  <>
                    <Mic size={11} color={isDefault ? colors.textSecondary : inputTextColor} strokeWidth={2} />
                    <ThemedText
                      style={[styles.replyBarText, { color: isDefault ? colors.textSecondary : inputTextColor }]}
                      numberOfLines={1}
                    >
                      {'Mensaje de voz' + (replyTo.audioDuration ? ` (${formatDuration(replyTo.audioDuration)})` : '')}
                    </ThemedText>
                  </>
                ) : replyTo.type === 'image' ? (
                  <>
                    <ImageIcon size={11} color={isDefault ? colors.textSecondary : inputTextColor} strokeWidth={2} />
                    <ThemedText
                      style={[styles.replyBarText, { color: isDefault ? colors.textSecondary : inputTextColor }]}
                      numberOfLines={1}
                    >
                      Imagen
                    </ThemedText>
                  </>
                ) : replyTo.type === 'poll' ? (
                  <>
                    <BarChart3 size={11} color={isDefault ? colors.textSecondary : inputTextColor} strokeWidth={2} />
                    <ThemedText
                      style={[styles.replyBarText, { color: isDefault ? colors.textSecondary : inputTextColor }]}
                      numberOfLines={1}
                    >
                      Encuesta: {replyTo.text}
                    </ThemedText>
                  </>
                ) : replyTo.type === 'file' ? (
                  <>
                    <FileText size={11} color={isDefault ? colors.textSecondary : inputTextColor} strokeWidth={2} />
                    <ThemedText
                      style={[styles.replyBarText, { color: isDefault ? colors.textSecondary : inputTextColor }]}
                      numberOfLines={1}
                    >
                      Archivo: {replyTo.attachmentName || replyTo.text}
                    </ThemedText>
                  </>
                ) : (
                  <ThemedText
                    style={[styles.replyBarText, { color: isDefault ? colors.textSecondary : inputTextColor }]}
                    numberOfLines={1}
                  >
                    {replyTo.text}
                  </ThemedText>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onCancelReply} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={20} color={isDefault ? colors.textSecondary : inputTextColor} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}

        {isUploading ? (
          <View style={styles.inputRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <ThemedText style={[styles.uploadingText, { color: colors.textSecondary }]}>
              Enviando...
            </ThemedText>
          </View>

        ) : isLocked ? (
          isStopped ? (
            <>
              <View style={[styles.previewPlayer, { backgroundColor: inputBgColor }]}>
                <TouchableOpacity
                  onPress={togglePreview}
                  style={[styles.previewPlayerBtn, { backgroundColor: colors.primary }]}
                  activeOpacity={0.8}
                >
                  {isPreviewPlaying
                    ? <Pause size={20} color="#FFFFFF" strokeWidth={2} />
                    : <Play size={20} color="#FFFFFF" strokeWidth={2} fill="#FFFFFF" />
                  }
                </TouchableOpacity>

                <View style={[styles.previewPlayerDot, { backgroundColor: colors.primary }]} />

                <View style={styles.previewWaveform}>
                  {PREVIEW_BARS.map((h, i) => {
                    const played = (i / PREVIEW_BARS.length) < previewProgress;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.previewBar,
                          {
                            height: h * 2,
                            backgroundColor: played ? colors.primary : colors.textSecondary + '55',
                          },
                        ]}
                      />
                    );
                  })}
                </View>

                <ThemedText style={[styles.previewPlayerTimer, { color: colors.text }]}>
                  {formatDuration(previewSeconds)}
                </ThemedText>
              </View>

              <View style={styles.inputRow}>
                <TouchableOpacity onPress={cancelRecording} style={styles.iconBtn}>
                  <Trash2 size={22} color="#FF3B30" strokeWidth={1.8} />
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                  onPress={handleResumeRecording}
                  style={[styles.micButtonIdle, { backgroundColor: inputBgColor }]}
                >
                  <Mic size={22} color={inputTextColor} strokeWidth={1.8} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendButtonLarge, { backgroundColor: colors.primary }]}
                  onPress={sendAudio}
                  activeOpacity={0.75}
                >
                  <Ionicons name="paper-plane" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.inputRow}>
              <TouchableOpacity onPress={cancelRecording} style={styles.iconBtn}>
                <Trash2 size={22} color="#FF3B30" strokeWidth={1.8} />
              </TouchableOpacity>

              <View style={styles.timerRow}>
                <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
                <ThemedText style={[styles.recordTimer, { color: colors.text }]}>
                  {formatDuration(recordDuration)}
                </ThemedText>
                <WaveDots color={colors.textSecondary} />
              </View>

              <TouchableOpacity
                onPress={handlePauseRecording}
                style={[styles.stopBtn, { borderColor: colors.primary }]}
              >
                <Square size={14} color={colors.primary} strokeWidth={2} fill={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sendButtonLarge, { backgroundColor: colors.primary }]}
                onPress={sendAudio}
                activeOpacity={0.75}
              >
                <Ionicons name="paper-plane" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )

        ) : isRecording ? (
          <View style={styles.inputRow}>
            <Animated.View style={[styles.cancelHint, { opacity: Animated.add(0.38, Animated.multiply(0.62, cancelProgressAnim)) }]}>
              <ChevronLeft size={15} color={colors.textSecondary} strokeWidth={2.5} />
              <ThemedText style={[styles.cancelHintText, { color: colors.textSecondary }]}>
                Cancelar
              </ThemedText>
            </Animated.View>

            <View style={styles.timerRow}>
              <Animated.View style={[styles.recordDot, { transform: [{ scale: pulseAnim }] }]} />
              <ThemedText style={[styles.recordTimer, { color: colors.text }]}>
                {formatDuration(recordDuration)}
              </ThemedText>
            </View>

            <Animated.View
              {...micPanResponder.panHandlers}
              style={[
                styles.micButtonActive,
                { backgroundColor: '#FF3B30' },
                { transform: [{ scale: micScaleAnim }] },
              ]}
            >
              <Mic size={22} color="#FFFFFF" strokeWidth={1.8} />
            </Animated.View>
          </View>

        ) : (
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[styles.plusButton, { backgroundColor: inputBgColor }]}
              onPress={() => showAttachmentMenu ? dismissSheet() : openSheet()}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ rotate: plusRotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
                <Plus size={24} color={inputTextColor} strokeWidth={2.5} />
              </Animated.View>
            </TouchableOpacity>

            <TextInput
              style={[styles.input, { backgroundColor: inputBgColor, color: inputTextColor }]}
              placeholder="Escribe un mensaje..."
              placeholderTextColor={placeholderColor}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={5000}
              editable={!disabled}
            />
            {hasText ? (
              <TouchableOpacity
                style={[styles.sendButtonLarge, { backgroundColor: colors.primary }, disabled && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={disabled}
                activeOpacity={0.75}
              >
                <Ionicons name="paper-plane" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <Animated.View
                {...micPanResponder.panHandlers}
                style={[
                  styles.micButtonIdle,
                  { backgroundColor: inputBgColor },
                  { transform: [{ scale: micScaleAnim }] },
                ]}
              >
                <Mic size={22} color={inputTextColor} strokeWidth={1.8} />
              </Animated.View>
            )}
          </View>
        )}
      </View>

      <Modal
        transparent
        visible={showAttachmentMenu}
        animationType="none"
        statusBarTranslucent
        onRequestClose={dismissSheet}
      >
        <View style={styles.sheetBackdrop}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: '#000',
                opacity: backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }),
              },
            ]}
            pointerEvents="none"
          />
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={dismissSheet} />
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                backgroundColor: containerBgColor,
                transform: [{ translateY: sheetAnim }],
                paddingBottom: insets.bottom > 0 ? insets.bottom : 16,
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetGrid}>
              <TouchableOpacity style={styles.sheetItem} onPress={handlePickImage} activeOpacity={0.75}>
                <View style={[styles.sheetIconBox, { backgroundColor: '#5856D6' }]}>
                  <ImageIcon size={28} color="#FFF" strokeWidth={1.8} />
                </View>
                <ThemedText style={[styles.sheetItemLabel, { color: colors.text }]}>Fotos</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={handleTakePhoto} activeOpacity={0.75}>
                <View style={[styles.sheetIconBox, { backgroundColor: '#FF9500' }]}>
                  <Camera size={28} color="#FFF" strokeWidth={1.8} />
                </View>
                <ThemedText style={[styles.sheetItemLabel, { color: colors.text }]}>Cámara</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={handlePickFile} activeOpacity={0.75}>
                <View style={[styles.sheetIconBox, { backgroundColor: '#007AFF' }]}>
                  <FileText size={28} color="#FFF" strokeWidth={1.8} />
                </View>
                <ThemedText style={[styles.sheetItemLabel, { color: colors.text }]}>Documento</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetItem} onPress={handleOpenPoll} activeOpacity={0.75}>
                <View style={[styles.sheetIconBox, { backgroundColor: '#FF2D55' }]}>
                  <BarChart3 size={28} color="#FFF" strokeWidth={1.8} />
                </View>
                <ThemedText style={[styles.sheetItemLabel, { color: colors.text }]}>Encuesta</ThemedText>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <PollModal
        visible={showPollModal}
        onClose={() => setShowPollModal(false)}
        onSend={(poll) => {
          onSendPoll?.(poll);
          setShowPollModal(false);
        }}
      />

      <Modal animationType="fade" transparent visible={!!previewImage} onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.previewModalOverlay}>
          <View style={styles.previewModalHeader}>
            <TouchableOpacity onPress={() => setPreviewImage(null)} style={styles.previewModalClose}>
              <X size={28} color="#FFF" />
            </TouchableOpacity>
          </View>
          {previewImage && (
            <Image source={{ uri: previewImage.uri }} style={styles.previewModalImage} resizeMode="contain" />
          )}
          <View style={styles.previewModalFooter}>
            <TouchableOpacity
              onPress={handleSendImageConfirm}
              style={[styles.confirmSendBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="send" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
});

const BADGE_SIZE = 58;

const styles = StyleSheet.create({
  outerContainer: {},
  lockBadge: {
    position: 'absolute',
    right: 12,
    bottom: 130,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10,
  },
  container: {
    flexDirection: 'column',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    gap: spacing.xs + 4,
    minHeight: 52,
  },
  plusButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 6,
    fontSize: typography.sizes.md,
    maxHeight: 120,
    minHeight: 40,
  },
  sendButtonLarge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: { opacity: 0.4 },
  micButtonActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  micButtonIdle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stopBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  timerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recordDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
  },
  recordTimer: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  cancelHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    position: 'absolute',
    left: 0,
    zIndex: 1,
  },
  cancelHintText: {
    fontSize: typography.sizes.sm,
  },
  uploadingText: {
    fontSize: typography.sizes.sm,
    marginLeft: spacing.xs,
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  replyBarContent: { flex: 1 },
  replyBarAudioRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyBarName: { fontSize: typography.sizes.xs, fontWeight: '600', marginBottom: 2 },
  replyBarText: { fontSize: typography.sizes.xs },
  previewPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  previewPlayerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  previewPlayerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  previewPlayerTimer: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
  previewWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 36,
  },
  previewBar: {
    flex: 1,
    borderRadius: 2,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(120,120,128,0.3)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 8,
  },
  sheetItem: {
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sheetIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  sheetItemLabel: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  previewModalOverlay: {
    flex: 1,
    backgroundColor: '#000',
  },
  previewModalHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
  },
  previewModalClose: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewModalImage: {
    flex: 1,
    width: '100%',
  },
  previewModalFooter: {
    height: 100,
    paddingBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmSendBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
