import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/home');
    } catch {
      setError('Email o contraseña incorrectos');
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
          displayName: user.displayName || 'Usuario',
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
        setError('No se pudo iniciar sesión con Google');
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
          Bienvenido de nuevo
        </p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn" disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className="text-subtitle" style={{ textAlign: 'center', margin: '24px 0 16px' }}>
          O continuar con
        </p>

        <button className="btn btn-google" onClick={handleGoogleLogin} disabled={loading}>
          Continuar con Google
        </button>

        <p className="text-subtitle" style={{ textAlign: 'center' }}>
          ¿No tienes cuenta? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>Registrate</a>
        </p>
      </div>
    </div>
  );
}
