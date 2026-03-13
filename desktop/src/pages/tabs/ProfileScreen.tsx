import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Star, Bookmark, Users, ChevronRight, Settings } from 'lucide-react';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      navigate('/auth/login', { replace: true });
      return;
    }

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to user profile:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, navigate]);

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText>Cargando perfil...</ThemedText>
      </ThemedView>
    );
  }

  const displayName = userData?.displayName || currentUser?.displayName || 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <ThemedView style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: colors.background }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        
        {/* Profile Header */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${spacing.xl}px ${spacing.lg}px`,
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.card,
          position: 'relative',
        }}>
           <button
            onClick={() => navigate('/settings')}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary
            }}
          >
            <Settings size={22} />
          </button>
          <div style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: colors.backgroundSecondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.lg,
            overflow: 'hidden',
          }}>
            {userData?.photoURL ? (
              <img src={userData.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <ThemedText style={{ fontSize: 40, fontWeight: 'bold' }}>{initial}</ThemedText>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
            <ThemedText style={{ fontSize: typography.sizes.xl, fontWeight: 'bold' }}>{displayName}</ThemedText>
            {(userData?.role === 'teacher' || userData?.role === 'admin') && (
              <Star size={20} color={colors.primary} fill={colors.primary} />
            )}
          </div>
          <ThemedText style={{ fontSize: typography.sizes.sm, opacity: 0.6, marginBottom: spacing.lg }}>
            {userData?.email || currentUser?.email}
          </ThemedText>

          <button
            onClick={() => navigate('/edit-profile')}
            style={{
              padding: '10px 24px',
              borderRadius: 20,
              backgroundColor: colors.primary,
              color: '#FFF',
              border: 'none',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Editar Perfil
          </button>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          margin: `${spacing.lg}px ${spacing.lg}px`,
          padding: spacing.lg,
          borderRadius: 20,
          backgroundColor: colors.backgroundSecondary,
        }}>
          <div style={{ textAlign: 'center' }}>
            <ThemedText style={{ fontSize: 24, fontWeight: 'bold', display: 'block' }}>12</ThemedText>
            <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>Canales</ThemedText>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ThemedText style={{ fontSize: 24, fontWeight: 'bold', display: 'block' }}>48</ThemedText>
            <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>Mensajes</ThemedText>
          </div>
          <div style={{ textAlign: 'center' }}>
            <ThemedText style={{ fontSize: 24, fontWeight: 'bold', display: 'block' }}>5</ThemedText>
            <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>Amigos</ThemedText>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ padding: spacing.lg }}>
          <ThemedText style={{ fontSize: typography.sizes.lg, fontWeight: 'bold', marginBottom: spacing.md, display: 'block' }}>
            Acciones Rápidas
          </ThemedText>

          {[
            { title: 'Mensajes Guardados', subtitle: 'Ver contenido guardado', Icon: Bookmark },
            { title: 'Amigos', subtitle: 'Gestionar lista de amigos', Icon: Users },
            { title: 'Mejores Amigos', subtitle: 'Tus conexiones más cercanas', Icon: Star },
          ].map((action, idx) => (
            <button
              key={idx}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.md,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.card,
                marginBottom: spacing.sm,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = colors.card)}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: `${colors.primary}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <action.Icon size={20} color={colors.primary} />
              </div>
              <div style={{ flex: 1 }}>
                <ThemedText style={{ fontSize: typography.sizes.md, fontWeight: '600', display: 'block' }}>{action.title}</ThemedText>
                <ThemedText style={{ fontSize: typography.sizes.sm, opacity: 0.6, display: 'block' }}>{action.subtitle}</ThemedText>
              </div>
              <ChevronRight size={18} color={colors.textSecondary} />
            </button>
          ))}
        </div>
      </div>
    </ThemedView>
  );
}
