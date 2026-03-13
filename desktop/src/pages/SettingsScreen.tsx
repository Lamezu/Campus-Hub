import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, type AppTheme } from '@/constants/styles';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { LogOut, Check, Palette, User, Settings as SettingsIcon, ChevronLeft } from 'lucide-react';
import { AlertModal } from '@/components/AlertModal';

const PRESET_COLORS = [
  '#007AFF', '#FF2D55', '#5856D6', '#AF52DE',
  '#FF9500', '#FFCC00', '#34C759', '#5AC8FA',
  '#FF3B30', '#8E8E93', '#E91E63', '#9C27B0',
  '#3F51B5', '#00BCD4', '#009688', '#4CAF50',
  '#FFEB3B', '#FF9800', '#FF5722', '#795548'
];

export default function SettingsScreen() {
  const [userData, setUserData] = useState<any>(null);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();
  const { theme, colors, setTheme, setCustomPrimary, customPrimary, chatSettings, setChatSettings } = useTheme();

  useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' | 'confirm'; onConfirm?: () => void }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' | 'confirm' = 'info', onConfirm?: () => void) => {
    setAlertConfig({ isOpen: true, title, message, type, onConfirm });
  };

  const handleLogout = () => {
    showAlert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      'confirm',
      async () => {
        try {
          await signOut(auth);
          navigate('/login');
        } catch (error) {
          showAlert('Error', 'No se pudo cerrar sesión', 'error');
        }
      }
    );
  };

  const ThemeOption = ({ id, label, current }: { id: AppTheme; label: string; current: boolean }) => (
    <button
      onClick={() => setTheme(id)}
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 12,
        border: `1px solid ${current ? colors.primary : colors.border}`,
        backgroundColor: current ? `${colors.primary}15` : colors.card,
        marginBottom: spacing.sm,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      <ThemedText style={{ fontWeight: '600', color: current ? colors.primary : colors.text }}>
        {label}
      </ThemedText>
      {current && <Check size={18} color={colors.primary} />}
    </button>
  );

  return (
    <ThemedView style={{ flex: 1, height: '100%', overflowY: 'auto', backgroundColor: colors.background }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: spacing.xl }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
          <button 
            onClick={() => navigate(-1)}
            style={{ 
              background: 'none', border: 'none', cursor: 'pointer', 
              color: colors.text, display: 'flex', alignItems: 'center',
              padding: 4, borderRadius: '50%', transition: 'background-color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ChevronLeft size={28} />
          </button>
          <SettingsIcon size={32} color={colors.primary} />
          <ThemedText style={{ fontSize: 32, fontWeight: 'bold' }}>Ajustes</ThemedText>
        </div>

        {/* Theme Section */}
        <section style={{ marginBottom: spacing.xl }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <Palette size={20} color={colors.primary} />
            <ThemedText style={{ fontSize: 20, fontWeight: 'bold' }}>Tema y Apariencia</ThemedText>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: spacing.md }}>
            <ThemeOption id="light" label="Modo Claro" current={theme === 'light'} />
            <ThemeOption id="dark" label="Modo Oscuro" current={theme === 'dark'} />
            <ThemeOption id="high-contrast" label="Alta Contraste" current={theme === 'high-contrast'} />
            <ThemeOption id="pastel" label="Pastel" current={theme === 'pastel'} />
          </div>

          <div style={{ marginTop: spacing.lg }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '600', display: 'block', marginBottom: spacing.sm }}>Color de Acento</ThemedText>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.md }}>
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setCustomPrimary(color)}
                  style={{
                    width: 44, height: 44, borderRadius: '50%', border: customPrimary === color ? `3px solid ${colors.text}` : 'none',
                    backgroundColor: color, cursor: 'pointer', transition: 'transform 0.1s',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                  onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Profile Section */}
        <section style={{ marginBottom: spacing.xl }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
            <User size={20} color={colors.primary} />
            <ThemedText style={{ fontSize: 20, fontWeight: 'bold' }}>Cuenta</ThemedText>
          </div>
          <div style={{ backgroundColor: colors.card, borderRadius: 12, padding: spacing.lg, border: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <ThemedText style={{ opacity: 0.6 }}>Nombre de usuario</ThemedText>
              <ThemedText style={{ fontWeight: '600' }}>{userData?.displayName || currentUser?.displayName || 'Usuario'}</ThemedText>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <ThemedText style={{ opacity: 0.6 }}>Email</ThemedText>
              <ThemedText style={{ fontWeight: '600' }}>{userData?.email || currentUser?.email}</ThemedText>
            </div>
          </div>
          <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.md }}>
             <button
              onClick={() => navigate('/edit-profile')}
              style={{
                flex: 1, padding: '12px', borderRadius: 10, border: `1px solid ${colors.primary}`,
                color: colors.primary, backgroundColor: 'transparent', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Editar Perfil
            </button>
            <button
              onClick={() => navigate('/account-details')}
              style={{
                flex: 1, padding: '12px', borderRadius: 10, border: `1px solid ${colors.primary}`,
                color: colors.primary, backgroundColor: 'transparent', fontWeight: '600', cursor: 'pointer'
              }}
            >
              Detalles de la Cuenta
            </button>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '16px', borderRadius: 12, backgroundColor: colors.danger,
              color: '#FFF', border: 'none', fontWeight: 'bold', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm
            }}
          >
            <LogOut size={20} />
            Cerrar Sesión
          </button>
        </section>

      </div>
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        showCancelButton={alertConfig.type === 'confirm'}
        confirmText={alertConfig.type === 'confirm' ? 'Cerrar Sesión' : 'Entendido'}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </ThemedView>
  );
}
