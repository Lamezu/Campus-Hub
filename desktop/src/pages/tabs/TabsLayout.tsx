import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { House, Compass, MessagesSquare, UserRound, LogOut, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import HomeScreen from './HomeScreen';
import ExploreScreen from './ExploreScreen';
import CampusScreen from './CampusScreen';
import MessagesScreen from './MessagesScreen';
import ProfileScreen from './ProfileScreen';

export default function TabsLayout() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const TABS = [
    { id: 'home', path: '/tabs/home', label: t('tabs.home'), Icon: House },
    { id: 'campus', path: '/tabs/campus', label: t('tabs.campus'), Icon: GraduationCap },
    { id: 'explore', path: '/tabs/explore', label: t('tabs.explore'), Icon: Compass },
    { id: 'messages', path: '/tabs/messages', label: t('tabs.messages'), Icon: MessagesSquare },
    { id: 'profile', path: '/tabs/profile', label: t('tabs.profile'), Icon: UserRound },
  ];

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/auth/login', { replace: true });
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: colors.background, overflow: 'hidden' }}>
      <div style={{
        width: isCollapsed ? 70 : 220,
        minWidth: isCollapsed ? 70 : 220,
        backgroundColor: colors.card,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}>
        <div style={{ 
          padding: isCollapsed ? '0 0 20px' : '0 20px 20px', 
          borderBottom: `1px solid ${colors.border}`, 
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between'
        }}>
          {!isCollapsed && (
            <span style={{
              fontSize: 22,
              fontWeight: 'bold',
              color: colors.primary,
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '-0.5px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              CampusHub
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: 8,
              backgroundColor: colors.backgroundSecondary,
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = colors.primary}
            onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <div style={{ flex: 1, padding: '0 8px' }}>
          {TABS.map(({ id, path, label, Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={id}
                onClick={() => navigate(path)}
                title={isCollapsed ? label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: isCollapsed ? 0 : 12,
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
                {!isCollapsed && <span>{label}</span>}
              </button>
            );
          })}
        </div>

        <div style={{ padding: '0 8px', borderTop: `1px solid ${colors.border}`, marginTop: 8, paddingTop: 8 }}>
          <button
            onClick={handleLogout}
            title={isCollapsed ? t('tabs.logout') : undefined}
            style={{
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: isCollapsed ? 0 : 12,
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
            {!isCollapsed && <span>{t('tabs.logout')}</span>}
          </button>
        </div>
      </div>

      <div className="scrollable" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="home" element={<HomeScreen />} />
          <Route path="campus" element={<CampusScreen />} />
          <Route path="explore" element={<ExploreScreen />} />
          <Route path="messages" element={<MessagesScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
          <Route path="/" element={<Navigate to="home" replace />} />
          <Route path="*" element={<Navigate to="home" replace />} />
        </Routes>
      </div>
    </div>
  );
}
