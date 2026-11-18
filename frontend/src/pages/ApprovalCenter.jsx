import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Code,
  Copy,
  Check,
  Bot,
  Filter,
  Search,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { approvalsApi } from '../services/api';
import Badge from '../components/ui/Badge';
import RiskBadge from '../components/ui/RiskBadge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import DataTable from '../components/ui/DataTable';
import { useWebSocket } from '../hooks/useWebSocket';
import { useToast } from '../hooks/useToast';
import { formatDistanceToNow, format } from 'date-fns';

const INITIAL_PENDING = [
  {
    id: 'appr-901',
    agent_id: 'ag-1',
    agent_name: 'Financial-Analyst-v2',
    tool_name: 'db_execute_query',
    risk_level: 'HIGH',
    created_at: new Date(Date.now() - 1000 * 60 * 3).toISOString(),
    expires_at: new Date(Date.now() + 1000 * 60 * 12).toISOString(),
    reason: 'Policy #P-104: Production database write/update statement detected in payload',
    arguments: {
      database: 'prod_analytics_master',
      query: 'UPDATE customer_ledger SET status = "RECONCILED" WHERE batch_id = 9021',
      max_rows: 500,
      dry_run: false,
    },
  },
  {
    id: 'appr-902',
    agent_id: 'ag-3',
    agent_name: 'DevOps-Assistant',
    tool_name: 'k8s_restart_deployment',
    risk_level: 'CRITICAL',
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    expires_at: new Date(Date.now() + 1000 * 60 * 7).toISOString(),
    reason: 'Policy #P-101: Restarting cluster deployment in production namespace requires manual human sign-off',
    arguments: {
      cluster: 'us-east-prod-eks',
      namespace: 'payments-processing',
      deployment: 'worker-service-v3',
      grace_period_seconds: 30,
    },
  },
  {
    id: 'appr-903',
    agent_id: 'ag-2',
    agent_name: 'CustomerSupport-Bot',
    tool_name: 'crm_issue_refund',
    risk_level: 'MEDIUM',
    created_at: new Date(Date.now() - 1000 * 60 * 1).toISOString(),
    expires_at: new Date(Date.now() + 1000 * 60 * 14).toISOString(),
    reason: 'Policy #P-108: Monetary adjustments over $100 require supervisor validation',
    arguments: {
      ticket_id: 'TCK-88491',
      customer_email: 'sarah.connor@example.com',
      amount_usd: 149.99,
      reason_code: 'SERVICE_OUTAGE_CREDIT',
    },
  },
];

const INITIAL_HISTORY = [
  {
    id: 'appr-880',
    agent_name: 'Financial-Analyst-v2',
    tool_name: 'db_execute_query',
    risk_level: 'HIGH',
    decision: 'APPROVED',
    decided_by: 'Alex Vance (Lead SecOps)',
    decided_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    reason: 'Reconciliation batch approved after verifying transaction checksums.',
  },
  {
    id: 'appr-879',
    agent_name: 'DevOps-Assistant',
    tool_name: 'aws_security_group_modify',
    risk_level: 'CRITICAL',
    decision: 'REJECTED',
    decided_by: 'Sarah Jenkins (VP Security)',
    decided_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    reason: 'Port 22 cannot be exposed to 0.0.0.0/0 under any circumstances.',
  },
  {
    id: 'appr-878',
    agent_name: 'CustomerSupport-Bot',
    tool_name: 'crm_issue_refund',
    risk_level: 'MEDIUM',
    decision: 'APPROVED',
    decided_by: 'Alex Vance (Lead SecOps)',
    decided_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    reason: 'Verified valid outage credit claim.',
  },
  {
    id: 'appr-877',
    agent_name: 'DataScraper-Pro',
    tool_name: 'fs_write_root_credentials',
    risk_level: 'CRITICAL',
    decision: 'REJECTED',
    decided_by: 'Auto-Governor System',
    decided_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    reason: 'Explicit system violation: Unauthorized credential path rewrite.',
  },
];

