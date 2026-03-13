import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { House, Compass, PlusCircle, MessagesSquare, UserRound, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import HomeScreen from './HomeScreen';
import ExploreScreen from './ExploreScreen';
import CreateScreen from './CreateScreen';
import MessagesScreen from './MessagesScreen';
import ProfileScreen from './ProfileScreen';

const TABS = [
  { id: 'home',     path: '/tabs/home',     label: 'Inicio',    Icon: House },
  { id: 'explore',  path: '/tabs/explore',  label: 'Explorar',  Icon: Compass },
  { id: 'create',   path: '/tabs/create',   label: 'Crear',     Icon: PlusCircle },
  { id: 'messages', path: '/tabs/messages', label: 'Mensajes',  Icon: MessagesSquare },
  { id: 'profile',  path: '/tabs/profile',  label: 'Perfil',    Icon: UserRound },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/auth/login', { replace: true });
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: colors.background, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 220,
        minWidth: 220,
        backgroundColor: colors.card,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0',
      }}>
        {/* Logo */}
        <div style={{ padding: '0 20px 20px', borderBottom: `1px solid ${colors.border}`, marginBottom: 8 }}>
          <span style={{
            fontSize: 22,
            fontWeight: 'bold',
            color: colors.primary,
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '-0.5px',
          }}>
            CampusHub
          </span>
        </div>

        {/* Nav tabs */}
        <div style={{ flex: 1, padding: '0 8px' }}>
          {TABS.map(({ id, path, label, Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={id}
                onClick={() => navigate(path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  marginBottom: 2,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: active ? `${colors.primary}18` : 'transparent',
                  color: active ? colors.primary : colors.textSecondary,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  fontWeight: active ? '600' : '400',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.backgroundColor = colors.backgroundSecondary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = active ? `${colors.primary}18` : 'transparent';
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <div style={{ padding: '0 8px', borderTop: `1px solid ${colors.border}`, marginTop: 8, paddingTop: 8 }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              width: '100%', padding: '10px 12px', borderRadius: 10,
              border: 'none', cursor: 'pointer',
              backgroundColor: 'transparent',
              color: colors.danger,
              fontFamily: 'Inter, sans-serif',
              fontSize: 14, fontWeight: '400',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${colors.danger}15`)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <LogOut size={20} strokeWidth={1.8} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="scrollable" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="home" element={<HomeScreen />} />
          <Route path="explore" element={<ExploreScreen />} />
          <Route path="create" element={<CreateScreen />} />
          <Route path="messages" element={<MessagesScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </div>
    </div>
  );
}
