import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertTriangle, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { deleteUserAccount } from '@/services/userService';

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { showAlert } = useAlert();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = password.trim().length > 0 && confirmed && !loading;

  const handleDelete = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await deleteUserAccount(password);
      await signOut(auth);
      showAlert({ title: 'Éxito', message: 'Tu cuenta ha sido eliminada. Lamentamos verte partir.', type: 'success' });
      navigate('/auth/login', { replace: true });
    } catch (err: any) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setError('La contraseña introducida es incorrecta.');
      } else {
        setError('No se ha podido eliminar la cuenta. Reinténtalo más tarde.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      backgroundColor: colors.background,
      display: 'flex',
      flexDirection: 'column',
      color: colors.text,
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 40px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        backgroundColor: colors.card
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            color: colors.text,
            cursor: 'pointer',
            padding: 8,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Eliminar Cuenta</h1>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px'
      }}>
        <div style={{
          maxWidth: 540,
          width: '100%',
          backgroundColor: colors.card,
          borderRadius: 32,
          padding: 48,
          border: `2.5px solid #FF3B3040`,
          boxShadow: '0 20px 60px rgba(255, 59, 48, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: 32
        }}>
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
             <div style={{
               width: 72,
               height: 72,
               borderRadius: 24,
               backgroundColor: '#FF3B3015',
               color: '#FF3B30',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               marginBottom: 8
             }}>
               <AlertTriangle size={40} />
             </div>
            <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4, color: '#FF3B30' }}>Acción Irreversible</h2>
            <p style={{ fontSize: 15, color: colors.textSecondary, lineHeight: '1.6' }}>
              Estás a punto de eliminar permanentemente tu cuenta y todos tus datos (mensajes, fotos, publicaciones, etc.). Esta acción no se puede deshacer.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confirma tu contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Introduce tu contraseña"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  style={{
                    width: '100%',
                    padding: '18px 24px',
                    paddingRight: 60,
                    borderRadius: 18,
                    border: `2px solid ${colors.border}`,
                    backgroundColor: colors.backgroundSecondary,
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 18,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    padding: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#FF3B30',
                fontSize: 14,
                fontWeight: 700,
                padding: '14px 20px',
                backgroundColor: '#FF3B3015',
                borderRadius: 16,
                border: '1px solid #FF3B3030'
              }}>
                <XCircle size={18} />
                {error}
              </div>
            )}

            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              cursor: 'pointer',
              userSelect: 'none',
              padding: '12px 0'
            }}>
              <div style={{ position: 'relative', marginTop: 2 }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  style={{ opacity: 0, position: 'absolute', width: 24, height: 24 }}
                />
                <div style={{
                  width: 24,
                  height: 24,
                  borderRadius: 8,
                  border: `2px solid ${confirmed ? '#FF3B30' : colors.border}`,
                  backgroundColor: confirmed ? '#FF3B30' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}>
                  {confirmed && <span style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>✓</span>}
                </div>
              </div>
              <span style={{ fontSize: 14, color: colors.text, fontWeight: 600, lineHeight: '1.5' }}>
                Entiendo que esta acción es permanente y que no podré recuperar mis datos bajo ninguna circunstancia.
              </span>
            </label>

            <button
              onClick={handleDelete}
              disabled={!canSubmit}
              style={{
                marginTop: 8,
                padding: '20px',
                borderRadius: 20,
                backgroundColor: canSubmit ? '#FF3B30' : colors.border,
                color: '#fff',
                fontSize: 17,
                fontWeight: 800,
                border: 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                boxShadow: canSubmit ? `0 15px 30px rgba(255, 59, 48, 0.3)` : 'none',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                if (canSubmit) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.filter = 'brightness(1.1)';
                }
              }}
              onMouseLeave={e => {
                if (canSubmit) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.filter = 'brightness(1)';
                }
              }}
            >
              {loading ? <Loader2 size={24} className="animate-spin" /> : 'Eliminar mi cuenta definitivamente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
