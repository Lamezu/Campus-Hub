import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  isDesktop: boolean;
}

export default function Sidebar({ isDesktop }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/home', icon: '🏠', label: 'Home' },
    { path: '/explore', icon: '🔍', label: 'Explore' },
    { path: '/create', icon: '➕', label: 'Create' },
    { path: '/messages', icon: '💬', label: 'Messages' },
    { path: '/profile', icon: '👤', label: 'Profile' },
  ];

  if (!isDesktop) return null;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>CampusHub</h2>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.path}
            className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}