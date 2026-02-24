import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function Messages() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/login');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [navigate]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-vh-100" style={{ backgroundColor: 'var(--background)' }}>
      <header className="header">
        <div className="header-content" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 className="text-title">Mensajes directos</h1>
          <button 
            className="settings-button"
            onClick={() => navigate('/profile')}
          >
            👤
          </button>
        </div>
        <p className="text-subtitle" style={{ maxWidth: '600px', margin: '8px auto 0' }}>
          Conversaciones privadas con amigos
        </p>
      </header>

      <main className="container" style={{ textAlign: 'center', paddingTop: '20px' }}>
        <div style={{ 
          backgroundColor: 'var(--background-secondary)',
          padding: '40px 20px',
          borderRadius: '12px',
          marginTop: '20px'
        }}>
          <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>
            💬
          </span>
          <h2 style={{ color: 'var(--text)', marginBottom: '8px' }}>
            Próximamente
          </h2>
          <p className="text-subtitle">
            Sprint 4 - Mensajería directa
          </p>
        </div>
      </main>

      <footer className="nav-footer">
        <ul className="nav-items">
          <li className="nav-item" onClick={() => navigate('/home')}>
            <span className="nav-icon">🏠</span>
            <span>Home</span>
          </li>
          <li className="nav-item" onClick={() => navigate('/explore')}>
            <span className="nav-icon">🔍</span>
            <span>Explore</span>
          </li>
          <li className="nav-item" onClick={() => navigate('/create')}>
            <span className="nav-icon">➕</span>
            <span>Create</span>
          </li>
          <li className="nav-item active" onClick={() => navigate('/messages')}>
            <span className="nav-icon">💬</span>
            <span>Messages</span>
          </li>
          <li className="nav-item" onClick={() => navigate('/profile')}>
            <span className="nav-icon">👤</span>
            <span>Profile</span>
          </li>
        </ul>
      </footer>
    </div>
  );
}