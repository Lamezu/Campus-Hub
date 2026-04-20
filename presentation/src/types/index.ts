import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Variants } from 'framer-motion';

export interface SlideProps {
  isActive: boolean;
}

export interface SlideConfig {
  id: string;
  label: string;
  num: string;
  Component: ComponentType<SlideProps>;
}

export interface TechChip {
  label: string;
  color: 'blue' | 'green' | 'purple' | 'amber';
}

export interface TeamMember {
  initial: string;
  name: string;
  role: string;
  roleColor: string;
  gradient: string;
  avatarGradient: string;
  stack: string;
  chips: TechChip[];
  highlights: string[];
}

export interface ProblemCard {
  Icon: LucideIcon;
  colorClass: 'red' | 'amber' | 'purple' | 'slate';
  iconColor: string;
  title: string;
  desc: string;
  image?: string;
}

export interface PlatformData {
  key: string;
  Icon: LucideIcon;
  iconColor: string;
  name: string;
  tech: string;
  feats: string[];
}

export interface ArchNode {
  icon: LucideIcon;
  name: string;
  tech: string;
  color: 'blue' | 'green' | 'purple' | 'amber';
}

export interface FeatureModule {
  Icon: LucideIcon;
  color: string;
  bg: string;
  name: string;
  desc: string;
}

export interface SprintTag {
  label: string;
  color: string;
}

export interface Sprint {
  num: string;
  text: string;
  tags: SprintTag[];
  details?: string;
}

export interface PlanningMetric {
  label: string;
  val: string;
}

export interface GalleryImage {
  id: string;
  src?: string;
  placeholderColor?: string;
  title: string;
}

export interface QRLink {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  qrText: string;
  urlText: string;
  borderColor: string;
  qrImage: string | null;
  isDesktop?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  rot: number;
  rotSpeed: number;
  shape: 'star' | 'circle';
}

export const CONTAINER_VARIANTS: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

export const ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
};

export const ITEM_VARIANTS_Y_SMALL: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export const ITEM_VARIANTS_X_LEFT: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export const ITEM_VARIANTS_FROM_RIGHT: Variants = {
  hidden: { opacity: 0, x: 30, scale: 0.96 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export const ITEM_VARIANTS_FROM_LEFT_SCALE: Variants = {
  hidden: { opacity: 0, x: -30, scale: 0.96 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export const ITEM_VARIANTS_Y_LARGE: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};
