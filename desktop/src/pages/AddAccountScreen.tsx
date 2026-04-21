import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useTheme } from '@/contexts/ThemeContext';
import { useAccounts } from '@/contexts/AccountsContext';
import { useAlert } from '@/contexts/AlertContext';
import firebaseConfig from '@/config/firebase';
import { useTranslation } from '@/contexts/LanguageContext';

export default function AddAccountScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { addAccount, activeUid, accounts } = useAccounts();
  const { showAlert } = useAlert();
  const { t } = useTranslation();

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
    const tempApp = initializeApp((firebaseConfig as any).options, tempAppName);
    const tempAuth = initializeAuth(tempApp, { persistence: inMemoryPersistence });

    try {
      const credential = await signInWithEmailAndPassword(tempAuth, email.trim(), password);
      const { uid, displayName, photoURL, refreshToken } = credential.user;

      if (uid === activeUid) {
        setError(t('add_account.error_already_active'));
        await signOut(tempAuth);
        return;
      }

      if (accounts.some(a => a.uid === uid)) {
        setError(t('add_account.error_already_added'));
        await signOut(tempAuth);
        return;
      }

      addAccount({
        uid,
        email: credential.user.email ?? email.trim(),
        displayName: displayName ?? email.trim(),
        photoURL: photoURL ?? null,
        refreshToken,
        _pw: btoa(password),
      });

      await signOut(tempAuth);
      showAlert({ title: t('add_account.success_title'), message: t('add_account.success_msg'), type: 'success' });
      navigate(-1);
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError(t('add_account.error_invalid_credentials'));
      } else if (code === 'auth/invalid-email') {
        setError(t('add_account.error_invalid_email'));
      } else {
        setError(t('add_account.error_generic'));
      }
    } finally {
      setLoading(false);
      await deleteApp(tempApp).catch(() => { });
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
            background: 'none', border: 'none', color: colors.text, cursor: 'pointer',
            padding: 8, borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', transition: 'background-color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{t('add_account.title')}</h1>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{
          maxWidth: 480, width: '100%',
          backgroundColor: colors.card, borderRadius: 32, padding: 40,
          border: `2px solid ${colors.border}`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column', gap: 32
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>{t('add_account.subtitle')}</h2>
            <p style={{ fontSize: 14, color: colors.textSecondary, lineHeight: '1.5' }}>
              {t('add_account.desc')}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{
                fontSize: 12, fontWeight: 800, color: colors.textSecondary,
                textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: 4
              }}>
                {t('add_account.email_label')}
              </label>
              <input
                type="email"
                placeholder={t('add_account.email_placeholder')}
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                style={{
                  padding: '16px 20px', borderRadius: 16, border: `2px solid ${colors.border}`,
                  backgroundColor: colors.backgroundSecondary, color: colors.text,
                  fontSize: 16, fontWeight: 600, outline: 'none', transition: 'border-color 0.2s'
                }}
                onFocus={e => e.currentTarget.style.borderColor = colors.primary}
                onBlur={e => e.currentTarget.style.borderColor = colors.border}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{
                fontSize: 12, fontWeight: 800, color: colors.textSecondary,
                textTransform: 'uppercase', letterSpacing: '0.5px', marginLeft: 4
              }}>
                {t('add_account.password_label')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('add_account.password_placeholder')}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  style={{
                    width: '100%', padding: '16px 20px', paddingRight: 60,
                    borderRadius: 16, border: `2px solid ${colors.border}`,
                    backgroundColor: colors.backgroundSecondary, color: colors.text,
                    fontSize: 16, fontWeight: 600, outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color 0.2s'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = colors.primary}
                  onBlur={e => e.currentTarget.style.borderColor = colors.border}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: colors.textSecondary,
                    cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                color: '#FF3B30', fontSize: 14, fontWeight: 600,
                padding: '12px 16px', backgroundColor: '#FF3B3015',
                borderRadius: 12, border: '1px solid #FF3B3030'
              }}>
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <button
              onClick={handleAdd}
              disabled={!canSubmit}
              style={{
                marginTop: 10, padding: '18px', borderRadius: 16,
                backgroundColor: canSubmit ? colors.primary : colors.border,
                color: '#fff', fontSize: 16, fontWeight: 800,
                border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                boxShadow: canSubmit ? `0 10px 20px ${colors.primary}40` : 'none',
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
              {loading ? <Loader2 size={24} className="animate-spin" /> : t('add_account.submit_btn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
