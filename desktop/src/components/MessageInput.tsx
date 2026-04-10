import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { Send, Plus, Mic, X, Image as ImageIcon, FileText, BarChart2, Trash2, Square, Play, Pause, Loader2, Info, Lock } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { ThemedText } from './themed-text';
import { uploadAudio, uploadMessageMedia } from '@/config/cloudinary';
import { spacing, typography } from '@/constants/styles';
import { PollModal } from './PollModal';

export interface MessageInputHandle {
  focus: () => void;
  clear: () => void;
}

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendAudio?: (url: string, duration: number) => void;
  onSendMedia?: (url: string, type: 'image' | 'video') => void;
  onSendPoll?: (poll: { question: string; options: string[]; multipleAnswers: boolean }) => void;
  replyTo?: { id: string; text: string; senderName: string, isAudio?: boolean } | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
  isDM?: boolean;
  isReadOnly?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(({
  onSend, onSendAudio, onSendMedia, onSendPoll, replyTo, onCancelReply, disabled, placeholder = "Escribe un mensaje...", isDM, isReadOnly
}, ref) => {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isStopped, setIsStopped] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPollModal, setShowPollModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);

  const chatTheme = colors.chat;
  const isDefault = chatTheme.id === 'default';
  const inputBgColor = isDefault ? colors.backgroundSecondary : `${chatTheme.bubbleOther}66`;

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    clear: () => setText('')
  }));

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      setShowMenu(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e: BlobEvent) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => { audioBlobRef.current = new Blob(audioChunksRef.current, { type: 'audio/webm' }); };
      recorder.start();
      setIsRecording(true);
      setIsStopped(false);
      setRecordDuration(0);
      timerRef.current = setInterval(() => setRecordDuration((d: number) => d + 1), 1000);
    } catch (err) {
      showAlert({ title: 'Error', message: 'No se pudo acceder al micrófono', type: 'error' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      }
      setIsRecording(false);
      setIsStopped(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      }
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setIsRecording(false);
    setIsStopped(false);
    setIsPlayingPreview(false);
    audioBlobRef.current = null;
    audioChunksRef.current = [];
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

  const handleSendAudioInternal = async () => {
    if (!audioBlobRef.current || !onSendAudio) return;
    setUploading(true);
    try {
      const file = new File([audioBlobRef.current], 'audio.webm', { type: 'audio/webm' });
      const url = await uploadAudio(file);
      onSendAudio(url, recordDuration);
      cancelRecording();
    } catch (err) {
      showAlert({ title: 'Error', message: 'Error al enviar el audio', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setShowMenu(false);
    try {
      const url = await uploadMessageMedia(file);
      if (onSendMedia) onSendMedia(url, type);
    } catch (err) {
      showAlert({ title: 'Error', message: 'Error al subir el archivo', type: 'error' });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div style={{ 
      padding: `12px ${spacing.md}px`, 
      backgroundColor: colors.card, 
      borderTop: `1px solid ${colors.border}`, 
      position: 'relative',
      zIndex: 10
    }}>
      {isReadOnly ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: '16px',
          backgroundColor: `${colors.backgroundSecondary}88`,
          backdropFilter: 'blur(8px)',
          borderRadius: 16,
          border: `1px solid ${colors.border}`,
          margin: '4px 0',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <Lock size={18} color={colors.textSecondary} />
          <ThemedText style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.textSecondary,
            textAlign: 'center'
          }}>
            Solo los administradores pueden enviar mensajes en este canal
          </ThemedText>
        </div>
      ) : (
        <>
          {replyTo && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12, 
              padding: '10px 14px', 
              backgroundColor: colors.backgroundSecondary, 
              borderRadius: 16, 
              marginBottom: 10, 
              borderLeft: `4px solid ${colors.primary}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              animation: 'slideUp 0.2s ease-out'
            }}>
              <div style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: 11, fontWeight: 800, color: colors.primary, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Respondiendo a {replyTo.senderName}</ThemedText>
                <ThemedText style={{ fontSize: 13, color: colors.text, opacity: 0.8, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{replyTo.isAudio ? '🎤 Mensaje de voz' : replyTo.text}</ThemedText>
              </div>
              <button 
                onClick={onCancelReply} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: colors.textSecondary,
                  padding: 4,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X size={18} />
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: spacing.sm, minHeight: 44 }}>
            {!isRecording && !isStopped && (
              <button 
                onClick={() => setShowMenu(!showMenu)} 
                style={{ 
                  width: 40, height: 40, borderRadius: 12, border: 'none', 
                  backgroundColor: colors.backgroundSecondary, cursor: 'pointer', 
                  color: colors.primary, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.primary + '15'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
              >
                <Plus size={22} strokeWidth={2.5} />
              </button>
            )}
            
            <div style={{ 
              flex: 1, 
              backgroundColor: colors.backgroundSecondary, 
              borderRadius: 20, 
              padding: '0 16px', 
              display: 'flex', 
              alignItems: 'center', 
              minHeight: 40,
              border: `1px solid ${colors.border}`,
              transition: 'border-color 0.2s'
            }}>
              {isRecording ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, height: 40 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#FF3B30', animation: 'pulse 1s infinite' }} />
                  <ThemedText style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{formatDuration(recordDuration)}</ThemedText>
                  <div style={{ flex: 1 }} />
                  <button onClick={cancelRecording} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30' }}><Trash2 size={20} /></button>
                  <button onClick={stopRecording} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary }}><Square size={18} fill={colors.primary} /></button>
                </div>
              ) : isStopped ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, height: 40 }}>
                  <button onClick={togglePreview} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary }}>
                    {isPlayingPreview ? <Pause size={20} fill={colors.primary} /> : <Play size={20} fill={colors.primary} />}
                  </button>
                  <ThemedText style={{ fontSize: 14, color: colors.text }}>{formatDuration(recordDuration)}</ThemedText>
                  <div style={{ flex: 1 }} />
                  <button onClick={cancelRecording} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30' }}><Trash2 size={20} /></button>
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={placeholder}
                  disabled={disabled || uploading}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: typography.sizes.md, resize: 'none', height: 'auto', maxHeight: 120, padding: '10px 0', overflowY: 'auto' }}
                />
              )}
            </div>

            {uploading ? (
              <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="animate-spin" color={colors.primary} /></div>
            ) : (text.trim() || isStopped) ? (
              <button 
                onClick={isStopped ? handleSendAudioInternal : handleSend} 
                style={{ 
                  width: 40, height: 40, borderRadius: 12, border: 'none', 
                  backgroundColor: colors.primary, color: '#fff', cursor: 'pointer', 
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 12px ${colors.primary}40`,
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Send size={18} strokeWidth={2.5} />
              </button>
            ) : (
              <button 
                onClick={startRecording} 
                style={{ 
                  width: 40, height: 40, borderRadius: 12, border: 'none', 
                  backgroundColor: colors.backgroundSecondary, color: colors.textSecondary, 
                  cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.color = colors.primary}
                onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}
              >
                <Mic size={22} />
              </button>
            )}
          </div>
        </>
      )}

      <input type="file" ref={fileInputRef} hidden accept="image/*,video/*" onChange={e => handleFileSelect(e, 'image')} />

      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
          <div style={{ position: 'absolute', bottom: '100%', left: spacing.md, backgroundColor: colors.card, borderRadius: 12, padding: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 2, zIndex: 999, minWidth: 180, marginBottom: 12, border: `1px solid ${colors.border}` }}>
            <button onClick={() => fileInputRef.current?.click()} style={menuItemStyle(colors)}><ImageIcon size={18} color={colors.primary} /> Foto o Vídeo</button>
            <button style={menuItemStyle(colors)}><FileText size={18} color={colors.primary} /> Documento</button>
            <button onClick={() => { setShowPollModal(true); setShowMenu(false); }} style={menuItemStyle(colors)}><BarChart2 size={18} color={colors.primary} /> Encuesta</button>
          </div>
        </>
      )}

      <PollModal isOpen={showPollModal} onClose={() => setShowPollModal(false)} onSend={onSendPoll!} />

      <style>{`
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
});

const menuItemStyle = (colors: any) => ({
  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, border: 'none', backgroundColor: 'transparent',
  color: colors.text, fontSize: 14, cursor: 'pointer', textAlign: 'left' as const
});
