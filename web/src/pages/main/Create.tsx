import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import Layout from '../../components/Layout';

export default function Create() {
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
    <Layout title="Crear">
      <div style={{ 
        maxWidth: '600px', 
        margin: '0 auto', 
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        <p className="text-subtitle" style={{ marginBottom: '16px' }}>
          Compartir posts y eventos
        </p>
        
        <div style={{ 
          backgroundColor: 'var(--background-secondary)',
          padding: '40px 20px',
          borderRadius: '12px',
          marginTop: '20px'
        }}>
          <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>
            ✨
          </span>
          <h2 style={{ color: 'var(--text)', marginBottom: '8px' }}>
            Próximamente
          </h2>
          <p className="text-subtitle">
            Sprint 4 - Creación de contenido
          </p>
        </div>
      </div>
    </Layout>
  );
}