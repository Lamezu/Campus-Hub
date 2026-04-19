import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import type { ReplyPreview } from '@/types';
import { Send, Plus, Mic, X, Image as ImageIcon, FileText, BarChart2, Trash2, Square, Play, Pause, Loader2, Info, Lock } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useAlert } from '@/contexts/AlertContext';
import { ThemedText } from './themed-text';
import { uploadAudio, uploadMessageMedia } from '@/config/cloudinary';
import { uploadChatFile } from '@/config/storage';
import { spacing, typography } from '@/constants/styles';
import { PollModal } from './PollModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { ImagePreviewModal } from './ImagePreviewModal';


export interface MessageInputHandle {
  focus: () => void;
  clear: () => void;
}

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendAudio?: (url: string, duration: number) => void;
  onSendMedia?: (url: string, type: 'image' | 'video') => void;
  onSendPoll?: (poll: { question: string; options: string[]; multipleAnswers: boolean }) => void;
  replyTo?: ReplyPreview | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  placeholder?: string;
  isDM?: boolean;
  isReadOnly?: boolean;
  onSendFile?: (url: string, name: string, size: number) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(({
  onSend, onSendAudio, onSendMedia, onSendPoll, replyTo, onCancelReply, disabled, placeholder, isDM, isReadOnly, onSendFile
}, ref) => {
  const { t } = useTranslation();
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
  const [pendingFile, setPendingFile] = useState<{ file: File; type: 'image' | 'video' | 'file' } | null>(null);
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
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
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : undefined;
      const recorder = new MediaRecorder(stream, options);
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
      showAlert({ title: t('common.error'), message: t('chat_ui.input.error_mic'), type: 'error' });
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

  const cleanupPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      }
    }
    if (timerRef.current) clearInterval(timerRef.current);
    cleanupPreview();
    setIsRecording(false);
    setIsStopped(false);
    setIsPlayingPreview(false);
    audioBlobRef.current = null;
    audioChunksRef.current = [];
  };

  const togglePreview = () => {
    if (!audioBlobRef.current) return;
    
    // Always recreate preview if ref is null (prevents stale audio bug)
    if (!previewAudioRef.current) {
      const url = URL.createObjectURL(audioBlobRef.current);
      previewAudioRef.current = new Audio(url);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
    }
    
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
    } else {
      previewAudioRef.current.play().catch(err => {
        console.error("Preview play failed:", err);
        setIsPlayingPreview(false);
      });
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
      cleanupPreview();
      cancelRecording();
    } catch (err) {
      showAlert({ title: t('common.error'), message: t('chat_ui.input.error_audio'), type: 'error' });
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const stopAndSendAudio = async () => {
    if (mediaRecorderRef.current && isRecording) {
      // 1. Stop recording
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      }
      setIsRecording(false);
      setIsStopped(true);
      if (timerRef.current) clearInterval(timerRef.current);

      // 2. We need to wait for the final blob to be ready. 
      // Since mediaRecorder.stop() is async and chunks are pushed in ondataavailable,
      // we can listen for the next 'stop' event or just rely on the fact that handleSendAudioInternal 
      // will be called after the blob is set.
      // However, to make it immediate, we can use the fact that handleSendAudioInternal 
      // already uses audioBlobRef.current.
      
      // Give a tiny bit of time for ondataavailable to finish
      setTimeout(() => {
        handleSendAudioInternal();
      }, 100);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setPendingFile({ file, type });
    setShowMenu(false);
    
    if (type === 'file') {
      setShowDocPreview(true);
    } else {
      setShowImagePreview(true);
    }
  };

  const confirmSendFile = async () => {
    if (!pendingFile) return;
    const { file, type } = pendingFile;
    
    setUploading(true);
    setShowDocPreview(false);
    setShowImagePreview(false);
    
    try {
      if (type === 'file') {
        if (onSendFile) {
          const url = await uploadChatFile(file, file.name);
          onSendFile(url, file.name, file.size);
        }
      } else if (onSendMedia) {
        const url = await uploadMessageMedia(file);
        onSendMedia(url, type);
      }
      setPendingFile(null);
    } catch (err) {
      showAlert({ title: t('common.error'), message: t('chat_ui.input.error_file'), type: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
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
            {t('chat_ui.channel_info.system_channel_disclaimer')}
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
                <ThemedText style={{ fontSize: 11, fontWeight: 800, color: colors.primary, display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>{t('chat_ui.input.reply_to', { name: replyTo.senderName })}</ThemedText>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {replyTo.type === 'image' && <ImageIcon size={14} color={colors.text} style={{ opacity: 0.6 }} />}
                  {replyTo.type === 'video' && <Play size={14} color={colors.text} style={{ opacity: 0.6 }} />}
                  {replyTo.type === 'file' && <FileText size={14} color={colors.text} style={{ opacity: 0.6 }} />}
                  {replyTo.type === 'audio' && <Mic size={14} color={colors.text} style={{ opacity: 0.6 }} />}
                  {replyTo.type === 'poll' && <BarChart2 size={14} color={colors.text} style={{ opacity: 0.6 }} />}
                  
                  <ThemedText style={{ fontSize: 13, color: colors.text, opacity: 0.8, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {replyTo.type === 'image' ? (replyTo.text || t('chat_ui.media_types.photo')) :
                     replyTo.type === 'video' ? (replyTo.text || t('chat_ui.media_types.video')) :
                     replyTo.type === 'audio' ? t('chat_ui.voice_message') :
                     replyTo.type === 'file' ? (replyTo.attachmentName || t('chat_ui.media_types.file')) :
                     replyTo.type === 'poll' ? (replyTo.text || t('chat_ui.media_types.poll')) :
                     replyTo.text}
                  </ThemedText>
                </div>
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
                  <button onClick={togglePreview} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, display: 'flex', alignItems: 'center' }}>
                    {isPlayingPreview ? <Pause size={20} fill={colors.primary} /> : <Play size={20} fill={colors.primary} />}
                  </button>
                  <ThemedText style={{ fontSize: 14, fontWeight: '600', color: colors.text }}>{formatDuration(recordDuration)}</ThemedText>
                  <div style={{ flex: 1 }} />
                  {/* Restart (Mic) Button */}
                  <button 
                    onClick={() => { cancelRecording(); startRecording(); }} 
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, opacity: 0.8 }}
                    title={t('chat_ui.input.record_again')}
                  >
                    <Mic size={20} />
                  </button>
                  <button onClick={cancelRecording} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30' }}><Trash2 size={20} /></button>
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={placeholder || t('chat_ui.search_placeholder')}
                  disabled={disabled || uploading}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: typography.sizes.md, resize: 'none', height: 'auto', maxHeight: 120, padding: '10px 0', overflowY: 'auto' }}
                />
              )}
            </div>

            {uploading ? (
              <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} className="animate-spin" color={colors.primary} /></div>
            ) : (text.trim() || isStopped || isRecording) ? (
              <button 
                onClick={isRecording ? stopAndSendAudio : (isStopped ? handleSendAudioInternal : handleSend)} 
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
      <input type="file" ref={docInputRef} hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" onChange={e => handleFileSelect(e, 'file')} />

      {showMenu && (
        <>
          <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
          <div style={{ position: 'absolute', bottom: '100%', left: spacing.md, backgroundColor: colors.card, borderRadius: 12, padding: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 2, zIndex: 999, minWidth: 180, marginBottom: 12, border: `1px solid ${colors.border}` }}>
            <button onClick={() => fileInputRef.current?.click()} style={menuItemStyle(colors)}><ImageIcon size={18} color={colors.primary} /> {t('chat_ui.plus_menu.image_video')}</button>
            <button onClick={() => docInputRef.current?.click()} style={menuItemStyle(colors)}><FileText size={18} color={colors.primary} /> {t('chat_ui.plus_menu.file')}</button>
            <button onClick={() => { setShowPollModal(true); setShowMenu(false); }} style={menuItemStyle(colors)}><BarChart2 size={18} color={colors.primary} /> {t('chat_ui.plus_menu.poll')}</button>
          </div>
        </>
      )}

      <PollModal isOpen={showPollModal} onClose={() => setShowPollModal(false)} onSend={onSendPoll!} />
      
      <DocumentPreviewModal 
        isOpen={showDocPreview} 
        onClose={() => {
          setShowDocPreview(false);
          setPendingFile(null);
          if (docInputRef.current) docInputRef.current.value = '';
        }}
        onSend={confirmSendFile}
        file={pendingFile?.type === 'file' ? pendingFile.file : null}
        loading={uploading}
      />

      <ImagePreviewModal 
        isOpen={showImagePreview}
        onClose={() => {
          setShowImagePreview(false);
          setPendingFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
        onSend={confirmSendFile}
        file={pendingFile?.type !== 'file' ? pendingFile?.file || null : null}
        type={pendingFile?.type !== 'file' ? pendingFile?.type || 'image' : 'image'}
        loading={uploading}
      />


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
