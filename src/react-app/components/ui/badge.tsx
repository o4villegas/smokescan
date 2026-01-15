import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        // Zone variants (FDAM)
        burn: 'border-zone-burn/30 bg-zone-burn/20 text-zone-burn',
        'near-field': 'border-zone-near-field/30 bg-zone-near-field/20 text-zone-near-field',
        'far-field': 'border-zone-far-field/30 bg-zone-far-field/20 text-zone-far-field',
        // Severity variants (FDAM)
        heavy: 'border-severity-heavy/30 bg-severity-heavy/20 text-severity-heavy',
        moderate: 'border-severity-moderate/30 bg-severity-moderate/20 text-severity-moderate',
        light: 'border-severity-light/30 bg-severity-light/20 text-severity-light',
        trace: 'border-severity-trace/30 bg-severity-trace/20 text-severity-trace',
        none: 'border-severity-none/30 bg-severity-none/20 text-severity-none',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
