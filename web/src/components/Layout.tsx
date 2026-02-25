import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useWindowSize } from '../hooks/useWindowSize';

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar isDesktop={isDesktop} />
      
      <div className={isDesktop ? 'main-content-with-sidebar' : ''} style={{ 
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--background)'
      }}>
        <header className="header" style={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 10,
          backgroundColor: 'var(--background)'
        }}>
          <div className="header-content" style={{ 
            maxWidth: isDesktop ? 'none' : '600px', 
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: showBackButton ? '4px' : '0'
          }}>
            {showBackButton && (
              <button 
                className="settings-button"
                onClick={onBack || (() => navigate(-1))}
                style={{ 
                  fontSize: '24px',
                  paddingLeft: '0',
                  marginLeft: '-8px'
                }}
              >
                ←
              </button>
            )}
            <h1 
              className="text-title" 
              style={{ 
                flex: 1,
                textAlign: titleAlignLeft ? 'left' : 'center'
              }}
            >
              {title}
            </h1>
            {rightAction && (
              <div>{rightAction}</div>
            )}
          </div>
        </header>

        <main style={{ 
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
                <span className="nav-icon">🏠</span>
                <span>Home</span>
              </li>
              <li 
                className={`nav-item ${location.pathname === '/explore' ? 'active' : ''}`}
                onClick={() => navigate('/explore')}
              >
                <span className="nav-icon">🔍</span>
                <span>Explore</span>
              </li>
              <li 
                className={`nav-item ${location.pathname === '/create' ? 'active' : ''}`}
                onClick={() => navigate('/create')}
              >
                <span className="nav-icon">➕</span>
                <span>Create</span>
              </li>
              <li 
                className={`nav-item ${location.pathname === '/messages' ? 'active' : ''}`}
                onClick={() => navigate('/messages')}
              >
                <span className="nav-icon">💬</span>
                <span>Messages</span>
              </li>
              <li 
                className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
                onClick={() => navigate('/profile')}
              >
                <span className="nav-icon">👤</span>
                <span>Profile</span>
              </li>
            </ul>
          </footer>
        )}
      </div>
    </div>
  );
}