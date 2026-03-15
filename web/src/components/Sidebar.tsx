import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Compass, GraduationCap, MessagesSquare, User } from 'lucide-react';

interface SidebarProps {
  isDesktop: boolean;
}

export default function Sidebar({ isDesktop }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { path: '/home', icon: Home, label: 'Inicio' },
    { path: '/campus', icon: GraduationCap, label: 'Campus' },
    { path: '/explore', icon: Compass, label: 'Explorar' },
    { path: '/messages', icon: MessagesSquare, label: 'Mensajes' },
    { path: '/profile', icon: User, label: 'Perfil' },
  ];

  if (!isDesktop) return null;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>CampusHub</h2>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <Icon 
                size={20} 
                className="sidebar-icon"
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="sidebar-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}