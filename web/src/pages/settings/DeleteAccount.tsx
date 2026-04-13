import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';
import { useAccounts } from '../../contexts/AccountsContext';
import { useTranslation } from '../../hooks/useTranslation';

export default function DeleteAccount() {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { removeAccount } = useAccounts();
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = password.trim().length > 0 && confirmed && !loading;

  const handleDelete = async () => {
    if (!canSubmit) return;
    const user = auth.currentUser;
    if (!user || !user.email) return;

    setLoading(true);
    setError('');
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      await deleteDoc(doc(db, 'users', user.uid)).catch(() => {});

      const uid = user.uid;
      await deleteUser(user);
      removeAccount(uid);
      await signOut(auth).catch(() => {});
      navigate('/login');
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError(t('delete_account.error_wrong_password'));
      } else {
        setError(t('delete_account.error_generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title={t('delete_account.title')} showBackButton>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: 16, borderRadius: 12,
          backgroundColor: '#FF3B3015',
          border: '1.5px solid #FF3B30',
        }}>
          <AlertTriangle size={22} color="#FF3B30" strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 14, color: '#FF3B30', fontWeight: '600', lineHeight: '22px', margin: 0 }}>
            {t('delete_account.warning')}
          </p>
        </div>

        <div>
          <p style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600', marginBottom: 8 }}>
            {t('delete_account.confirm_password_label')}
          </p>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 14px', borderRadius: 12,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.backgroundSecondary,
          }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder={t('delete_account.confirm_password_label')}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              autoComplete="current-password"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: 15, color: colors.text, padding: '13px 0',
              }}
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
            <p style={{ fontSize: 13, color: '#FF3B30', marginTop: 8 }}>{error}</p>
          )}
        </div>

        <div
          onClick={() => setConfirmed(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        >
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            border: `2px solid ${confirmed ? '#FF3B30' : colors.border}`,
            backgroundColor: confirmed ? '#FF3B30' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}>
            {confirmed && <span style={{ color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ fontSize: 14, color: colors.text, lineHeight: '22px' }}>
            {t('delete_account.checkbox')}
          </span>
        </div>

        <button
          onClick={handleDelete}
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            border: 'none',
            backgroundColor: canSubmit ? '#FF3B30' : colors.border,
            color: '#fff',
            fontSize: 15, fontWeight: '700',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? '...' : t('delete_account.confirm_btn')}
        </button>

      </div>
    </Layout>
  );
}
