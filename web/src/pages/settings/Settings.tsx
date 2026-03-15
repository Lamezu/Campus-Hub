import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import Layout from '../../components/Layout';
import { LogOut } from 'lucide-react';

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
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
    return () => unsubscribe();
  }, [currentUser]);

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
