import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { X, Mic, Send } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ReplyPreview } from '../../types/index.ts';

// Inline spacing and typography values since web doesn't have the styles file
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: '400',
    semibold: '600',
    bold: 'bold',
  },
};

export interface MessageInputHandle {
  // Simplified for web - audio recording not implemented
  startRecording?: () => Promise<void>;
  startRecordingLocked?: () => Promise<void>;
}

interface MessageInputProps {
  onSend: (text: string) => void;
  onSendAudio?: (url: string, duration: number) => void;
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

  const chatTheme = colors.chat;
  const isDefault = chatTheme.id === 'default';

  const inputBgColor = isDefault
    ? colors.backgroundSecondary
    : chatTheme.bubbleOther + '66';
  const containerBgColor = isDefault ? colors.background : chatTheme.background;
  const inputTextColor = isDefault
    ? colors.text
    : getContrastForBlend(chatTheme.bubbleOther, chatTheme.background, 0.4);
  const placeholderColor = isDefault ? colors.textSecondary : inputTextColor + '80';

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      onCancelReply?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useImperativeHandle(ref, () => ({
    // Audio recording not implemented for web in this simplified version
    startRecording: async () => {
      console.warn('Audio recording not implemented for web');
      return Promise.resolve();
    },
    startRecordingLocked: async () => {
      console.warn('Audio recording not implemented for web');
      return Promise.resolve();
    },
  }));

  const hasText = !!text.trim();

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          paddingLeft: spacing.md,
          paddingRight: spacing.md,
          paddingTop: spacing.sm,
          backgroundColor: containerBgColor,
          borderTop: `1px solid ${isDefault ? colors.border : 'transparent'}`,
        }}
      >
        {replyTo && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              borderLeft: `3px solid ${colors.primary}`,
              borderRadius: 6,
              paddingLeft: spacing.sm,
              paddingRight: spacing.sm,
              paddingTop: spacing.xs,
              paddingBottom: spacing.xs,
              marginBottom: spacing.xs,
              gap: spacing.sm,
              backgroundColor: isDefault ? colors.backgroundSecondary : inputBgColor,
            }}
          >
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: typography.sizes.xs,
                  fontWeight: '600',
                  marginBottom: 2,
                  color: colors.primary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {replyTo.senderName}
              </div>
              {replyTo.isAudio ? (
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Mic size={11} color={isDefault ? colors.textSecondary : inputTextColor} strokeWidth={2} />
                  <div
                    style={{
                      fontSize: typography.sizes.xs,
                      color: isDefault ? colors.textSecondary : inputTextColor,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {'Mensaje de voz' + (replyTo.audioDuration ? ` (${formatDuration(replyTo.audioDuration)})` : '')}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: typography.sizes.xs,
                    color: isDefault ? colors.textSecondary : inputTextColor,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {replyTo.text}
                </div>
              )}
            </div>
            <button
              onClick={onCancelReply}
              style={{
                background: 'none',
                border: 'none',
                padding: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} color={isDefault ? colors.textSecondary : inputTextColor} strokeWidth={2} />
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            paddingBottom: spacing.sm,
            gap: spacing.sm,
            minHeight: 52,
          }}
        >
          <textarea
            style={{
              flex: 1,
              borderRadius: 20,
              paddingLeft: spacing.md,
              paddingRight: spacing.md,
              paddingTop: spacing.sm,
              paddingBottom: spacing.sm,
              fontSize: typography.sizes.md,
              maxHeight: 120,
              minHeight: 40,
              backgroundColor: inputBgColor,
              color: inputTextColor,
              border: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            placeholder="Escribe un mensaje..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
          />
          {hasText ? (
            <button
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexShrink: 0,
                backgroundColor: colors.primary,
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)',
              }}
              onClick={handleSend}
              disabled={disabled}
            >
              <Send size={22} color="#FFFFFF" strokeWidth={1.8} />
            </button>
          ) : (
            <button
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                flexShrink: 0,
                backgroundColor: inputBgColor,
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={() => console.warn('Audio recording not implemented for web')}
              title="Audio recording not available on web"
            >
              <Mic size={22} color={inputTextColor} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
