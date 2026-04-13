import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../../contexts/AccountsContext';
import { useTranslation } from '../../hooks/useTranslation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { addAccount } = useAccounts();
  const { t } = useTranslation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const { uid, displayName, photoURL } = credential.user;
      addAccount({
        uid,
        email: credential.user.email ?? email,
        displayName: displayName ?? email,
        photoURL: photoURL ?? null,
        _pw: btoa(password),
      });
      navigate('/home');
    } catch {
      setError(t('auth.login_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || t('common.user'),
          photoURL: user.photoURL || null,
          role: 'student',
          department: null,
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
          fcmToken: null,
        });
      }
      navigate('/home');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(t('auth.google_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">CampusHub</h1>

        <p className="text-subtitle" style={{ textAlign: 'center', marginBottom: '24px' }}>
          {t('common.welcome')}
        </p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">{t('auth.email')}</label>
            <input
              type="email"
              className="form-input"
              placeholder={t('auth.email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <input
              type="password"
              className="form-input"
              placeholder={t('auth.password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn" disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
            {loading ? t('auth.logging_in') : t('common.login')}
          </button>
        </form>

        <p className="text-subtitle" style={{ textAlign: 'center', margin: '24px 0 16px' }}>
          {t('auth.or_continue_with')}
        </p>

        <button className="btn btn-google" onClick={handleGoogleLogin} disabled={loading}>
          {t('auth.login_with_google')}
        </button>

        <p className="text-subtitle" style={{ textAlign: 'center' }}>
          {t('auth.no_account')}{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>
            {t('auth.register_here')}
          </a>
        </p>
      </div>
    </div>
  );
}
