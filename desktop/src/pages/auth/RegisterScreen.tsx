import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';

export default function RegisterScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password || !confirmPassword || !name) {
      setError('Por favor completa todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: name,
      });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: name,
        photoURL: null,
        role: 'student',
        department: null,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        fcmToken: null,
      });

      navigate('/tabs/home', { replace: true });
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este email ya está registrado');
      } else {
        setError('No se pudo crear la cuenta');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: colors.backgroundSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    fontSize: typography.sizes.md,
    color: colors.text,
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
    marginBottom: spacing.sm,
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ width: '100%', maxWidth: 420, padding: spacing.xl }}>
        <h1 style={{ textAlign: 'center', color: colors.primary, marginBottom: 8, fontSize: 36, fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }}>
          CampusHub
        </h1>
        <p style={{ textAlign: 'center', color: colors.textSecondary, marginBottom: spacing.xl, fontSize: typography.sizes.md, fontFamily: 'Inter, sans-serif' }}>
          Únete a la comunidad
        </p>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column' }}>
          <input
            type="text"
            placeholder="Nombre completo"
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
            disabled={loading}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={inputStyle}
            disabled={loading}
          />

          {error && (
            <p style={{ color: colors.danger, fontSize: typography.sizes.sm, textAlign: 'center', fontFamily: 'Inter, sans-serif', marginBottom: spacing.md }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px 0',
              backgroundColor: loading ? `${colors.primary}80` : colors.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: typography.sizes.md,
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              marginTop: spacing.sm,
            }}
          >
            {loading ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: spacing.xl, fontFamily: 'Inter, sans-serif', fontSize: typography.sizes.sm }}>
          <span style={{ color: colors.textSecondary }}>¿Ya tienes cuenta? </span>
          <button
            onClick={() => navigate('/auth/login')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontWeight: '600', fontSize: typography.sizes.sm, fontFamily: 'Inter, sans-serif' }}
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
}
