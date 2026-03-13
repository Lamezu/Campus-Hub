import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Send, X, Mic, Square, Trash2, Play, Pause, RefreshCcw } from 'lucide-react';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from './themed-text';
import type { ReplyPreview } from '@/types';
import { uploadAudio } from '@/config/cloudinary';
import { AlertModal } from './AlertModal';

export interface MessageInputHandle {
  startRecording: () => Promise<void>;
  startRecordingLocked: () => Promise<void>;
}

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendAudio?: (url: string, duration: number) => void;
  replyTo?: ReplyPreview | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(function MessageInput({
  onSend,
  onSendAudio,
  replyTo,
  onCancelReply,
  disabled = false,
}, ref) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setAlertConfig({ isOpen: true, title, message, type });
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const chatTheme = colors.chat;
  const isDefault = chatTheme.id === 'default';

  const inputBgColor = isDefault ? colors.backgroundSecondary : `${chatTheme.bubbleOther}66`;
  const containerBgColor = isDefault ? colors.background : chatTheme.background;
  
  // Decide text color based on chat theme brightness
  // Only 'gamer' (isDark) should have white text in the input bar
  const inputTextColor = chatTheme.isDark ? '#FFFFFF' : '#1C1C1E';
  const placeholderColor = chatTheme.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)';

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Attempt to focus when component mounts or reply state changes
    if (textareaRef.current && !isRecording && !isStopped) {
      textareaRef.current.focus();
    }
  }, [replyTo, isRecording, isStopped]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlobRef.current = audioBlob;
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting recording:', err);
      showAlert('Micrófono', 'No se pudo acceder al micrófono.', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setIsStopped(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setIsRecording(false);
    setIsStopped(false);
    setIsPlayingPreview(false);
    setRecordDuration(0);
    audioBlobRef.current = null;
    audioChunksRef.current = [];
  };

  const handleSendAudio = async () => {
    if (!audioBlobRef.current || !onSendAudio) return;
    setIsUploading(true);
    try {
      const file = new File([audioBlobRef.current], 'audio.webm', { type: 'audio/webm' });
      const url = await uploadAudio(file);
      onSendAudio(url, recordDuration);
      cancelRecording();
    } catch (err) {
      console.error('Error uploading audio:', err);
      showAlert('Error', 'Error al enviar el audio.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const togglePreview = () => {
    if (!audioBlobRef.current) return;
    if (!previewAudioRef.current) {
      const url = URL.createObjectURL(audioBlobRef.current);
      previewAudioRef.current = new Audio(url);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
    }

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
    } else {
      previewAudioRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  };

  const handleSendText = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      onCancelReply?.();
      // Refocus after sending
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  useImperativeHandle(ref, () => ({
    startRecording: async () => {
      await startRecording();
    },
    startRecordingLocked: async () => {
      await startRecording();
    },
  }));

  return (
    <div style={{
      padding: `${spacing.sm}px ${spacing.md}px`,
      backgroundColor: containerBgColor,
      borderTop: isDefault ? `1px solid ${colors.border}` : 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: spacing.xs,
    }}>
      {/* Reply Bar */}
      {replyTo && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.sm,
          padding: '8px 12px',
          backgroundColor: inputBgColor,
          borderRadius: 8,
          borderLeft: `3px solid ${colors.primary}`,
        }}>
          <div style={{ flex: 1 }}>
            <ThemedText style={{ fontSize: 12, fontWeight: 'bold', color: colors.primary, display: 'block' }}>{replyTo.senderName}</ThemedText>
            <ThemedText style={{ fontSize: 12, color: inputTextColor, opacity: 0.7, display: 'block' }}>
              {replyTo.isAudio ? '🎤 Mensaje de voz' : replyTo.text}
            </ThemedText>
          </div>
          <button onClick={onCancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', color: inputTextColor }}>
            <X size={18} />
          </button>
        </div>
      )}

      {/* Input Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minHeight: 48 }}>
        {isRecording ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, backgroundColor: inputBgColor, borderRadius: 24, padding: '0 16px', height: 40 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FF3B30', animation: 'pulse 1s infinite' }} />
            <ThemedText style={{ fontSize: 14, fontWeight: '600', color: inputTextColor }}>{formatDuration(recordDuration)}</ThemedText>
            <div style={{ flex: 1 }} />
            <button onClick={cancelRecording} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30' }}>
              <Trash2 size={20} />
            </button>
            <button onClick={stopRecording} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary }}>
              <Square size={18} fill={colors.primary} />
            </button>
          </div>
        ) : isStopped ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, backgroundColor: inputBgColor, borderRadius: 24, padding: '0 16px', height: 40 }}>
            <button onClick={togglePreview} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary }}>
              {isPlayingPreview ? <Pause size={20} fill={colors.primary} /> : <Play size={20} fill={colors.primary} />}
            </button>
            <ThemedText style={{ fontSize: 14, color: inputTextColor }}>{formatDuration(recordDuration)}</ThemedText>
            <div style={{ flex: 1 }} />
            <button 
              onClick={() => { cancelRecording(); startRecording(); }} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: chatTheme.isDark ? 'rgba(255,255,255,0.7)' : colors.textSecondary }}
              title="Volver a grabar"
            >
              <RefreshCcw size={18} />
            </button>
            <button onClick={cancelRecording} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30' }}>
              <Trash2 size={20} />
            </button>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText(); } }}
            placeholder="Escribe un mensaje..."
            style={{
              flex: 1,
              borderRadius: 20,
              padding: '10px 16px',
              backgroundColor: inputBgColor,
              color: inputTextColor,
              border: 'none',
              outline: 'none',
              resize: 'none',
              minHeight: 20,
              maxHeight: 120,
              fontSize: typography.sizes.md,
              fontFamily: 'Inter, sans-serif',
            }}
          />
        )}

        {isUploading ? (
          <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 20, height: 20, border: `2px solid ${colors.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : text.trim() ? (
          <button
            onClick={handleSendText}
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              backgroundColor: colors.primary, color: '#FFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'opacity 0.2s'
            }}
          >
            <Send size={20} />
          </button>
        ) : (
          <button
            onClick={isStopped ? handleSendAudio : startRecording}
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              backgroundColor: isRecording || isStopped ? colors.primary : inputBgColor,
              color: isRecording || isStopped ? '#FFF' : colors.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {isStopped ? <Send size={20} /> : <Mic size={22} />}
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
});
