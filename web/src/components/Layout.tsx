import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useWindowSize } from '../hooks/useWindowSize';
import { Home, Compass, GraduationCap, MessagesSquare, User } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  showBackButton?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  titleAlignLeft?: boolean;
}

export default function Layout({
  children,
  title,
  showBackButton = false,
  onBack,
  rightAction,
  titleAlignLeft = false
}: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useWindowSize();
  const [userId, setUserId] = useState<string | null>(null);

  const getScopedKey = (uid: string | null) => uid ? `sidebarCollapsed_${uid}` : 'sidebarCollapsed';

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return false;
  });

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      const uid = user ? user.uid : null;
      setUserId(uid);
      const scopedKey = getScopedKey(uid);
      let isCollapsed = localStorage.getItem(scopedKey);

      if (uid && isCollapsed === null && localStorage.getItem('sidebarCollapsed') !== null) {
        isCollapsed = localStorage.getItem('sidebarCollapsed');
        localStorage.setItem(scopedKey, isCollapsed as string);
        localStorage.removeItem('sidebarCollapsed');
      }

      setCollapsed(isCollapsed === 'true');

      if (uid) {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) {
            const data = snap.data();
            const appSettings = data?.appSettings || {};
            if (appSettings.sidebarCollapsed !== undefined) {
              const cloudValue = String(appSettings.sidebarCollapsed);
              if (cloudValue !== String(isCollapsed === 'true')) {
                localStorage.setItem(scopedKey, cloudValue);
                setCollapsed(appSettings.sidebarCollapsed);
              }
            }
          }
        } catch (e) {
          console.error("Error fetching sidebar setting:", e);
        }
      }
    });
    return unsub;
  }, []);

  const asyncSyncSidebar = async (val: boolean) => {
    if (userId) {
      try {
        await setDoc(doc(db, 'users', userId), {
          appSettings: {
            sidebarCollapsed: val
          }
        }, { merge: true });
      } catch (e) { }
    }
  };

  const handleToggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(getScopedKey(userId), String(next));
      asyncSyncSidebar(next);
      return next;
    });
  };

  const sidebarWidth = isDesktop ? (collapsed ? 72 : 280) : 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isDesktop={isDesktop} collapsed={collapsed} onToggle={handleToggle} />

      <div style={{
        marginLeft: sidebarWidth,
        transition: 'margin-left 0.25s ease',
        width: `calc(100% - ${sidebarWidth}px)`,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--background)',
        minHeight: '100vh',
      }}>
        <header className="header" style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'var(--background)',
          borderBottom: '1px solid var(--border)'
        }}>
          <div className="header-content" style={{
            maxWidth: isDesktop ? 'none' : '600px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            padding: '0 16px',
            height: '56px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              {showBackButton && (
                <button
                  className="settings-button"
                  onClick={onBack || (() => navigate(-1))}
                  style={{
                    fontSize: '24px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    marginLeft: '-8px'
                  }}
                >
                  ←
                </button>
              )}
            </div>

            <h1
              className="text-title"
              style={{
                margin: 0,
                fontSize: '17px',
                fontWeight: '600',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '200px'
              }}
            >
              {title}
            </h1>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {rightAction && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{rightAction}</div>
              )}
            </div>
          </div>
        </header>

        <main className="animate-fade-in" style={{
          flex: 1,
          backgroundColor: 'var(--background)',
          paddingBottom: isDesktop ? '0' : '80px'
        }}>
          {children}
        </main>

        {!isDesktop && (
          <footer className="nav-footer">
            <ul className="nav-items">
              <li
                className={`nav-item ${location.pathname === '/home' ? 'active' : ''}`}
                onClick={() => navigate('/home')}
              >
                <span className="nav-icon"><Home /></span>
                <span>Inicio</span>
              </li>
              <li
                className={`nav-item ${location.pathname === '/create' ? 'active' : ''}`}
                onClick={() => navigate('/campus')}
              >
                <span className="nav-icon"><GraduationCap /></span>
                <span>Campus</span>
              </li>
              <li
                className={`nav-item ${location.pathname === '/explore' ? 'active' : ''}`}
                onClick={() => navigate('/explore')}
              >
                <span className="nav-icon"><Compass /></span>
                <span>Explorar</span>
              </li>
              <li
                className={`nav-item ${location.pathname === '/messages' ? 'active' : ''}`}
                onClick={() => navigate('/messages')}
              >
                <span className="nav-icon"><MessagesSquare /></span>
                <span>Mensajes</span>
              </li>
              <li
                className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
                onClick={() => navigate('/profile')}
              >
                <span className="nav-icon"><User /></span>
                <span>Perfil</span>
              </li>
            </ul>
          </footer>
        )}
      </div>
    </div>
  );
}