import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { Plus, X } from 'lucide-react';
import type { ChatTheme } from '../../contexts/ThemeContext';
import ChatBackgroundEditor from '../../components/chat/ChatBackgroundEditor';
import { useTranslation } from '../../hooks/useTranslation';

export default function ThemeSettings() {
  const navigate = useNavigate();
  const { colors, chatThemes, customChatThemes, chatSettings, setChatSettings, addCustomChatTheme, deleteCustomChatTheme } = useTheme();

  const fileRef = useRef<HTMLInputElement>(null);
  const [editorVisible, setEditorVisible] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const { t } = useTranslation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setSelectedImageUrl(ev.target?.result as string);
      setEditorVisible(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveCustomTheme = (themeId: string, offsetX: number, offsetY: number, scale: number) => {
    if (!selectedImageUrl) return;
    const baseTheme = chatThemes.default;
    const newTheme: ChatTheme = {
      ...baseTheme,
      id: themeId,
      name: 'Personalizado',
      backgroundImage: selectedImageUrl,
      background: 'transparent',
      offsetX,
      offsetY,
      scale,
    };
    addCustomChatTheme(newTheme);
    setChatSettings({ themeId });
    setEditorVisible(false);
    setSelectedImageUrl(null);
  };

  const allThemes = [...Object.values(chatThemes), ...customChatThemes];

  return (
    <div className="chat-loading-container">
      <div className="chat-header">
        <button className="chat-back-button" onClick={() => navigate(-1)}>←</button>
        <h1 className="chat-header-title">{t('theme.title')}</h1>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        <div className="settings-section">
          <h2 className="settings-section-title">{t('theme.chat_themes')}</h2>
          <p className="text-subtitle" style={{ marginBottom: '16px' }}>
            {t('theme.chat_themes_desc')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                padding: '16px',
                borderRadius: '16px',
                border: `2px dashed ${colors.border}`,
                backgroundColor: colors.backgroundSecondary,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                minHeight: '120px',
              }}
            >
              <Plus size={28} color={colors.textSecondary} strokeWidth={1.8} />
              <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 500 }}>
                {t('common.custom')}
              </span>
            </button>

            {allThemes.map((chatTheme) => {
              const isCustom = chatTheme.id.startsWith('custom_');
              const isSelected = chatSettings.themeId === chatTheme.id;
              return (
                <div key={chatTheme.id} style={{ position: 'relative' }}>
                  <button
                    onClick={() => setChatSettings({ themeId: chatTheme.id })}
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '16px',
                      border: isSelected ? `3px solid ${colors.primary}` : '1px solid var(--border)',
                      backgroundColor: chatTheme.background === 'transparent' ? colors.background : chatTheme.background,
                      backgroundImage: chatTheme.backgroundImage && !isCustom ? `url(${chatTheme.backgroundImage})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: `${chatTheme.offsetX || 0}px ${chatTheme.offsetY || 0}px`,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      minHeight: '120px',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {isCustom && chatTheme.backgroundImage && (
                      <img
                        src={chatTheme.backgroundImage}
                        alt=""
                        draggable={false}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          transform: `translate(${(chatTheme.offsetX || 0) * 0.3}px, ${(chatTheme.offsetY || 0) * 0.3}px) scale(${chatTheme.scale || 1})`,
                          transformOrigin: 'center',
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {chatTheme.backgroundImage && !isCustom && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(2px)' }} />
                    )}
                    <span style={{ fontSize: '15px', fontWeight: 600, position: 'relative', zIndex: 1, color: colors.text, textShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
                      {chatTheme.name}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '14px', backgroundColor: chatTheme.bubbleOwn, boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
                      <div style={{ width: '28px', height: '28px', borderRadius: '14px', backgroundColor: chatTheme.bubbleOther, boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} />
                    </div>
                  </button>

                  {isCustom && (
                    <button
                      onClick={() => deleteCustomChatTheme(chatTheme.id)}
                      style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}
                    >
                      <X size={12} color="#fff" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">{t('theme.font_settings')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="settings-label">{t('theme.font_size')}</label>
              <input
                type="range"
                min="12"
                max="20"
                value={chatSettings.fontSize}
                onChange={(e) => setChatSettings({ fontSize: parseInt(e.target.value) })}
                style={{ width: '100%', marginTop: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-subtitle">12px</span>
                <span className="text-subtitle">{chatSettings.fontSize}px</span>
                <span className="text-subtitle">20px</span>
              </div>
            </div>

            <div>
              <label className="settings-label">{t('theme.font_weight')}</label>
              <select
                value={chatSettings.fontWeight}
                onChange={(e) => setChatSettings({ fontWeight: e.target.value as any })}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text)', marginTop: '8px' }}
              >
                <option value="400">{t('theme.font_normal')}</option>
                <option value="600">{t('theme.font_semibold')}</option>
                <option value="bold">{t('theme.font_bold')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {editorVisible && selectedImageUrl && (
        <ChatBackgroundEditor
          imageUrl={selectedImageUrl}
          onClose={() => { setEditorVisible(false); setSelectedImageUrl(null); }}
          onSave={handleSaveCustomTheme}
        />
      )}
    </div>
  );
}
