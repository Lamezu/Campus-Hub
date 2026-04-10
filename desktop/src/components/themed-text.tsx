import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';

type TextType = 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';

interface ThemedTextProps {
  children?: React.ReactNode;
  type?: TextType;
  style?: React.CSSProperties;
  numberOfLines?: number;
  className?: string;
  onClick?: () => void;
}

export function ThemedText({
  children,
  type = 'default',
  style,
  numberOfLines,
  className,
  onClick,
}: ThemedTextProps) {
  const { colors } = useTheme();

  const baseStyle: React.CSSProperties = {
    color: colors.text,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: 0,
    padding: 0,
  };

  const typeStyles: Record<TextType, React.CSSProperties> = {
    default: { fontSize: 16, lineHeight: '24px' },
    title: { fontSize: 32, fontWeight: 'bold', lineHeight: '1.2' },
    defaultSemiBold: { fontSize: 16, fontWeight: '600', lineHeight: '24px' },
    subtitle: { fontSize: 20, fontWeight: '600', lineHeight: '1.3' },
    link: { fontSize: 16, lineHeight: '30px', color: colors.primary },
  };

  const overflowStyle: React.CSSProperties = numberOfLines
    ? {
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: numberOfLines,
        WebkitBoxOrient: 'vertical',
      }
    : {};

  const combinedStyle: React.CSSProperties = {
    ...baseStyle,
    ...typeStyles[type],
    ...style,
    ...overflowStyle,
  };

  if (type === 'title') {
    return <h1 style={combinedStyle} className={className} onClick={onClick}>{children}</h1>;
  }
  if (type === 'subtitle') {
    return <h2 style={combinedStyle} className={className} onClick={onClick}>{children}</h2>;
  }

  return (
    <span style={combinedStyle} className={className} onClick={onClick}>
      {children}
    </span>
  );
}
