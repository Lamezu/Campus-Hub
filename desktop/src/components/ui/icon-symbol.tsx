// Web fallback using font icons

import { CSSProperties } from 'react';

type IconMapping = Record<string, string>;

const MAPPING: IconMapping = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron_right',
} as const;

/**
 * An icon component that uses Material Icons on web.
 * Icon `name`s are based on SF Symbols and mapped to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
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
