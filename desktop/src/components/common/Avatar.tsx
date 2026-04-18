import React, { useState } from 'react';
import { User } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '../themed-text';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  style?: React.CSSProperties;
}

export function Avatar({ src, name, size = 40, style }: AvatarProps) {
  const { colors } = useTheme();
  const [error, setError] = useState(false);

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: 'hidden',
    backgroundColor: colors.backgroundSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `1px solid ${colors.border}`,
    flexShrink: 0,
    ...style
  };

  if (src && !error) {
    return (
      <div style={containerStyle}>
        <img 
          src={src} 
          alt={name} 
          onError={() => setError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      </div>
    );
  }

  const initials = name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '';

  return (
    <div style={{ ...containerStyle, backgroundColor: colors.primary + '20' }}>
      {initials ? (
        <ThemedText style={{ 
          fontSize: size * 0.4, 
          fontWeight: 800, 
          color: colors.primary 
        }}>
          {initials}
        </ThemedText>
      ) : (
        <User size={size * 0.6} color={colors.primary} />
      )}
    </div>
  );
}
