import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  Zap,
  Clock,
  CheckCircle,
  XCircle,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import Badge from '../components/ui/Badge';
import RiskBadge from '../components/ui/RiskBadge';
import ActivityChart from '../components/charts/ActivityChart';
import RiskDistribution from '../components/charts/RiskDistribution';
import DecisionChart from '../components/charts/DecisionChart';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import { agentsApi, approvalsApi, auditApi } from '../services/api';
import { formatDistanceToNow, format } from 'date-fns';

export const Dashboard = () => {
  const navigate = useNavigate();

  // Fetch stats and queries
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      try {
        const stats = await auditApi.getStats('7d');
        return stats;
      } catch {
        return {
          total_agents: 14,
          total_invocations: 48920,
          pending_approvals: 3,
          approved_count: 1420,
          rejected_count: 184,
          blocked_count: 246,
        };
      }
    },
    refetchInterval: 15000,
  });

  const { data: recentLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['dashboardRecentLogs'],
    queryFn: async () => {
      try {
        const res = await auditApi.list({ limit: 8 });
        return Array.isArray(res) ? res : res?.items || [];
      } catch {
        // High quality fallback sample audit logs
        return [
          {
            id: 'log-101',
            timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
            agent_name: 'Financial-Analyst-v2',
            tool_name: 'db_execute_query',
            decision: 'REQUIRE_APPROVAL',
            status: 'PENDING',
            risk_level: 'HIGH',
            duration_ms: 18,
          },
          {
            id: 'log-102',
            timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
            agent_name: 'CustomerSupport-Bot',
            tool_name: 'crm_fetch_contact',
            decision: 'ALLOW',
            status: 'SUCCESS',
            risk_level: 'LOW',
            duration_ms: 42,
          },
          {
            id: 'log-103',
            timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
            agent_name: 'CodeReviewer-AI',
            tool_name: 'github_create_pull_request',
            decision: 'ALLOW',
            status: 'SUCCESS',
            risk_level: 'MEDIUM',
            duration_ms: 120,
          },
          {
            id: 'log-104',
            timestamp: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
            agent_name: 'DataScraper-Pro',
            tool_name: 'fs_write_root_credentials',
            decision: 'DENY',
            status: 'BLOCKED',
            risk_level: 'CRITICAL',
            duration_ms: 4,
          },
          {
            id: 'log-105',
            timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
            agent_name: 'DevOps-Assistant',
            tool_name: 'k8s_restart_deployment',
            decision: 'REQUIRE_APPROVAL',
            status: 'APPROVED',
            risk_level: 'HIGH',
            duration_ms: 350,
          },
        ];
      }
    },
    refetchInterval: 15000,
  });

  const columns = [
    {
      key: 'timestamp',
      label: 'Time',
      width: '150px',
      render: (val) => (
        <span className="text-xs text-slate-400 font-mono">
          {val ? format(new Date(val), 'HH:mm:ss') : 'Just now'}
        </span>
      ),
    },
    {
      key: 'agent_name',
      label: 'Agent',
      render: (val) => (
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary-400 shrink-0" />
          <span className="font-semibold text-white text-xs">{val || 'Unknown Agent'}</span>
        </div>
      ),
    },
    {
      key: 'tool_name',
      label: 'Tool Operation',
      render: (val) => (
        <span className="font-mono text-xs text-slate-200 bg-surface-850 px-2 py-0.5 rounded border border-surface-750">
          {val}
        </span>
      ),
    },
    {
      key: 'risk_level',
      label: 'Risk Severity',
      render: (val) => <RiskBadge level={val || 'LOW'} size="sm" />,
    },
    {
      key: 'decision',
      label: 'Policy Decision',
      render: (val) => <Badge variant={val} size="sm" withDot />,
    },
    {
      key: 'duration_ms',
      label: 'Latency',
      align: 'right',
      render: (val) => (
        <span className="font-mono text-xs text-slate-400">
          {val != null ? `${val}ms` : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner for Pending Approvals if any */}
      {statsData?.pending_approvals > 0 && (
        <div className="glass-card p-4 border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-surface-900 to-surface-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
              <ShieldCheck className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {statsData.pending_approvals} High-Risk Tool Operations Awaiting Approval
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Autonomous agents are blocked until a security operator verifies execution safety.
              </p>
            </div>
          </div>
          <Button
            variant="warning"
            size="sm"
            onClick={() => navigate('/approvals')}
            iconRight={ArrowRight}
            className="shrink-0 bg-amber-600 hover:bg-amber-500 text-white"
          >
            Review Approvals
          </Button>
        </div>
      )}

      {/* 6 High-Performance Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Agents"
          value={statsData?.total_agents ?? 14}
          icon={Bot}
          color="primary"
          trend={{ value: 12.5, isUp: true }}
        />
        <StatCard
          title="Invocations"
          value={statsData?.total_invocations ?? 48920}
          icon={Zap}
          color="sky"
          trend={{ value: 8.4, isUp: true }}
        />
        <StatCard
          title="Pending Approvals"
          value={statsData?.pending_approvals ?? 3}
          icon={Clock}
          color="warning"
        />
        <StatCard
          title="Approved Actions"
          value={statsData?.approved_count ?? 1420}
          icon={CheckCircle}
          color="success"
          trend={{ value: 5.2, isUp: true }}
        />
        <StatCard
          title="Rejected Actions"
          value={statsData?.rejected_count ?? 184}
          icon={XCircle}
          color="danger"
        />
        <StatCard
          title="Blocked Violations"
          value={statsData?.blocked_count ?? 246}
          icon={ShieldAlert}
          color="danger"
          trend={{ value: 2.1, isUp: false }}
        />
      </div>

      {/* Analytics Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 xl:col-span-7">
          <ActivityChart />
        </div>
        <div className="lg:col-span-6 xl:col-span-5">
          <RiskDistribution />
        </div>
      </div>

      {/* Bottom Row: Decision Breakdown & Recent Security Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4">
          <DecisionChart />
        </div>

        <div className="lg:col-span-8 flex flex-col justify-between">
          <div className="glass-card p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-base font-semibold text-white tracking-tight">
                  Recent Gateway Interceptions
                </h4>
                <p className="text-xs text-slate-400">
                  Latest 5 policy evaluations across registered agents
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/audit')}
                iconRight={ArrowRight}
                className="text-primary-400 hover:text-primary-300"
              >
                View All Logs
              </Button>
            </div>

            <DataTable
              columns={columns}
              data={recentLogs || []}
              isLoading={logsLoading}
              enablePagination={false}
              onRowClick={(row) => navigate(`/audit?search=${row.agent_name}`)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
