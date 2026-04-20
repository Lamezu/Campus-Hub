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
import { Avatar } from '@/components/common/Avatar';
import { useUser } from '@/contexts/UserContext';
import { Bell, HelpCircle, Settings } from 'lucide-react';

export default function TabsLayout() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { userData } = useUser();
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
        width: isCollapsed ? 80 : 260,
        minWidth: isCollapsed ? 80 : 260,
        backgroundColor: colors.card,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 0',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '4px 0 24px rgba(0,0,0,0.02)',
      }}>
        <div style={{ 
          padding: isCollapsed ? '0 0 24px' : '0 20px 24px', 
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between' }}>
            {!isCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <GraduationCap size={20} color="#fff" />
                </div>
                <span style={{ fontSize: 18, fontWeight: '850', color: colors.text, fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.5px' }}>
                  CampusHub
                </span>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderRadius: 10,
                backgroundColor: colors.backgroundSecondary, transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = colors.primary;
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = colors.textSecondary;
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {!isCollapsed && userData && (
            <div 
              onClick={() => navigate('/tabs/profile')}
              style={{ 
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: 16, 
                backgroundColor: colors.backgroundSecondary, cursor: 'pointer', transition: 'all 0.2s',
                border: `1px solid ${colors.border}40`
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = `${colors.primary}10`}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
            >
              <Avatar src={userData.photoURL} name={userData.displayName} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: '700', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userData.displayName}</div>
                <div style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'capitalize' }}>{userData.role}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, padding: '0 12px' }}>
          {!isCollapsed && (
            <div style={{ padding: '0 12px 10px', fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Menu
            </div>
          )}
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
                  padding: '12px 14px',
                  borderRadius: 14,
                  marginBottom: 6,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: active ? `${colors.primary}` : 'transparent',
                  color: active ? '#fff' : colors.textSecondary,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  fontWeight: active ? '700' : '500',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: active ? `0 4px 12px ${colors.primary}40` : 'none',
                  position: 'relative'
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = colors.backgroundSecondary;
                    e.currentTarget.style.color = colors.text;
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = colors.textSecondary;
                    e.currentTarget.style.transform = 'translateX(0)';
                  }
                }}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {!isCollapsed && <span>{label}</span>}
                {active && !isCollapsed && (
                  <div style={{ position: 'absolute', right: 12, width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                )}
              </button>
            );
          })}

          {!isCollapsed && (
            <div style={{ padding: '20px 12px 10px', fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Otros
            </div>
          )}
          
          {[
            { id: 'notifs', path: '/notifications', label: t('notifications_screen.title'), Icon: Bell },
            { id: 'settings', path: '/settings', label: t('settings.title'), Icon: Settings },
          ].map(({ id, path, label, Icon }) => (
            <button
              key={id}
              onClick={() => navigate(path)}
              title={isCollapsed ? label : undefined}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: isCollapsed ? 0 : 12, width: '100%', padding: '12px 14px', borderRadius: 14, marginBottom: 4,
                border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: colors.textSecondary,
                fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: '500', transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = colors.backgroundSecondary;
                e.currentTarget.style.color = colors.text;
                if (!isCollapsed) e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = colors.textSecondary;
                if (!isCollapsed) e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <Icon size={22} strokeWidth={2} />
              {!isCollapsed && <span>{label}</span>}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 12px', marginTop: 'auto', paddingTop: 16 }}>
          <button
            onClick={handleLogout}
            title={isCollapsed ? t('tabs.logout') : undefined}
            style={{
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: isCollapsed ? 0 : 12,
              width: '100%', padding: '14px', borderRadius: 16,
              border: 'none', cursor: 'pointer',
              backgroundColor: `${colors.danger}10`,
              color: colors.danger,
              fontFamily: 'Inter, sans-serif',
              fontSize: 14, fontWeight: '700',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = colors.danger;
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = `${colors.danger}10`;
              e.currentTarget.style.color = colors.danger;
            }}
          >
            <LogOut size={22} strokeWidth={2.5} />
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
