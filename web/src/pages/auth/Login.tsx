import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/home');
    } catch (err: any) {
      setError(err.message);
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

          <button type="submit" className="btn">
            Iniciar Sesión
          </button>
        </form>

        <p className="text-subtitle" style={{ textAlign: 'center', margin: '24px 0 16px' }}>
          O continuar con
        </p>

        <button className="btn btn-google">
          Continuar con Google
        </button>

        <p className="text-subtitle" style={{ textAlign: 'center' }}>
          ¿No tienes cuenta? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>Registrate</a>
        </p>
      </div>
    </div>
  );
}