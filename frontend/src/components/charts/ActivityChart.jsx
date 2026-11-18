import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const DEFAULT_DATA = [
  { time: '00:00', invocations: 124, blocked: 4 },
  { time: '04:00', invocations: 82, blocked: 2 },
  { time: '08:00', invocations: 432, blocked: 18 },
  { time: '12:00', invocations: 789, blocked: 32 },
  { time: '16:00', invocations: 940, blocked: 41 },
  { time: '20:00', invocations: 512, blocked: 15 },
  { time: '23:59', invocations: 260, blocked: 8 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 shadow-xl border border-white/10 text-xs">
        <p className="font-semibold text-slate-300 mb-1.5">{label}</p>
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-primary-400">
            <span className="w-2 h-2 rounded-full bg-primary-500" />
            <span>Total Invocations:</span>
            <span className="font-mono font-bold text-white">{payload[0]?.value}</span>
          </p>
          {payload[1] && (
            <p className="flex items-center gap-2 text-danger-400">
              <span className="w-2 h-2 rounded-full bg-danger-500" />
              <span>Blocked / Flagged:</span>
              <span className="font-mono font-bold text-white">{payload[1]?.value}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export const ActivityChart = ({ data = DEFAULT_DATA, title = 'Invocation Activity', subtitle = 'Agent tool calls over time' }) => {
  const [timeframe, setTimeframe] = useState('24h');

  return (
    <div className="glass-card p-5 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-base font-semibold text-white tracking-tight">{title}</h4>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1 bg-surface-850 p-1 rounded-lg border border-surface-800">
          {['24h', '7d', '30d'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                timeframe === tf
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-64 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="invocationsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="blockedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="invocations"
              stroke="#6366f1"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#invocationsGradient)"
            />
            <Area
              type="monotone"
              dataKey="blocked"
              stroke="#ef4444"
              strokeWidth={1.5}
              fillOpacity={1}
              fill="url(#blockedGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-surface-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
          <span className="text-slate-300">Allowed Invocations</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-danger-500" />
          <span className="text-slate-300">Blocked / Violations</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityChart;
