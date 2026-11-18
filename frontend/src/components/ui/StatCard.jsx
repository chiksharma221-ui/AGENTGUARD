import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const StatCard = ({
  title,
  value = 0,
  icon: Icon,
  trend = null, // e.g. { value: 12.5, isUp: true } or +14% string
  color = 'primary', // 'primary' | 'success' | 'warning' | 'danger' | 'sky'
  description,
  suffix = '',
  prefix = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  // Smooth number counting animation on mount or value change
  useEffect(() => {
    const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(Math.floor(easeProgress * numericValue));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(numericValue);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  const colorStyles = {
    primary: {
      iconBg: 'bg-primary-500/10 text-primary-400 border border-primary-500/20',
      glow: 'group-hover:border-primary-500/40',
      accent: 'from-primary-500/20 to-transparent',
    },
    success: {
      iconBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      glow: 'group-hover:border-emerald-500/40',
      accent: 'from-emerald-500/20 to-transparent',
    },
    warning: {
      iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      glow: 'group-hover:border-amber-500/40',
      accent: 'from-amber-500/20 to-transparent',
    },
    danger: {
      iconBg: 'bg-red-500/10 text-red-400 border border-red-500/20',
      glow: 'group-hover:border-red-500/40',
      accent: 'from-red-500/20 to-transparent',
    },
    sky: {
      iconBg: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
      glow: 'group-hover:border-sky-500/40',
      accent: 'from-sky-500/20 to-transparent',
    },
  };

  const scheme = colorStyles[color] || colorStyles.primary;

  return (
    <div className={`relative overflow-hidden glass-card p-5 group transition-all duration-300 hover:-translate-y-1 ${scheme.glow}`}>
      {/* Subtle top edge gradient highlight */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${scheme.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-white font-mono">
              {prefix}
              {typeof value === 'number'
                ? displayValue.toLocaleString()
                : value}
              {suffix}
            </span>
          </div>
        </div>

        {Icon && (
          <div className={`p-3 rounded-xl ${scheme.iconBg} transition-transform duration-300 group-hover:scale-110 shadow-sm`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>

      {(trend || description) && (
        <div className="mt-4 flex items-center justify-between text-xs">
          {trend ? (
            <div className="flex items-center gap-1.5 font-medium">
              {trend.isUp ? (
                <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{trend.value}%
                </span>
              ) : trend.value === 0 ? (
                <span className="flex items-center gap-0.5 text-slate-400 bg-surface-800 px-1.5 py-0.5 rounded border border-surface-700">
                  <Minus className="w-3.5 h-3.5" />
                  0%
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                  <TrendingDown className="w-3.5 h-3.5" />
                  -{Math.abs(trend.value)}%
                </span>
              )}
              <span className="text-slate-400">vs last week</span>
            </div>
          ) : null}

          {description && (
            <span className="text-slate-400 ml-auto">{description}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
