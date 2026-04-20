import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ThemedText } from './themed-text';
import { notificationService } from '@/services/notificationService';
import { useTheme } from '@/contexts/ThemeContext';
import type { NotificationCategory } from '@/types';

interface NotificationBellProps {
  category?: NotificationCategory;
  categories?: NotificationCategory[];
  section?: string;
  size?: number;
}

export function NotificationBell({ category, categories, section, size = 22 }: NotificationBellProps) {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      if (categories) {
        const counts = categories.map(cat => notificationService.getUnreadCount(cat));
        setCount(counts.reduce((a, b) => a + b, 0));
      } else {
        setCount(notificationService.getUnreadCount(category));
      }
    };

    updateCount();
    const unsub = notificationService.subscribe(updateCount);
    return unsub;
  }, [category, categories]);

  const handlePress = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams();
    if (section) params.set('section', section);
    if (categories) params.set('categories', categories.join(','));
    else if (category) params.set('category', category);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    navigate(`/notifications${query}`);
  };

  return (
    <div 
      onClick={handlePress} 
      style={{ 
        padding: 8, 
        position: 'relative', 
        cursor: 'pointer', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        borderRadius: '50%',
        transition: 'background-color 0.2s'
      }}
      onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <Bell size={size} color={colors.text} strokeWidth={1.8} />
      {count > 0 && (
        <div style={{ 
          position: 'absolute', 
          top: 4, 
          right: 4, 
          minWidth: 16, 
          height: 16, 
          borderRadius: 8, 
          backgroundColor: colors.danger || '#FF3B30', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: '0 4px',
          border: `2px solid ${colors.card}`,
          boxSizing: 'content-box'
        }}>
          <ThemedText style={{ 
            color: '#fff', 
            fontSize: 9, 
            fontWeight: '800', 
            textAlign: 'center',
            lineHeight: '16px'
          }}>
            {count > 99 ? '99+' : count}
          </ThemedText>
        </div>
      )}
    </div>
  );
}
