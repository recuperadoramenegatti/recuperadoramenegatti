'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-hero text-black shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 hover:brightness-110',
        secondary:
          'border border-[var(--borda-1)] bg-[var(--superficie-3)] text-foreground backdrop-blur-sm hover:bg-[var(--superficie-4)]',
        outline:
          'border border-[var(--borda-2)] bg-transparent text-foreground hover:border-[var(--borda-2)] hover:bg-[var(--superficie-3)]',
        ghost: 'text-muted-foreground hover:bg-[var(--superficie-3)] hover:text-foreground',
        destructive: 'bg-gradient-alerta text-white shadow-lg shadow-red-500/20 hover:brightness-110',
        success: 'bg-gradient-sucesso text-white shadow-lg shadow-emerald-500/20 hover:brightness-110',
        ia: 'bg-gradient-ia text-white shadow-lg shadow-violet-500/25 hover:brightness-110',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-12 rounded-xl px-6 text-base',
        icon: 'h-10 w-10',
        'icon-sm': 'h-8 w-8 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  carregando?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, carregando = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || carregando}
        {...props}
      >
        {carregando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
