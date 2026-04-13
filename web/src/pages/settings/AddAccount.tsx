import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { deleteApp, initializeApp } from 'firebase/app';
import { inMemoryPersistence, initializeAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import Layout from '../../components/Layout';
import { useAccounts } from '../../contexts/AccountsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import defaultApp from '../../config/firebase';

export default function AddAccount() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { addAccount, activeUid, accounts } = useAccounts();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const handleAdd = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    const tempAppName = `add-account-${Date.now()}`;
    const tempApp = initializeApp((defaultApp as any).options, tempAppName);
    const tempAuth = initializeAuth(tempApp, { persistence: inMemoryPersistence });

    try {
      const credential = await signInWithEmailAndPassword(tempAuth, email.trim(), password);
      const { uid, displayName, photoURL } = credential.user;

      if (uid === activeUid) {
        setError(t('accounts.error_already_active'));
        await signOut(tempAuth);
        return;
      }

      if (accounts.some(a => a.uid === uid)) {
        setError(t('accounts.error_already_added'));
        await signOut(tempAuth);
        return;
      }

      addAccount({
        uid,
        email: credential.user.email ?? email.trim(),
        displayName: displayName ?? email.trim(),
        photoURL: photoURL ?? null,
        _pw: btoa(password),
      });

      await signOut(tempAuth);
      navigate('/settings/accounts');
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError(t('accounts.error_invalid_credentials'));
      } else if (code === 'auth/invalid-email') {
        setError(t('accounts.error_invalid_email'));
      } else {
        setError(t('accounts.add_error'));
      }
    } finally {
      setLoading(false);
      await deleteApp(tempApp).catch(() => {});
    }
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    fontSize: 15,
    color: colors.text,
    padding: '13px 0',
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 14px',
    borderRadius: 12,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.backgroundSecondary,
  };

  return (
    <Layout title={t('accounts.add_account')} showBackButton>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <p style={{ fontSize: 14, color: colors.textSecondary, lineHeight: '22px', margin: 0 }}>
          {t('accounts.add_account_hint')}
        </p>

        <div style={fieldStyle}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(''); }}
            autoComplete="email"
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder={t('auth.password')}
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            autoComplete="current-password"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
          >
            {showPassword
              ? <EyeOff size={20} color={colors.textSecondary} strokeWidth={1.8} />
              : <Eye size={20} color={colors.textSecondary} strokeWidth={1.8} />
            }
          </button>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: '#FF3B30', margin: 0 }}>{error}</p>
        )}

        <button
          onClick={handleAdd}
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            border: 'none',
            backgroundColor: canSubmit ? colors.primary : colors.border,
            color: '#fff',
            fontSize: 15, fontWeight: '700',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            marginTop: 4,
          }}
        >
          {loading ? t('accounts.verifying') : t('accounts.add_account')}
        </button>

      </div>
    </Layout>
  );
}
