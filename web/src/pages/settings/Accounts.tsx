import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Eye, EyeOff, KeyRound, Plus, Trash2, User } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useAccounts, type StoredAccount } from '../../contexts/AccountsContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function Accounts() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { accounts, activeUid, switching, switchAccount, addAccount, removeAccount } = useAccounts();

  const [confirmRemove, setConfirmRemove] = useState<StoredAccount | null>(null);
  const [switchError, setSwitchError] = useState('');
  const [reAuthAccount, setReAuthAccount] = useState<StoredAccount | null>(null);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [reAuthShowPw, setReAuthShowPw] = useState(false);
  const [reAuthLoading, setReAuthLoading] = useState(false);
  const [reAuthError, setReAuthError] = useState('');

  const visible = accounts;

  const handleSwitch = async (account: StoredAccount) => {
    if (account.uid === activeUid || switching) return;
    if (!account._pw) {
      setReAuthAccount(account);
      setReAuthPassword('');
      setReAuthError('');
      return;
    }
    setSwitchError('');
    try {
      await switchAccount(account);
      navigate('/home');
    } catch {
      setSwitchError('No se pudo cambiar de cuenta. Inténtalo de nuevo.');
    }
  };

  const handleReAuth = async () => {
    if (!reAuthAccount || !reAuthPassword || reAuthLoading) return;
    setReAuthLoading(true);
    setReAuthError('');
    try {
      await signInWithEmailAndPassword(auth, reAuthAccount.email, reAuthPassword);
      addAccount({ ...reAuthAccount, _pw: btoa(reAuthPassword) });
      setReAuthAccount(null);
      navigate('/home');
    } catch {
      setReAuthError('Contraseña incorrecta.');
    } finally {
      setReAuthLoading(false);
    }
  };

  const handleRemoveConfirm = () => {
    if (!confirmRemove) return;
    removeAccount(confirmRemove.uid);
    setConfirmRemove(null);
  };

  return (
    <Layout title="Cuentas" showBackButton>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px' }}>

        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
          {visible.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>
              No hay cuentas guardadas
            </div>
          ) : (
            visible.map((account, idx) => {
              const isActive = account.uid === activeUid;
              const hasCreds = !!account._pw;
              return (
                <div
                  key={account.uid}
                  onClick={() => handleSwitch(account)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px',
                    borderBottom: idx < visible.length - 1 ? `1px solid ${colors.border}` : 'none',
                    backgroundColor: isActive ? `${colors.primary}08` : colors.background,
                    cursor: isActive || switching ? 'default' : 'pointer',
                    transition: 'background-color 0.12s',
                    opacity: switching && !isActive ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!isActive && !switching) e.currentTarget.style.backgroundColor = colors.backgroundSecondary; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = isActive ? `${colors.primary}08` : colors.background; }}
                >
                  <div style={{
                    width: 46, height: 46, borderRadius: 23,
                    backgroundColor: `${colors.primary}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, overflow: 'hidden',
                  }}>
                    {account.photoURL
                      ? <img src={account.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <User size={22} color={colors.primary} strokeWidth={1.8} />
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {account.displayName || account.email}
                    </div>
                    <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {account.email}
                    </div>
                  </div>

                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isActive ? (
                      <Check size={20} color={colors.primary} strokeWidth={2.5} />
                    ) : (
                      <>
                        {!hasCreds && (
                          <KeyRound size={16} color={colors.textSecondary} strokeWidth={1.8} style={{ marginRight: 4 }} />
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmRemove(account); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={18} color={colors.textSecondary} strokeWidth={1.8} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {switchError && (
          <p style={{ fontSize: 13, color: '#FF3B30', marginBottom: 12, textAlign: 'center' }}>{switchError}</p>
        )}

        <button
          onClick={() => navigate('/settings/add-account')}
          disabled={switching}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '13px 16px', borderRadius: 14, border: `1.5px solid ${colors.primary}`,
            backgroundColor: 'transparent', color: colors.primary, fontSize: 15, fontWeight: '600',
            cursor: switching ? 'not-allowed' : 'pointer', opacity: switching ? 0.5 : 1,
          }}
        >
          <Plus size={18} color={colors.primary} strokeWidth={2.5} />
          Añadir cuenta
        </button>
      </div>

      {reAuthAccount && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}
          onClick={() => setReAuthAccount(null)}
        >
          <div
            style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}
          >
            <div>
              <div style={{ fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                Confirmar identidad
              </div>
              <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: '20px' }}>
                Introduce la contraseña de <strong>{reAuthAccount.displayName || reAuthAccount.email}</strong> para cambiar a esta cuenta.
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary }}>
              <input
                type={reAuthShowPw ? 'text' : 'password'}
                placeholder="Contraseña"
                value={reAuthPassword}
                onChange={e => { setReAuthPassword(e.target.value); setReAuthError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleReAuth(); }}
                autoFocus
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: colors.text, padding: '12px 0' }}
              />
              <button
                onClick={() => setReAuthShowPw(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
              >
                {reAuthShowPw
                  ? <EyeOff size={18} color={colors.textSecondary} strokeWidth={1.8} />
                  : <Eye size={18} color={colors.textSecondary} strokeWidth={1.8} />
                }
              </button>
            </div>

            {reAuthError && <p style={{ fontSize: 13, color: '#FF3B30', margin: 0 }}>{reAuthError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setReAuthAccount(null)}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 14, fontWeight: '600', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReAuth}
                disabled={!reAuthPassword || reAuthLoading}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', backgroundColor: reAuthPassword && !reAuthLoading ? colors.primary : colors.border, color: '#fff', fontSize: 14, fontWeight: '600', cursor: reAuthPassword && !reAuthLoading ? 'pointer' : 'not-allowed' }}
              >
                {reAuthLoading ? 'Verificando...' : 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 24 }}
          onClick={() => setConfirmRemove(null)}
        >
          <div
            style={{ backgroundColor: colors.background, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}
            onClick={e => e.stopPropagation()}
          >
            <span style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>Eliminar cuenta</span>
            <span style={{ fontSize: 14, color: colors.textSecondary, lineHeight: '22px' }}>
              ¿Eliminar <strong>{confirmRemove.displayName || confirmRemove.email}</strong> de la lista de cuentas guardadas?
            </span>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => setConfirmRemove(null)}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 14, fontWeight: '600', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleRemoveConfirm}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: 'none', backgroundColor: '#FF3B30', color: '#fff', fontSize: 14, fontWeight: '600', cursor: 'pointer' }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
