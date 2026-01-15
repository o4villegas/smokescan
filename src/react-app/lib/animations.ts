/**
 * Motion animation variants for consistent micro-interactions
 * Uses motion v12+ (NOT framer-motion - incompatible with React 19)
 */

import type { Variants } from 'motion/react';

// Page transitions
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// Modal/dialog animations
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

// Sidebar animations
export const slideInLeft: Variants = {
  initial: { x: -300, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -300, opacity: 0 },
};

export const slideInRight: Variants = {
  initial: { x: 300, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 300, opacity: 0 },
};

// Card hover effects
export const cardHover = {
  scale: 1.02,
  transition: { duration: 0.2 },
};

export const cardTap = {
  scale: 0.98,
};

// Button press effect
export const buttonPress = {
  scale: 0.98,
  transition: { duration: 0.1 },
};

// List item stagger
export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// Skeleton shimmer (CSS-based, not motion)
export const shimmerKeyframes = {
  '0%': { transform: 'translateX(-100%)' },
  '100%': { transform: 'translateX(100%)' },
};

// Spring configs for natural motion
export const springConfig = {
  default: { type: 'spring', stiffness: 300, damping: 30 },
  gentle: { type: 'spring', stiffness: 200, damping: 25 },
  bouncy: { type: 'spring', stiffness: 400, damping: 20 },
};

// Transition presets
export const transitions = {
  fast: { duration: 0.15 },
  medium: { duration: 0.25 },
  slow: { duration: 0.4 },
};
