import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-primary/30 bg-primary/15 text-primary',
        secondary: 'border-[var(--borda-1)] bg-[var(--superficie-3)] text-muted-foreground',
        success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
        warning: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
        destructive: 'border-red-500/30 bg-red-500/15 text-red-400',
        info: 'border-blue-500/30 bg-blue-500/15 text-blue-400',
        ia: 'border-violet-500/30 bg-violet-500/15 text-violet-400',
        outline: 'border-[var(--borda-2)] text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  pulsante?: boolean;
}

function Badge({ className, variant, pulsante = false, ...props }: BadgeProps): React.JSX.Element {
  return (
    <div
      className={cn(badgeVariants({ variant }), pulsante && 'animate-pulse-badge', className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