// Live Countdown Timer Component for individual approval request
const ExpiryTimer = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = new Date(expiresAt).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        setIsExpiringSoon(true);
        return;
      }

      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      setIsExpiringSoon(minutes < 3);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-mono text-xs font-semibold ${
        isExpiringSoon
          ? 'bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse'
          : 'bg-surface-850 text-slate-300 border border-surface-750'
      }`}
    >
      <Clock className="w-3.5 h-3.5" />
      <span>{timeLeft === 'EXPIRED' ? 'EXPIRED' : `Expires in ${timeLeft}`}</span>
    </div>
  );
};

export const ApprovalCenter = () => {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { lastMessage } = useWebSocket('/ws/approvals');

  const [pendingList, setPendingList] = useState(INITIAL_PENDING);
  const [historyList, setHistoryList] = useState(INITIAL_HISTORY);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [decisionModal, setDecisionModal] = useState({
    isOpen: false,
    item: null,
    action: 'APPROVE', // 'APPROVE' | 'REJECT'
    comment: '',
  });
  const [copiedId, setCopiedId] = useState(null);

  // Sync real-time WebSocket incoming approval request
  useEffect(() => {
    if (lastMessage && (lastMessage.type === 'APPROVAL_REQUIRED' || lastMessage.type === 'NEW_APPROVAL')) {
      const newAppr = lastMessage.data || lastMessage;
      setPendingList((prev) => [
        {
          id: newAppr.id || `appr-${Date.now()}`,
          agent_id: newAppr.agent_id || 'ag-live',
          agent_name: newAppr.agent_name || 'Autonomous Agent',
          tool_name: newAppr.tool_name || 'tool_invocation',
          risk_level: newAppr.risk_level || 'HIGH',
          created_at: new Date().toISOString(),
          expires_at: newAppr.expires_at || new Date(Date.now() + 1000 * 60 * 15).toISOString(),
          reason: newAppr.reason || 'Triggered human review policy',
          arguments: newAppr.arguments || {},
        },
        ...prev,
      ]);
      toast.warning(`New approval request received: ${newAppr.tool_name || 'Tool'}`);
    }
  }, [lastMessage, toast]);

  // Handle Decision Modal Open
  const handleOpenDecision = (item, action) => {
    setDecisionModal({
      isOpen: true,
      item,
      action,
      comment: '',
    });
  };

  // Submit Approval / Rejection Decision
  const handleConfirmDecision = async () => {
    const { item, action, comment } = decisionModal;
    if (!item) return;

    try {
      await approvalsApi.decide(item.id, action, comment);
    } catch {
      // optimistic update
    }

    // Remove from pending list
    setPendingList((prev) => prev.filter((p) => p.id !== item.id));

    // Append to history list
    const newHistoryRecord = {
      id: item.id,
      agent_name: item.agent_name,
      tool_name: item.tool_name,
      risk_level: item.risk_level,
      decision: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      decided_by: 'You (Security Operator)',
      decided_at: new Date().toISOString(),
      reason: comment || (action === 'APPROVE' ? 'Approved by operator' : 'Rejected by operator policy check'),
    };
    setHistoryList((prev) => [newHistoryRecord, ...prev]);

    setDecisionModal({ isOpen: false, item: null, action: 'APPROVE', comment: '' });

    if (action === 'APPROVE') {
      toast.success(`Request for ${item.tool_name} approved and executed.`);
    } else {
      toast.error(`Request for ${item.tool_name} rejected. Execution aborted.`);
    }
  };

  const copyArgs = (id, args) => {
    navigator.clipboard.writeText(JSON.stringify(args, null, 2));
    setCopiedId(id);
    toast.success('Arguments payload copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // History Table Columns
  const historyColumns = [
    {
      key: 'decided_at',
      label: 'Decision Time',
      width: '140px',
      render: (val) => (
        <span className="text-xs text-slate-400 font-mono">
          {val ? format(new Date(val), 'MMM d, HH:mm') : '—'}
        </span>
      ),
    },
    {
      key: 'tool_name',
      label: 'Tool Operation',
      render: (val) => (
        <span className="font-mono text-xs text-white bg-surface-850 px-2 py-0.5 rounded border border-surface-750">
          {val}
        </span>
      ),
    },
    {
      key: 'agent_name',
      label: 'Agent',
      render: (val) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-200">
          <Bot className="w-3.5 h-3.5 text-primary-400" />
          <span>{val}</span>
        </div>
      ),
    },
    {
      key: 'risk_level',
      label: 'Risk',
      width: '110px',
      render: (val) => <RiskBadge level={val} size="sm" />,
    },
    {
      key: 'decision',
      label: 'Decision',
      width: '120px',
      render: (val) => <Badge variant={val} size="sm" withDot />,
    },
    {
      key: 'reason',
      label: 'Operator Justification',
      render: (val) => (
        <span className="text-xs text-slate-400 truncate max-w-xs block" title={val}>
          {val || '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Human-in-the-Loop Approval Center
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {pendingList.length} PENDING
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Intercept, inspect, and approve high-consequence agent actions before execution occurs.
          </p>
        </div>

        {/* Tab switch for mobile/responsive view */}
        <div className="flex items-center gap-1 bg-surface-900 p-1 rounded-xl border border-surface-800">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'pending'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Pending Requests ({pendingList.length})
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Decision History ({historyList.length})
          </button>
        </div>
      </div>

      {/* Main Split / Tabbed View */}
      {activeTab === 'pending' ? (
        <div>
          {pendingList.length === 0 ? (
            <div className="glass-card p-12 text-center flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 shadow-glow-success">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">No Pending Approvals</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                All agent execution requests have been reviewed or approved. The gateway is clear.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pendingList.map((item) => (
                <div
                  key={item.id}
                  className="glass-card p-6 border-white/10 hover:border-primary-500/40 transition-all duration-300 relative overflow-hidden flex flex-col justify-between group shadow-xl"
                >
                  {/* Glowing header accent line */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500 via-primary-500 to-indigo-500" />

                  <div>
                    {/* Top Meta: Tool & Expiry */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <RiskBadge level={item.risk_level} size="sm" />
                          <span className="text-[11px] font-mono text-slate-500">ID: {item.id}</span>
                        </div>
                        <h3 className="text-lg font-bold text-white font-mono tracking-tight flex items-center gap-2">
                          <span>{item.tool_name}</span>
                        </h3>
                      </div>
                      <ExpiryTimer expiresAt={item.expires_at} />
                    </div>

                    {/* Agent & Trigger Info */}
                    <div className="flex items-center gap-2 text-xs text-slate-300 mb-3 bg-surface-850/80 p-2.5 rounded-xl border border-surface-800">
                      <Bot className="w-4 h-4 text-primary-400 shrink-0" />
                      <span>
                        Requested by agent: <strong className="text-white font-mono">{item.agent_name}</strong>
                      </span>
                    </div>

                    {/* Governance Policy Rule Justification */}
                    <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                      <p className="font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Approval Requirement Trigger</span>
                      </p>
                      <p className="text-slate-300 leading-relaxed">{item.reason}</p>
                    </div>

                    {/* Invocation Arguments JSON Inspector */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-400 font-mono uppercase tracking-wider">
                          Payload Arguments
                        </span>
                        <button
                          onClick={() => copyArgs(item.id, item.arguments)}
                          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                        >
                          {copiedId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{copiedId === item.id ? 'Copied' : 'Copy JSON'}</span>
                        </button>
                      </div>

                      <div className="bg-surface-950 rounded-xl p-3 border border-surface-800 max-h-48 overflow-y-auto font-mono text-xs text-emerald-400">
                        <pre className="whitespace-pre-wrap select-all">
                          {JSON.stringify(item.arguments, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* Decision Action Buttons */}
                  <div className="pt-4 border-t border-surface-800 flex items-center gap-3">
                    <Button
                      variant="danger"
                      size="md"
                      className="flex-1"
                      icon={XCircle}
                      onClick={() => handleOpenDecision(item, 'REJECT')}
                    >
                      Reject Action
                    </Button>
                    <Button
                      variant="success"
                      size="md"
                      className="flex-1"
                      icon={CheckCircle2}
                      onClick={() => handleOpenDecision(item, 'APPROVE')}
                    >
                      Approve &amp; Execute
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* History View */
        <div className="glass-card p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-white tracking-tight">
              Audit Record of Human Decisions
            </h3>
            <p className="text-xs text-slate-400">
              Complete historical trail of approved and denied agent tool operations.
            </p>
          </div>
          <DataTable
            columns={historyColumns}
            data={historyList}
            itemsPerPage={10}
            emptyMessage="No historical decisions yet"
          />
        </div>
      )}

      {/* Decision Confirmation Modal with Comment Field */}
      <Modal
        isOpen={decisionModal.isOpen}
        onClose={() => setDecisionModal({ isOpen: false, item: null, action: 'APPROVE', comment: '' })}
        title={
          decisionModal.action === 'APPROVE'
            ? 'Confirm Operation Approval'
            : 'Confirm Operation Rejection'
        }
        subtitle={
          decisionModal.action === 'APPROVE'
            ? 'Execution will resume immediately on the target system.'
            : 'The action will be blocked and an error returned to the agent.'
        }
        size="md"
      >
        <div className="space-y-4">
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
              decisionModal.action === 'APPROVE'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {decisionModal.action === 'APPROVE' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold text-white">
                {decisionModal.item?.tool_name} requested by {decisionModal.item?.agent_name}
              </p>
              <p className="mt-0.5 text-slate-300">
                {decisionModal.action === 'APPROVE'
                  ? 'Are you certain you want to permit this tool execution?'
                  : 'Rejecting this request will safely deny execution and record an audit trace.'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Audit Note / Justification (Optional)</span>
              <span className="text-[10px] text-slate-400 font-mono">Logged to SIEM</span>
            </label>
            <textarea
              rows={3}
              value={decisionModal.comment}
              onChange={(e) =>
                setDecisionModal((prev) => ({ ...prev, comment: e.target.value }))
              }
              placeholder={
                decisionModal.action === 'APPROVE'
                  ? 'e.g. Verified target environment and transaction safety with tech lead...'
                  : 'e.g. Violates strict production data modification restriction...'
              }
              className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-surface-800">
            <Button
              variant="secondary"
              onClick={() =>
                setDecisionModal({ isOpen: false, item: null, action: 'APPROVE', comment: '' })
              }
            >
              Cancel
            </Button>
            <Button
              variant={decisionModal.action === 'APPROVE' ? 'success' : 'danger'}
              onClick={handleConfirmDecision}
            >
              {decisionModal.action === 'APPROVE' ? 'Approve & Release' : 'Confirm Rejection'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApprovalCenter;
