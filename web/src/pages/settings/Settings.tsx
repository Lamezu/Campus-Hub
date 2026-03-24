import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, deleteField } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import Layout from '../../components/Layout';
import { LogOut, Check, Upload, Play, Music, Trash2 } from 'lucide-react';
import { previewTone, playCallTone, MESSAGE_TONE_NAMES, CALL_TONE_NAMES } from '../../utils/toneGenerator';
import { uploadCallTone } from '../../config/cloudinary';

type MuteDuration = '8h' | '1w' | 'always' | 'off';

const MUTE_OPTIONS: { value: MuteDuration; label: string }[] = [
  { value: '8h', label: '8 horas' },
  { value: '1w', label: '1 semana' },
  { value: 'always', label: 'Siempre' },
  { value: 'off', label: 'No silenciar' },
];

const PRESET_COLORS = [
  '#007AFF', '#FF2D55', '#5856D6', '#AF52DE',
  '#FF9500', '#FFCC00', '#34C759', '#5AC8FA',
  '#FF3B30', '#8E8E93', '#E91E63', '#9C27B0',
  '#3F51B5', '#00BCD4', '#009688', '#4CAF50',
  '#FFEB3B', '#FF9800', '#FF5722', '#795548',
];

export default function Settings() {
  const navigate = useNavigate();
  const { theme, colors, setTheme, setCustomPrimary, customPrimary } = useTheme();
  const [userData, setUserData] = useState<any>(null);
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [globalMute, setGlobalMute] = useState<MuteDuration>('off');
  const [globalTone, setGlobalTone] = useState('Melodía');
  const [callTone, setCallTone] = useState('Trompeta');
  const [callToneUrl, setCallToneUrl] = useState<string | null>(null);
  const [uploadingTone, setUploadingTone] = useState(false);
  const callToneInputRef = useRef<HTMLInputElement>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    let unsubSnapshot: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      unsubSnapshot = onSnapshot(doc(db, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUserData(data);
          if (data.settings?.globalMute) setGlobalMute(data.settings.globalMute);
          if (data.settings?.globalTone) setGlobalTone(data.settings.globalTone);
          if (data.settings?.callTone) setCallTone(data.settings.callTone);
          setCallToneUrl(data.settings?.callToneUrl ?? null);
        }
      });
    });
    return () => { unsubAuth(); unsubSnapshot?.(); };
  }, []);

  const handleMuteChange = async (value: MuteDuration) => {
    setGlobalMute(value);
    if (currentUser) {
      await updateDoc(doc(db, 'users', currentUser.uid), { 'settings.globalMute': value });
    }
  };

  const handleToneChange = async (tone: string) => {
    setGlobalTone(tone);
    previewTone(tone);
    if (currentUser) {
      await updateDoc(doc(db, 'users', currentUser.uid), { 'settings.globalTone': tone });
    }
  };

  const handleCallToneChange = async (tone: string) => {
    setCallTone(tone);
    playCallTone(tone);
    setTimeout(() => { import('../../utils/toneGenerator').then(m => m.stopCallTone()); }, 4000);
    if (currentUser) {
      await updateDoc(doc(db, 'users', currentUser.uid), { 'settings.callTone': tone });
    }
  };

  const handlePreviewCustomTone = () => {
    if (!callToneUrl) return;
    const audio = new Audio(callToneUrl);
    audio.play();
    setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 4000);
  };

  const handleSelectCustomTone = async () => {
    if (!callToneUrl || !currentUser) return;
    setCallTone('Personalizado');
    await updateDoc(doc(db, 'users', currentUser.uid), { 'settings.callTone': 'Personalizado' });
  };

  const handleDeleteCustomTone = async () => {
    if (!currentUser) return;
    setCallToneUrl(null);
    if (callTone === 'Personalizado') setCallTone('Trompeta');
    await updateDoc(doc(db, 'users', currentUser.uid), {
      'settings.callToneUrl': deleteField(),
      ...(callTone === 'Personalizado' ? { 'settings.callTone': 'Trompeta' } : {}),
    });
  };

  const handleCustomToneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    const duration = await new Promise<number>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const a = new Audio(url);
      a.addEventListener('loadedmetadata', () => { URL.revokeObjectURL(url); resolve(a.duration); });
      a.addEventListener('error', () => { URL.revokeObjectURL(url); reject(); });
    }).catch(() => 0);
    if (duration > 60) {
      alert('El tono no puede durar más de 1 minuto.');
      e.target.value = '';
      return;
    }
    setUploadingTone(true);
    try {
      const url = await uploadCallTone(file, currentUser.uid);
      setCallTone('Personalizado');
      setCallToneUrl(url);
      const audio = new Audio(url);
      audio.play();
      setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 4000);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        'settings.callTone': 'Personalizado',
        'settings.callToneUrl': url,
      });
    } catch {
      alert('No se pudo subir el tono. Inténtalo de nuevo.');
    } finally {
      setUploadingTone(false);
      e.target.value = '';
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('¿Estás seguro de que quieres cerrar sesión?')) return;
    try {
      await signOut(auth);
      navigate('/login');
    } catch {
      alert('No se pudo cerrar sesión');
    }
  };

  const appThemes = [
    { id: 'light', label: 'Modo Claro', bg: '#FFFFFF', fg: '#1C1C1E' },
    { id: 'dark', label: 'Modo Oscuro', bg: '#1C1C1E', fg: '#FFFFFF' },
    { id: 'high-contrast', label: 'Alto Contraste', bg: '#000000', fg: '#FFFFFF' },
    { id: 'pastel', label: 'Pastel', bg: '#EEE8FA', fg: '#18103A' },
  ];

  const displayName = userData?.displayName || currentUser?.displayName || 'Usuario';
  const email = userData?.email || currentUser?.email || '';
  const photoURL = userData?.photoURL || currentUser?.photoURL;

  return (
    <Layout title="Ajustes">
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>

        <div className="settings-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '32px',
              backgroundColor: colors.backgroundSecondary,
              overflow: 'hidden', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {photoURL
                ? <img src={photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '26px', fontWeight: 'bold', color: colors.textSecondary }}>
                    {displayName[0]?.toUpperCase()}
                  </span>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: colors.text }}>{displayName}</div>
              <div
                onClick={() => setShowFullEmail(v => !v)}
                style={{
                  fontSize: '13px', color: colors.textSecondary, marginTop: '2px',
                  cursor: 'pointer', overflow: 'hidden',
                  whiteSpace: showFullEmail ? 'normal' : 'nowrap',
                  textOverflow: showFullEmail ? 'unset' : 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {email}
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">Tema General</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {appThemes.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id as any)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderRadius: '12px',
                  border: theme === t.id ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  backgroundColor: theme === t.id ? colors.primary + '11' : t.bg,
                  color: t.fg, cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: theme === t.id ? '600' : '400' }}>{t.label}</span>
                {theme === t.id && (
                  <span style={{ color: colors.primary, fontSize: '16px', fontWeight: 'bold' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">Color Personalizado</h2>
          <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px', marginBottom: '14px' }}>
            Selecciona un color para personalizar la interfaz instantáneamente.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setCustomPrimary(color)}
                style={{
                  width: '44px', height: '44px', borderRadius: '22px',
                  backgroundColor: color, border: 'none', cursor: 'pointer',
                  outline: customPrimary === color && theme === 'monochromatic'
                    ? `3px solid ${colors.text}`
                    : '3px solid transparent',
                  outlineOffset: '2px',
                  transition: 'outline 0.15s',
                }}
              />
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h2 className="settings-section-title">Notificaciones</h2>
          <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px', marginBottom: '14px' }}>
            Silenciar todas las notificaciones de la aplicación.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {MUTE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleMuteChange(opt.value)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                  border: globalMute === opt.value ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  backgroundColor: globalMute === opt.value ? colors.primary + '11' : 'transparent',
                  color: globalMute === opt.value ? colors.primary : colors.text,
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: globalMute === opt.value ? '600' : '400' }}>
                  {opt.label}
                </span>
                {globalMute === opt.value && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '20px', marginBottom: '14px' }}>
            Tono de alerta global.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {MESSAGE_TONE_NAMES.map(tone => (
              <button
                key={tone}
                onClick={() => handleToneChange(tone)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                  border: globalTone === tone ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  backgroundColor: globalTone === tone ? colors.primary + '11' : 'transparent',
                  color: globalTone === tone ? colors.primary : colors.text,
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: globalTone === tone ? '600' : '400' }}>
                  {tone}
                </span>
                {globalTone === tone && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '20px', marginBottom: '14px' }}>
            Tono de llamada entrante.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {CALL_TONE_NAMES.map(tone => (
              <button
                key={tone}
                onClick={() => handleCallToneChange(tone)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
                  border: callTone === tone ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  backgroundColor: callTone === tone ? colors.primary + '11' : 'transparent',
                  color: callTone === tone ? colors.primary : colors.text,
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: callTone === tone ? '600' : '400' }}>
                  {tone}
                </span>
                {callTone === tone && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
              </button>
            ))}
            <input
              ref={callToneInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4"
              onChange={handleCustomToneUpload}
              style={{ display: 'none' }}
            />
            {callToneUrl && (
              <div style={{
                border: callTone === 'Personalizado' ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                borderRadius: '12px',
                backgroundColor: callTone === 'Personalizado' ? colors.primary + '11' : 'transparent',
                overflow: 'hidden',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 10 }}>
                  <Music size={15} color={callTone === 'Personalizado' ? colors.primary : colors.textSecondary} />
                  <span style={{ flex: 1, fontSize: '15px', fontWeight: callTone === 'Personalizado' ? '600' : '400', color: callTone === 'Personalizado' ? colors.primary : colors.text }}>
                    Tono personalizado
                  </span>
                  <button
                    onClick={handlePreviewCustomTone}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
                    title="Escuchar"
                  >
                    <Play size={15} color={colors.textSecondary} />
                  </button>
                  <button
                    onClick={handleDeleteCustomTone}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
                    title="Eliminar"
                  >
                    <Trash2 size={15} color={colors.danger ?? '#FF3B30'} />
                  </button>
                  {callTone === 'Personalizado' && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                </div>
                {callTone !== 'Personalizado' && (
                  <button
                    onClick={handleSelectCustomTone}
                    style={{ width: '100%', padding: '8px 16px', background: 'none', border: 'none', borderTop: `1px solid ${colors.border}`, cursor: 'pointer', fontSize: '13px', color: colors.primary, fontWeight: '600', textAlign: 'left' }}
                  >
                    Usar este tono
                  </button>
                )}
              </div>
            )}
            <button
              onClick={() => callToneInputRef.current?.click()}
              disabled={uploadingTone}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 16px', borderRadius: '12px', cursor: uploadingTone ? 'not-allowed' : 'pointer',
                border: `1px solid ${colors.border}`, backgroundColor: 'transparent',
                color: colors.textSecondary, opacity: uploadingTone ? 0.6 : 1,
              }}
            >
              <Upload size={15} color={colors.textSecondary} />
              <span style={{ fontSize: '15px' }}>
                {uploadingTone ? 'Subiendo...' : callToneUrl ? 'Cambiar tono...' : 'Subir tono personalizado...'}
              </span>
            </button>
          </div>
        </div>

        <div className="settings-section">
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '14px', borderRadius: '12px',
              backgroundColor: colors.danger, border: 'none',
              color: '#FFFFFF', fontSize: '15px', fontWeight: '600',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px',
            }}
          >
            <LogOut size={18} color="#FFFFFF" />
            Cerrar Sesión
          </button>
        </div>

      </div>
    </Layout>
  );
}
