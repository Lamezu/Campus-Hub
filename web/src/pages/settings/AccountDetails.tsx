import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export default function AccountDetails() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  const [passwordHash, setPasswordHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentUser = auth.currentUser;

  const handleShowCode = () => {
    setPasswordHash(null);
    setCodeInput('');
    setCodeError('');
    setVerificationCode(generateCode());
  };

  const handleHideHash = () => {
    setVerificationCode(null);
    setCodeInput('');
    setCodeError('');
    setPasswordHash(null);
  };

  const handleVerifyCode = async () => {
    if (!currentUser) return;
    if (codeInput !== verificationCode) {
      setCodeError('Código incorrecto. Inténtalo de nuevo.');
      return;
    }
    const hash = await sha256(currentUser.uid + (currentUser.email ?? ''));
    setPasswordHash(hash);
    setCodeError('');
  };

  const handleCopyHash = () => {
    if (!passwordHash) return;
    navigator.clipboard.writeText(passwordHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!currentUser || !currentUser.email) return;

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      setSuccess('Contraseña actualizada correctamente');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        setError('La contraseña actual es incorrecta');
      } else {
        setError('Error al cambiar la contraseña');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-loading-container">
      <div className="chat-header">
        <button className="chat-back-button" onClick={() => navigate(-1)}>←</button>
        <h1 className="chat-header-title">Datos de la Cuenta</h1>
      </div>

      <div className="container" style={{ paddingTop: '16px' }}>
        <div className="settings-section">
          <h2 className="settings-section-title" style={{ fontSize: '14px', fontWeight: '600', opacity: 0.7, marginBottom: '16px' }}>
            SEGURIDAD
          </h2>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', color: colors.text, marginBottom: '4px' }}>Contraseña</div>
              <div style={{ fontSize: '14px', color: colors.textSecondary, fontFamily: 'monospace' }}>
                {passwordHash
                  ? <span style={{ wordBreak: 'break-all', fontSize: '11px', color: colors.text }}>{passwordHash}</span>
                  : '••••••••'
                }
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px' }}>
              {passwordHash && (
                <button
                  onClick={handleCopyHash}
                  title="Copiar hash"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, display: 'flex', alignItems: 'center' }}
                >
                  {copied ? <Check size={18} color={colors.success} /> : <Copy size={18} />}
                </button>
              )}
              <button
                onClick={verificationCode || passwordHash ? handleHideHash : handleShowCode}
                title={passwordHash ? 'Ocultar hash' : 'Mostrar hash'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, display: 'flex', alignItems: 'center' }}
              >
                {passwordHash ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
              <button
                onClick={() => { setShowChangePassword(!showChangePassword); handleHideHash(); }}
                style={{
                  background: 'none',
                  border: `1px solid ${colors.primary}`,
                  color: colors.primary,
                  padding: '6px 16px',
                  borderRadius: '16px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cambiar
              </button>
            </div>
          </div>

          {verificationCode && !passwordHash && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: colors.backgroundSecondary,
              border: `1px solid ${colors.border}`,
            }}>
              <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '10px' }}>
                Código de verificación generado. Introdúcelo para ver el hash.
              </div>
              <div style={{
                fontSize: '28px',
                fontWeight: '700',
                letterSpacing: '8px',
                color: colors.primary,
                fontFamily: 'monospace',
                textAlign: 'center',
                padding: '12px 0',
              }}>
                {verificationCode}
              </div>
              <input
                type="text"
                className="form-input"
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value); setCodeError(''); }}
                placeholder="Ingresa el código"
                maxLength={6}
                style={{ textAlign: 'center', letterSpacing: '6px', fontFamily: 'monospace', fontSize: '18px', marginTop: '8px' }}
              />
              {codeError && <div style={{ color: colors.danger, fontSize: '13px', marginTop: '6px' }}>{codeError}</div>}
              <button
                onClick={handleVerifyCode}
                disabled={codeInput.length !== 6}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '12px',
                  borderRadius: '10px',
                  backgroundColor: codeInput.length === 6 ? colors.primary : colors.border,
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: '600',
                  cursor: codeInput.length === 6 ? 'pointer' : 'default',
                }}
              >
                Verificar
              </button>
            </div>
          )}

          {showChangePassword && (
            <form onSubmit={handleChangePassword} style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label className="form-label">Contraseña actual</label>
                <input type="password" className="form-input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <div className="form-group">
                <label className="form-label">Nueva contraseña</label>
                <input type="password" className="form-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar nueva contraseña</label>
                <input type="password" className="form-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              {error && <div className="error-message">{error}</div>}
              {success && <div style={{ color: colors.success, fontSize: '14px', marginBottom: '12px' }}>{success}</div>}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button type="submit" disabled={loading} className="btn" style={{ flex: 1 }}>
                  {loading ? 'Actualizando...' : 'Actualizar'}
                </button>
                <button type="button" onClick={() => setShowChangePassword(false)} style={{ flex: 1, padding: '14px', background: 'none', border: `1px solid ${colors.border}`, borderRadius: '8px', color: colors.text, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
