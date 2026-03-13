// Web version - uses same Material Icons as web fallback

import { CSSProperties } from 'react';

type IconMapping = Record<string, string>;

const MAPPING: IconMapping = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron_right',
} as const;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: string;
  size?: number;
  color: string;
  style?: CSSProperties;
  weight?: string;
}) {
  const iconName = MAPPING[name as keyof typeof MAPPING] || name;
  
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        fontSize: size,
        color: color,
        ...style,
      } as CSSProperties}
      className="material-icons">
      {iconName}
    </span>
  );
}
