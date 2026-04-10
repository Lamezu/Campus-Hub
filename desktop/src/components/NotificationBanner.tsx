import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, MessageSquare, Info } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { notificationService } from '@/services/notificationService';
import type { NotificationItem } from '@/types';

export function NotificationBanner() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [notification, setNotification] = useState<NotificationItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    notificationService.onNewNotification((n) => {
      setNotification(n);
      setIsVisible(true);
      // Auto hide after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
      return () => clearTimeout(timer);
    });
  }, []);

  if (!notification || !isVisible) return null;

  const handleAction = () => {
    setIsVisible(false);
    if (notification.category === 'channel' && notification.meta?.channelId) {
      navigate(`/chat/${notification.meta.channelId}`);
    } else if (notification.category === 'dm' && notification.meta?.participantId) {
      navigate(`/dm/${notification.meta.participantId}`);
    } else if (notification.meta?.groupId) {
      navigate(`/dm/group/${notification.meta.groupId}`);
    } else {
      navigate('/notifications');
    }
  };

  const getIcon = () => {
    switch (notification.category) {
      case 'channel': return <MessageSquare size={20} />;
      case 'dm': return <MessageSquare size={20} />;
      default: return <Bell size={20} />;
    }
  };

  return (
    <div 
      onClick={handleAction}
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        width: 380,
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: '16px 20px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        border: `2px solid ${colors.primary}40`,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        zIndex: 9999,
        animation: 'slideIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
        transition: 'transform 0.2s, opacity 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: colors.primary + '15',
        color: colors.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {getIcon()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: colors.text, marginBottom: 2 }}>{notification.title}</div>
        <div style={{ fontSize: 13, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {notification.body}
        </div>
      </div>

      <button 
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(false);
        }}
        style={{
          background: 'none',
          border: 'none',
          color: colors.textSecondary,
          cursor: 'pointer',
          padding: 4,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <X size={18} />
      </button>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%) scale(0.9); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
