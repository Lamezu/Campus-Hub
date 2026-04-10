import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signInWithCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { useAccounts } from '@/contexts/AccountsContext';
import { spacing, typography } from '@/constants/styles';
import { useEffect } from 'react';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { addAccount } = useAccounts();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) navigate('/tabs/home', { replace: true });
    });
    return unsub;
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Por favor completa todos los campos'); return; }
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      
      // Save credentials for account switching
      addAccount({
        uid: user.uid,
        email: user.email || email,
        displayName: user.displayName || user.email || 'Usuario',
        photoURL: user.photoURL || null,
        refreshToken: user.refreshToken,
        _pw: btoa(password)
      });

      navigate('/tabs/home', { replace: true });
    } catch (err: any) {
      let msg = 'Credenciales inválidas';
      if (err.code === 'auth/user-not-found') msg = 'Usuario no encontrado';
      if (err.code === 'auth/wrong-password') msg = 'Contraseña incorrecta';
      if (err.code === 'auth/too-many-requests') msg = 'Demasiados intentos, prueba más tarde';
      setError(msg);
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
      const existing = await getDoc(userRef);
      if (!existing.exists()) {
        await setDoc(userRef, {
          uid: user.uid, email: user.email,
          displayName: user.displayName || 'Usuario',
          photoURL: user.photoURL || null,
          role: 'alumno', provider: 'Google',
          emailVerified: user.emailVerified,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
      }
      navigate('/tabs/home', { replace: true });
    } catch (err: any) {
      let msg = 'No se pudo iniciar sesión con Google';
      if (err.code === 'auth/popup-closed-by-user') msg = 'Inicio de sesión cancelado';
      if (err.code === 'auth/unauthorized-domain') msg = 'Dominio no autorizado en Firebase';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    backgroundColor: colors.backgroundSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: 10, fontSize: typography.sizes.md,
    color: colors.text, outline: 'none',
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      display: 'flex', height: '100vh',
      backgroundColor: colors.background,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 420, padding: spacing.xl }}>
        <h1 style={{ textAlign: 'center', color: colors.primary, marginBottom: 8, fontSize: 36, fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }}>
          CampusHub
        </h1>
        <p style={{ textAlign: 'center', color: colors.textSecondary, marginBottom: spacing.xl, fontSize: typography.sizes.md, fontFamily: 'Inter, sans-serif' }}>
          Bienvenido de nuevo
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
            disabled={loading}
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
            disabled={loading}
            autoComplete="current-password"
          />

          {error && (
            <p style={{ color: colors.danger, fontSize: typography.sizes.sm, textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px 0',
              backgroundColor: loading ? `${colors.primary}80` : colors.primary,
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: typography.sizes.md, fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: `${spacing.lg}px 0`, gap: spacing.sm }}>
          <div style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          <span style={{ color: colors.textSecondary, fontSize: typography.sizes.sm, fontFamily: 'Inter, sans-serif' }}>O continuar con</span>
          <div style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '14px 0',
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 10, fontSize: typography.sizes.md, fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            color: colors.text, fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'background-color 0.15s',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>

        <p style={{ textAlign: 'center', marginTop: spacing.xl, fontFamily: 'Inter, sans-serif', fontSize: typography.sizes.sm }}>
          <span style={{ color: colors.textSecondary }}>¿No tienes cuenta? </span>
          <button
            onClick={() => navigate('/auth/register')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontWeight: '600', fontSize: typography.sizes.sm, fontFamily: 'Inter, sans-serif' }}
          >
            Regístrate
          </button>
        </p>
      </div>
    </div>
  );
}
