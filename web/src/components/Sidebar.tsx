import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Compass, GraduationCap, MessagesSquare, User, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface SidebarProps {
  isDesktop: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isDesktop, collapsed, onToggle }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const menuItems = [
    { path: '/home', icon: Home, label: t('tabs.home') },
    { path: '/campus', icon: GraduationCap, label: t('tabs.campus') },
    { path: '/explore', icon: Compass, label: t('tabs.explore') },
    { path: '/messages', icon: MessagesSquare, label: t('tabs.messages') },
    { path: '/profile', icon: User, label: t('tabs.profile') },
  ];

  if (!isDesktop) return null;

  const sidebarWidth = collapsed ? 72 : 280;

  return (
    <div
      className="sidebar"
      style={{
        width: sidebarWidth,
        transition: 'width 0.25s ease',
        overflow: 'hidden',
        padding: collapsed ? '24px 12px' : '24px 16px',
      }}
    >
      <div
        className="sidebar-header"
        style={{
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          marginBottom: collapsed ? 24 : 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? 0 : '0 4px 0 12px',
        }}
      >
        {!collapsed && <h2 style={{ margin: 0 }}>CampusHub</h2>}
        <button
          onClick={onToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            padding: 6,
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          title={collapsed ? t('common.expand') : t('common.collapse')}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav" style={{ flex: 1 }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              title={collapsed ? item.label : undefined}
              style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '12px' : '12px 16px' }}
            >
              <Icon
                size={20}
                className="sidebar-icon"
                strokeWidth={isActive ? 2.5 : 2}
                style={{ marginRight: collapsed ? 0 : 12, flexShrink: 0 }}
              />
              {!collapsed && <span className="sidebar-label">{item.label}</span>}
            </button>
          );
        })}
      </nav>

    </div>
  );
}