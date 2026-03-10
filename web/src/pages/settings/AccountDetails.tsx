import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';

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

  const currentUser = auth.currentUser;

  const handleChangePassword = async (e: React.FormEvent) => {
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
      console.error(error);
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
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0'
          }}>
            <div>
              <div style={{ fontSize: '16px', color: colors.text, marginBottom: '4px' }}>Contraseña</div>
              <div style={{ fontSize: '14px', color: colors.textSecondary }}>••••••••</div>
            </div>
            <button
              onClick={() => setShowChangePassword(!showChangePassword)}
              style={{
                background: 'none',
                border: `1px solid ${colors.primary}`,
                color: colors.primary,
                padding: '6px 16px',
                borderRadius: '16px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Cambiar
            </button>
          </div>

          {showChangePassword && (
            <form onSubmit={handleChangePassword} style={{ marginTop: '16px' }}>
              <div className="form-group">
                <label className="form-label">Contraseña actual</label>
                <input
                  type="password"
                  className="form-input"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nueva contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && <div className="error-message">{error}</div>}
              {success && <div style={{ color: colors.success, fontSize: '14px', marginBottom: '12px' }}>{success}</div>}

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn"
                  style={{ flex: 1 }}
                >
                  {loading ? 'Actualizando...' : 'Actualizar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  style={{
                    flex: 1,
                    padding: '14px',
                    background: 'none',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.text,
                    cursor: 'pointer'
                  }}
                >
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