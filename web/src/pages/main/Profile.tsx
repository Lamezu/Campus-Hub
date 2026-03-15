import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import Layout from '../../components/Layout';
import NotificationBell from '../../components/NotificationBell';

export default function Profile() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/login');
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
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

  if (!user) return null;

  const displayName = userData?.displayName || user.displayName || 'User';
  const email = user.email;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <Layout title="Perfil" rightAction={<NotificationBell />}>
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          padding: '24px 16px',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{
            width: '96px',
            height: '96px',
            borderRadius: '48px',
            backgroundColor: 'var(--background-secondary)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            {userData?.photoURL ? (
              <img 
                src={userData.photoURL} 
                alt={displayName}
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '48px',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text)' }}>
                {initial}
              </span>
            )}
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '4px' }}>
            {displayName}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            {email}
          </p>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              className="btn"
              style={{
                padding: '8px 24px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600'
              }}
              onClick={() => navigate('/edit-profile')}
            >
              Editar Perfil
            </button>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          backgroundColor: 'var(--background-secondary)',
          margin: '16px',
          padding: '20px',
          borderRadius: '12px'
        }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)' }}>12</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Canales</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)' }}>48</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Mensajes</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text)' }}>5</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Amigos</div>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '12px' }}>
            Acciones Rápidas
          </h3>
          
          <div style={{ 
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            padding: '16px',
            borderRadius: '12px',
            marginBottom: '8px',
            cursor: 'pointer'
          }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
              💾 Mensajes Guardados
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Ver tu contenido guardado
            </div>
          </div>

          <div
            onClick={() => navigate('/friends')}
            style={{
              backgroundColor: 'var(--background)',
              border: '1px solid var(--border)',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '8px',
              cursor: 'pointer'
            }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
              👥 Amigos
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Administrar tu lista de amigos
            </div>
          </div>

          <div style={{ 
            backgroundColor: 'var(--background)',
            border: '1px solid var(--border)',
            padding: '16px',
            borderRadius: '12px',
            cursor: 'pointer'
          }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
              ⭐ Mejores amigos
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Tus conexiones más cercanas
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}