import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface ThemedViewProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

export function ThemedView({ children, style, className, onClick }: ThemedViewProps) {
  const { colors } = useTheme();

  return (
    <div
      style={{
        backgroundColor: colors.background,
        ...style,
      }}
      className={className}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
