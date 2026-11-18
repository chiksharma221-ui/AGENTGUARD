import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export const Button = React.forwardRef(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled = false,
      icon: Icon,
      iconRight: IconRight,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-950 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary:
        'bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white shadow-md shadow-primary-950/40 focus:ring-primary-500 border border-primary-500/30',
      secondary:
        'bg-surface-800 hover:bg-surface-750 text-slate-200 hover:text-white border border-surface-700/60 focus:ring-slate-500 shadow-sm',
      danger:
        'bg-gradient-to-r from-danger-600 to-red-600 hover:from-danger-500 hover:to-red-500 text-white shadow-md shadow-danger-950/40 focus:ring-danger-500 border border-danger-500/30',
      success:
        'bg-gradient-to-r from-success-600 to-emerald-600 hover:from-success-500 hover:to-emerald-500 text-white shadow-md shadow-success-950/40 focus:ring-success-500 border border-success-500/30',
      ghost:
        'bg-transparent hover:bg-surface-800 text-slate-300 hover:text-white focus:ring-slate-500',
      outline:
        'bg-transparent border border-surface-700 hover:border-slate-500 text-slate-300 hover:text-white hover:bg-surface-800/40 focus:ring-slate-500',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 rounded-md gap-1.5',
      md: 'text-sm px-4 py-2 rounded-lg gap-2',
      lg: 'text-base px-5 py-2.5 rounded-lg gap-2.5',
      icon: 'p-2 rounded-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : Icon ? (
          <Icon className="w-4 h-4 shrink-0" />
        ) : null}
        <span>{children}</span>
        {!isLoading && IconRight && <IconRight className="w-4 h-4 shrink-0" />}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
