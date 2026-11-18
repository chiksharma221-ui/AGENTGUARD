import React from 'react';

const BADGE_VARIANTS = {
  // Risk levels
  LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/30',

  // Policy Decisions
  ALLOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  DENY: 'bg-red-500/15 text-red-400 border-red-500/30',
  REQUIRE_APPROVAL: 'bg-amber-500/10 text-amber-400 border-amber-500/20',

  // Approvals Status
  PENDING: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-red-500/15 text-red-400 border-red-500/30',
  EXPIRED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',

  // Agent/User Status
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  DISABLED: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  INACTIVE: 'bg-slate-500/10 text-slate-400 border-slate-500/20',

  // Generic / Roles
  DEFAULT: 'bg-surface-800 text-slate-300 border-surface-700',
  ADMIN: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
  SECURITY: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  OPERATOR: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  AUDITOR: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

const DOT_COLORS = {
  LOW: 'bg-emerald-400',
  MEDIUM: 'bg-amber-400',
  HIGH: 'bg-orange-400',
  CRITICAL: 'bg-red-400 animate-pulse',
  ALLOW: 'bg-emerald-400',
  DENY: 'bg-red-400',
  REQUIRE_APPROVAL: 'bg-amber-400 animate-pulse',
  PENDING: 'bg-sky-400 animate-pulse',
  APPROVED: 'bg-emerald-400',
  REJECTED: 'bg-red-400',
  EXPIRED: 'bg-slate-400',
  ACTIVE: 'bg-emerald-400',
  DISABLED: 'bg-slate-500',
};

export const Badge = ({
  children,
  variant,
  status,
  withDot = false,
  className = '',
  size = 'md',
}) => {
  const normalizedKey = (variant || status || 'DEFAULT')
    .toString()
    .toUpperCase()
    .replace(/\s+/g, '_');

  const variantClass = BADGE_VARIANTS[normalizedKey] || BADGE_VARIANTS.DEFAULT;
  const dotColor = DOT_COLORS[normalizedKey] || 'bg-slate-400';

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3 py-1.5 gap-2 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-wide font-mono ${variantClass} ${sizeStyles[size] || sizeStyles.md} ${className}`}
    >
      {withDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
        />
      )}
      <span>{children || normalizedKey}</span>
    </span>
  );
};

export default Badge;
