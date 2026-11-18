import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const DEFAULT_DECISION_DATA = [
  { decision: 'ALLOW', count: 2480, color: '#10b981' },
  { decision: 'REQUIRE APPROVAL', count: 310, color: '#f59e0b' },
  { decision: 'DENY', count: 145, color: '#ef4444' },
];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="glass-card p-2.5 shadow-xl border border-white/10 text-xs">
        <p className="font-semibold text-white mb-1">{data.decision}</p>
        <p className="font-mono text-slate-300">
          Decisions:{' '}
          <span className="font-bold text-white">{data.count.toLocaleString()}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const DecisionChart = ({
  data = DEFAULT_DECISION_DATA,
  title = 'Policy Decisions Enforcement',
  subtitle = 'Breakdown of gateway evaluation results',
}) => {
  return (
    <div className="glass-card p-5 h-full flex flex-col justify-between">
      <div>
        <h4 className="text-base font-semibold text-white tracking-tight">{title}</h4>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      <div className="w-full h-56 my-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
            <XAxis
              dataKey="decision"
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
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`bar-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-around pt-3 border-t border-surface-800 text-xs">
        {data.map((item) => (
          <div key={item.decision} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-300 font-medium">{item.decision}:</span>
            <span className="font-mono text-white font-semibold">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DecisionChart;
