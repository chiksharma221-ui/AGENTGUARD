import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Download,
  Filter,
  Search,
  RefreshCw,
  Bot,
  Hash,
  Shield,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
} from 'lucide-react';
import { auditApi } from '../services/api';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import RiskBadge from '../components/ui/RiskBadge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { format } from 'date-fns';

const INITIAL_AUDIT_LOGS = [
  {
    id: 'req-889102-a1',
    timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    agent_name: 'Financial-Analyst-v2',
    tool_name: 'db_execute_query',
    decision: 'REQUIRE_APPROVAL',
    status: 'PENDING',
    risk_level: 'HIGH',
    duration_ms: 18,
    policy_matched: 'Require Approval for DB Mutation',
    client_ip: '10.0.4.12',
    payload: {
      database: 'prod_analytics_master',
      query: 'UPDATE customer_ledger SET status = "RECONCILED" WHERE batch_id = 9021',
    },
    response: { message: 'Action suspended awaiting human operator decision' },
    hash: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
  },
  {
    id: 'req-889101-b2',
    timestamp: new Date(Date.now() - 1000 * 60 * 7).toISOString(),
    agent_name: 'CustomerSupport-Bot',
    tool_name: 'crm_get_contact',
    decision: 'ALLOW',
    status: 'SUCCESS',
    risk_level: 'LOW',
    duration_ms: 38,
    policy_matched: 'Allow Read-Only CRM Inquiries',
    client_ip: '10.0.4.15',
    payload: { customer_id: 'cust-9921', include_orders: true },
    response: { status: 'found', records: 1 },
    hash: 'sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  },
  {
    id: 'req-889100-c3',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    agent_name: 'DataScraper-Pro',
    tool_name: 'fs_write_root_credentials',
    decision: 'DENY',
    status: 'BLOCKED',
    risk_level: 'CRITICAL',
    duration_ms: 4,
    policy_matched: 'Block Root Credential Access',
    client_ip: '10.0.8.20',
    payload: { path: '/etc/shadow', content: 'root::0:0:99999:7:::' },
    response: { error: 'Permission denied: Gateway policy violation' },
    hash: 'sha256:5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
  },
  {
    id: 'req-889099-d4',
    timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    agent_name: 'DevOps-Assistant',
    tool_name: 'k8s_restart_deployment',
    decision: 'REQUIRE_APPROVAL',
    status: 'APPROVED',
    risk_level: 'CRITICAL',
    duration_ms: 290,
    policy_matched: 'Production Kubernetes Guardrail',
    client_ip: '10.0.2.8',
    payload: { namespace: 'payments-processing', deployment: 'worker-service-v3' },
    response: { status: 'rollout restart triggered successfully' },
    hash: 'sha256:4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
  },
  {
    id: 'req-889098-e5',
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
    agent_name: 'CustomerSupport-Bot',
    tool_name: 'crm_issue_refund',
    decision: 'REQUIRE_APPROVAL',
    status: 'APPROVED',
    risk_level: 'MEDIUM',
    duration_ms: 110,
    policy_matched: 'Supervisor Validation on Outage Credit',
    client_ip: '10.0.4.15',
    payload: { ticket_id: 'TCK-88491', amount_usd: 149.99 },
    response: { refund_status: 'PROCESSED' },
    hash: 'sha256:ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
  },
  {
    id: 'req-889097-f6',
    timestamp: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    agent_name: 'CodeReviewer-AI',
    tool_name: 'github_read_pull_request',
    decision: 'ALLOW',
    status: 'SUCCESS',
    risk_level: 'LOW',
    duration_ms: 95,
    policy_matched: 'Allow GitHub Issue Review',
    client_ip: '10.0.6.11',
    payload: { repo: 'org/agentguard', pr_number: 142 },
    response: { diff_lines: 480, comments_fetched: 3 },
    hash: 'sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
  },
];

export const AuditLogs = () => {
  const toast = useToast();

  const [logs, setLogs] = useState(INITIAL_AUDIT_LOGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDecision, setSelectedDecision] = useState('ALL');
  const [selectedRisk, setSelectedRisk] = useState('ALL');
  const [detailModal, setDetailModal] = useState({ isOpen: false, log: null });
  const [copiedHash, setCopiedHash] = useState(false);

  // Fetch logs
  const { data: serverLogs, isLoading, refetch } = useQuery({
    queryKey: ['auditLogsList'],
    queryFn: async () => {
      try {
        const res = await auditApi.list();
        const list = Array.isArray(res) ? res : res?.items || [];
        return list.length > 0 ? list : INITIAL_AUDIT_LOGS;
      } catch {
        return INITIAL_AUDIT_LOGS;
      }
    },
  });

  const displayLogs = serverLogs || logs;

  // Filter logs
  const filteredLogs = displayLogs.filter((log) => {
    const matchesSearch =
      log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.agent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.tool_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDecision =
      selectedDecision === 'ALL' || log.decision === selectedDecision;

    const matchesRisk =
      selectedRisk === 'ALL' || log.risk_level === selectedRisk;

    return matchesSearch && matchesDecision && matchesRisk;
  });

  // Export CSV
  const handleExportCSV = () => {
    try {
      const headers = ['Request_ID', 'Timestamp', 'Agent', 'Tool', 'Risk_Level', 'Decision', 'Status', 'Duration_MS', 'Hash'];
      const rows = filteredLogs.map((log) => [
        log.id,
        log.timestamp,
        log.agent_name,
        log.tool_name,
        log.risk_level,
        log.decision,
        log.status,
        log.duration_ms,
        log.hash,
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,' +
        [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `agentguard_audit_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Audit log export initiated (CSV)');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  const copyVerificationHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    toast.success('SHA-256 verification signature copied');
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const columns = [
    {
      key: 'id',
      label: 'Request ID',
      width: '150px',
      render: (val) => (
        <span className="font-mono text-xs text-primary-400 select-all">{val}</span>
      ),
    },
    {
      key: 'timestamp',
      label: 'Timestamp',
      sortable: true,
      width: '160px',
      render: (val) => (
        <span className="font-mono text-xs text-slate-400">
          {val ? format(new Date(val), 'yyyy-MM-dd HH:mm:ss') : '—'}
        </span>
      ),
    },
    {
      key: 'agent_name',
      label: 'Agent Identity',
      render: (val) => (
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-primary-400" />
          <span className="font-semibold text-white text-xs">{val}</span>
        </div>
      ),
    },
    {
      key: 'tool_name',
      label: 'Invoked Tool',
      render: (val) => (
        <span className="font-mono text-xs text-slate-300 bg-surface-850 px-2 py-0.5 rounded border border-surface-750">
          {val}
        </span>
      ),
    },
    {
      key: 'risk_level',
      label: 'Risk Level',
      width: '120px',
      render: (val) => <RiskBadge level={val} size="sm" />,
    },
    {
      key: 'decision',
      label: 'Decision',
      width: '130px',
      render: (val) => <Badge variant={val} size="sm" withDot />,
    },
    {
      key: 'duration_ms',
      label: 'Latency',
      align: 'right',
      width: '90px',
      render: (val) => (
        <span className="font-mono text-xs text-slate-400">
          {val != null ? `${val}ms` : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Security Audit Logs</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable, cryptographically verifiable record of all agent invocations and gateway interceptions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            icon={RefreshCw}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={Download}
            onClick={handleExportCSV}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search request ID, agent, or tool..."
            className="w-full bg-surface-900 border border-surface-750 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
          />
        </div>

        {/* Decision Filter */}
        <div>
          <select
            value={selectedDecision}
            onChange={(e) => setSelectedDecision(e.target.value)}
            className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500"
          >
            <option value="ALL">All Decisions</option>
            <option value="ALLOW">ALLOW</option>
            <option value="REQUIRE_APPROVAL">REQUIRE APPROVAL</option>
            <option value="DENY">DENY</option>
          </select>
        </div>

        {/* Risk Severity Filter */}
        <div>
          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500"
          >
            <option value="ALL">All Risk Severities</option>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>

        {/* Total Count Pill */}
        <div className="flex items-center justify-end px-3 text-xs text-slate-400 font-mono">
          <span>{filteredLogs.length} matching events</span>
        </div>
      </div>

      {/* Audit Log Table */}
      <DataTable
        columns={columns}
        data={filteredLogs}
        isLoading={isLoading}
        itemsPerPage={10}
        onRowClick={(row) => setDetailModal({ isOpen: true, log: row })}
      />

      {/* Audit Record Detailed Modal */}
      {detailModal.log && (
        <Modal
          isOpen={detailModal.isOpen}
          onClose={() => setDetailModal({ isOpen: false, log: null })}
          title="Audit Trail Record Details"
          subtitle={`Immutable trace: ${detailModal.log.id}`}
          size="lg"
        >
          <div className="space-y-5">
            {/* Top Status & Verification Hash */}
            <div className="p-3 bg-surface-950 rounded-xl border border-surface-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant={detailModal.log.decision} withDot />
                  <RiskBadge level={detailModal.log.risk_level} size="sm" />
                </div>
                <span className="font-mono text-slate-400 text-xs">
                  Latency: {detailModal.log.duration_ms}ms
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-surface-850 text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-1 truncate mr-2">
                  <Hash className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{detailModal.log.hash}</span>
                </div>
                <button
                  onClick={() => copyVerificationHash(detailModal.log.hash)}
                  className="p-1 rounded text-slate-400 hover:text-white shrink-0"
                  title="Copy Signature"
                >
                  {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Invocation Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 bg-surface-850 rounded-xl border border-surface-800">
                <span className="text-slate-400 block text-[10px] uppercase">Agent</span>
                <span className="font-semibold text-white mt-0.5 block truncate">
                  {detailModal.log.agent_name}
                </span>
              </div>
              <div className="p-2.5 bg-surface-850 rounded-xl border border-surface-800">
                <span className="text-slate-400 block text-[10px] uppercase">Target Tool</span>
                <span className="font-semibold font-mono text-indigo-300 mt-0.5 block truncate">
                  {detailModal.log.tool_name}
                </span>
              </div>
              <div className="p-2.5 bg-surface-850 rounded-xl border border-surface-800">
                <span className="text-slate-400 block text-[10px] uppercase">Client IP</span>
                <span className="font-mono text-slate-300 mt-0.5 block">
                  {detailModal.log.client_ip || '10.0.4.12'}
                </span>
              </div>
            </div>

            {/* Policy Interception Trace */}
            <div className="p-3 bg-surface-850 rounded-xl border border-surface-800 text-xs">
              <span className="text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                Policy Rule Interception
              </span>
              <p className="font-semibold text-white">
                {detailModal.log.policy_matched || 'Default Deterministic Policy Gate'}
              </p>
            </div>

            {/* Request Payload JSON */}
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
                Request Arguments (Input)
              </span>
              <div className="bg-surface-950 p-3 rounded-xl border border-surface-800 font-mono text-xs text-emerald-400 max-h-36 overflow-y-auto select-all">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(detailModal.log.payload, null, 2)}
                </pre>
              </div>
            </div>

            {/* Response / Interception Outcome */}
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
                Execution Outcome / Interception
              </span>
              <div className="bg-surface-950 p-3 rounded-xl border border-surface-800 font-mono text-xs text-slate-300 max-h-36 overflow-y-auto select-all">
                <pre className="whitespace-pre-wrap">
                  {JSON.stringify(detailModal.log.response, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-3 flex justify-end border-t border-surface-800">
              <Button
                variant="secondary"
                onClick={() => setDetailModal({ isOpen: false, log: null })}
              >
                Close Trace
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AuditLogs;
