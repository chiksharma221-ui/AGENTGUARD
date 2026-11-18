import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const DEFAULT_RISK_DATA = [
  { name: 'Low Risk', value: 1420, color: '#10b981' },
  { name: 'Medium Risk', value: 480, color: '#f59e0b' },
  { name: 'High Risk', value: 165, color: '#f97316' },
  { name: 'Critical Risk', value: 42, color: '#ef4444' },
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="glass-card p-2.5 shadow-xl border border-white/10 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: data.payload.color }}
          />
          <span className="font-semibold text-slate-200">{data.name}</span>
        </div>
        <p className="mt-1 font-mono text-slate-400">
          <span className="text-white font-bold">{data.value}</span> events
        </p>
      </div>
    );
  }
  return null;
};

export const RiskDistribution = ({
  data = DEFAULT_RISK_DATA,
  title = 'Risk Assessment Distribution',
  subtitle = 'Evaluated tool call severity levels',
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="glass-card p-5 h-full flex flex-col justify-between">
      <div>
        <h4 className="text-base font-semibold text-white tracking-tight">{title}</h4>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      <div className="relative w-full h-56 my-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={60}
              outerRadius={85}
              paddingAngle={4}
              dataKey="value"
              stroke="transparent"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Total Count Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold font-mono text-white tracking-tight">
            {total.toLocaleString()}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
            Total Scanned
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-surface-800 text-xs">
        {data.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.name} className="flex items-center justify-between p-1.5 rounded-lg bg-surface-850/50">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-300 truncate text-[11px]">{item.name}</span>
              </div>
              <span className="font-mono text-slate-400 text-[11px] font-medium">
                {percent}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RiskDistribution;
