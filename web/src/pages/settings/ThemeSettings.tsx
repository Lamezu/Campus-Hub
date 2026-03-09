import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

export default function ThemeSettings() {
  const navigate = useNavigate();
  const { theme, colors, setTheme, chatThemes, chatSettings, setChatSettings } = useTheme();

  const appThemes = [
    { id: 'light', name: 'Light', color: '#FFFFFF' },
    { id: 'dark', name: 'Dark', color: '#1C1C1E' },
    { id: 'pastel', name: 'Pastel', color: '#EEE8FA' },
    { id: 'high-contrast', name: 'High Contrast', color: '#000000' },
  ];

  return (
    <div className="chat-loading-container">
      <div className="chat-header">
        <button
          className="chat-back-button"
          onClick={() => navigate(-1)}
        >
          ←
        </button>
        <h1 className="chat-header-title">Theme Settings</h1>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        <div className="settings-section">
          <h2 className="settings-section-title">App Theme</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {appThemes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as any)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '24px',
                  border: theme === t.id ? `2px solid ${colors.primary}` : '1px solid var(--border)',
                  backgroundColor: t.color,
                  color: t.id === 'dark' || t.id === 'high-contrast' ? '#FFFFFF' : '#000000',
                  cursor: 'pointer',
                  flex: 1,
                  minWidth: '100px',
                  fontWeight: theme === t.id ? 'bold' : 'normal'
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">Chat Themes</h2>
          <p className="text-subtitle" style={{ marginBottom: '16px' }}>
            Personaliza el aspecto de tus conversaciones
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {Object.values(chatThemes).map((chatTheme) => (
              <button
                key={chatTheme.id}
                onClick={() => setChatSettings({ themeId: chatTheme.id })}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: chatSettings.themeId === chatTheme.id ? `3px solid ${colors.primary}` : '1px solid var(--border)',
                  backgroundColor: chatTheme.background,
                  backgroundImage: chatTheme.backgroundImage ? `url(${chatTheme.backgroundImage})` : 'none',
                  backgroundSize: 'cover',
                  color: '#000000',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  minHeight: '120px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {chatTheme.backgroundImage && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(2px)'
                  }} />
                )}
                <span style={{ 
                  fontSize: '16px', 
                  fontWeight: 'bold',
                  position: 'relative',
                  zIndex: 1,
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}>
                  {chatTheme.name}
                </span>
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  position: 'relative',
                  zIndex: 1
                }}>
                  <div style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '15px', 
                    backgroundColor: chatTheme.bubbleOwn,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }} />
                  <div style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '15px', 
                    backgroundColor: chatTheme.bubbleOther,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }} />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">Font Settings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="settings-label">Font Size</label>
              <input
                type="range"
                min="12"
                max="24"
                value={chatSettings.fontSize}
                onChange={(e) => setChatSettings({ fontSize: parseInt(e.target.value) })}
                style={{ width: '100%', marginTop: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-subtitle">12px</span>
                <span className="text-subtitle">{chatSettings.fontSize}px</span>
                <span className="text-subtitle">24px</span>
              </div>
            </div>
            
            <div>
              <label className="settings-label">Font Weight</label>
              <select
                value={chatSettings.fontWeight}
                onChange={(e) => setChatSettings({ fontWeight: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--text)',
                  marginTop: '8px'
                }}
              >
                <option value="400">Normal</option>
                <option value="600">Semibold</option>
                <option value="bold">Bold</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}