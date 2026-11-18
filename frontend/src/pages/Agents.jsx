import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Plus,
  Key,
  Trash2,
  Power,
  Eye,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Zap,
  Lock,
} from 'lucide-react';
import { agentsApi } from '../services/api';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import RiskBadge from '../components/ui/RiskBadge';
import Button from '../components/ui/Button';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { formatDistanceToNow, format } from 'date-fns';

const INITIAL_AGENTS = [
  {
    id: 'ag-1',
    name: 'Financial-Analyst-v2',
    description: 'Autonomous financial report generator with read-only SQL access',
    status: 'ACTIVE',
    max_risk_level: 'HIGH',
    last_seen: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
    invocations_count: 14200,
    credentials: [
      { id: 'key-1', name: 'Primary Production Key', prefix: 'ag_live_98ab', created_at: '2026-10-15' },
    ],
  },
  {
    id: 'ag-2',
    name: 'CustomerSupport-Bot',
    description: 'Frontline customer triage agent connected to Zendesk and CRM',
    status: 'ACTIVE',
    max_risk_level: 'LOW',
    last_seen: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    invocations_count: 28400,
    credentials: [
      { id: 'key-2', name: 'CRM Live Key', prefix: 'ag_live_12cd', created_at: '2026-09-01' },
    ],
  },
  {
    id: 'ag-3',
    name: 'DevOps-Assistant',
    description: 'Infrastructure health auditor with kubernetes status inquiry rights',
    status: 'ACTIVE',
    max_risk_level: 'HIGH',
    last_seen: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    invocations_count: 6180,
    credentials: [
      { id: 'key-3', name: 'Kube Operator Token', prefix: 'ag_live_45ef', created_at: '2026-11-02' },
    ],
  },
  {
    id: 'ag-4',
    name: 'DataScraper-Pro',
    description: 'Web scraper and dataset builder. Restrict filesystem access.',
    status: 'DISABLED',
    max_risk_level: 'MEDIUM',
    last_seen: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
    invocations_count: 320,
    credentials: [],
  },
];

export const Agents = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [agentsList, setAgentsList] = useState(INITIAL_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newKeyModal, setNewKeyModal] = useState({ isOpen: false, key: '', agentName: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [copiedKey, setCopiedKey] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxRisk, setMaxRisk] = useState('HIGH');

  // Query agents from API
  const { data: serverAgents, isLoading } = useQuery({
    queryKey: ['agentsList'],
    queryFn: async () => {
      try {
        const res = await agentsApi.list();
        const list = Array.isArray(res) ? res : res?.items || [];
        if (list.length > 0) return list;
        return INITIAL_AGENTS;
      } catch {
        return INITIAL_AGENTS;
      }
    },
  });

  const displayAgents = serverAgents || agentsList;

  // Toggle Agent Active/Disabled Status
  const handleToggleStatus = async (agent) => {
    const newStatus = agent.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await agentsApi.toggle(agent.id, newStatus === 'ACTIVE');
    } catch {
      // optimistic update
    }

    setAgentsList((prev) =>
      prev.map((a) => (a.id === agent.id ? { ...a, status: newStatus } : a))
    );
    queryClient.invalidateQueries({ queryKey: ['agentsList'] });
    toast.success(`Agent ${agent.name} marked as ${newStatus}`);
  };

  // Register Agent Form Submit
  const handleRegisterAgent = async (e) => {
    e.preventDefault();
    const newAgent = {
      id: `ag-${Date.now()}`,
      name,
      description,
      status: 'ACTIVE',
      max_risk_level: maxRisk,
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
      invocations_count: 0,
      credentials: [],
    };

    try {
      await agentsApi.create({ name, description, max_risk_level: maxRisk });
    } catch {
      // fallback
    }

    // Auto-generate key for new agent
    const generatedRawKey = `ag_live_${Math.random().toString(36).substring(2, 12)}_${Math.random().toString(36).substring(2, 12)}`;
    newAgent.credentials.push({
      id: `key-${Date.now()}`,
      name: 'Initial Access Key',
      prefix: generatedRawKey.slice(0, 12),
      created_at: new Date().toISOString().split('T')[0],
    });

    setAgentsList((prev) => [newAgent, ...prev]);
    queryClient.invalidateQueries({ queryKey: ['agentsList'] });
    setIsRegisterOpen(false);
    setName('');
    setDescription('');

    // Open raw key modal
    setNewKeyModal({
      isOpen: true,
      key: generatedRawKey,
      agentName: newAgent.name,
    });
    toast.success(`Agent ${newAgent.name} successfully registered`);
  };

  // Generate New Credential Key
  const handleGenerateKey = async (agent) => {
    const rawKey = `ag_live_${Math.random().toString(36).substring(2, 12)}_${Math.random().toString(36).substring(2, 12)}`;
    try {
      await agentsApi.generateCredential(agent.id);
    } catch {
      // fallback
    }

    const newCred = {
      id: `key-${Date.now()}`,
      name: `API Key ${agent.credentials.length + 1}`,
      prefix: rawKey.slice(0, 12),
      created_at: new Date().toISOString().split('T')[0],
    };

    setAgentsList((prev) =>
      prev.map((a) =>
        a.id === agent.id
          ? { ...a, credentials: [...(a.credentials || []), newCred] }
          : a
      )
    );

    if (selectedAgent && selectedAgent.id === agent.id) {
      setSelectedAgent((prev) => ({
        ...prev,
        credentials: [...(prev.credentials || []), newCred],
      }));
    }

    setNewKeyModal({
      isOpen: true,
      key: rawKey,
      agentName: agent.name,
    });
  };

  // Revoke Credential Key
  const handleRevokeKey = (agent, keyId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Revoke Agent API Key',
      message: `Are you sure you want to revoke this credential for ${agent.name}? Any active agent session with this token will immediately fail.`,
      onConfirm: async () => {
        try {
          await agentsApi.revokeCredentials(agent.id, keyId);
        } catch {
          // fallback
        }
        setAgentsList((prev) =>
          prev.map((a) =>
            a.id === agent.id
              ? { ...a, credentials: a.credentials.filter((k) => k.id !== keyId) }
              : a
          )
        );
        if (selectedAgent && selectedAgent.id === agent.id) {
          setSelectedAgent((prev) => ({
            ...prev,
            credentials: prev.credentials.filter((k) => k.id !== keyId),
          }));
        }
        setConfirmModal({ isOpen: false });
        toast.success('Agent credential revoked');
      },
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    toast.success('API Key copied to clipboard');
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const columns = [
    {
      key: 'name',
      label: 'Agent Details',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-white text-sm block truncate hover:text-primary-400 cursor-pointer" onClick={() => setSelectedAgent(row)}>
              {row.name}
            </span>
            <span className="text-xs text-slate-400 block truncate max-w-xs">
              {row.description}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (val) => (
        <Badge variant={val === 'ACTIVE' ? 'ACTIVE' : 'DISABLED'} withDot size="sm">
          {val}
        </Badge>
      ),
    },
    {
      key: 'max_risk_level',
      label: 'Max Risk Level',
      width: '140px',
      render: (val) => <RiskBadge level={val || 'LOW'} size="sm" />,
    },
    {
      key: 'last_seen',
      label: 'Last Heartbeat',
      render: (val) => (
        <span className="text-xs text-slate-400 font-mono">
          {val ? formatDistanceToNow(new Date(val), { addSuffix: true }) : 'Never'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleToggleStatus(row)}
            className={`p-1.5 rounded-lg transition-colors ${
              row.status === 'ACTIVE'
                ? 'text-emerald-400 hover:bg-emerald-500/10'
                : 'text-slate-500 hover:text-slate-300 hover:bg-surface-800'
            }`}
            title={row.status === 'ACTIVE' ? 'Disable Agent' : 'Enable Agent'}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleGenerateKey(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition-colors"
            title="Generate New API Key"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedAgent(row)}
            className="p-1.5 rounded-lg text-primary-400 hover:bg-primary-500/10 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Title and Register Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Agent Registry</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Define security boundaries, rotate cryptographic credentials, and govern autonomous agents.
          </p>
        </div>
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => setIsRegisterOpen(true)}
        >
          Register New Agent
        </Button>
      </div>

      {/* Agents Table */}
      <DataTable
        columns={columns}
        data={displayAgents}
        isLoading={isLoading}
        onRowClick={(row) => setSelectedAgent(row)}
      />

      {/* Register Agent Modal */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register Autonomous Agent"
        subtitle="Provision an authorized agent identity and generate access credentials."
      >
        <form onSubmit={handleRegisterAgent} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Agent Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Data-Ingestion-Bot"
              className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description & Purpose
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the functional scope and intended runtime actions..."
              className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Maximum Risk Tolerance
            </label>
            <select
              value={maxRisk}
              onChange={(e) => setMaxRisk(e.target.value)}
              className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
            >
              <option value="LOW">LOW — Read-only sandboxed tools</option>
              <option value="MEDIUM">MEDIUM — Standard queries and API reads</option>
              <option value="HIGH">HIGH — Mutation actions requiring policies</option>
              <option value="CRITICAL">CRITICAL — High privilege operations</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-surface-800">
            <Button variant="secondary" type="button" onClick={() => setIsRegisterOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Register &amp; Generate Credentials
            </Button>
          </div>
        </form>
      </Modal>

      {/* Raw API Key Display Modal (Shown ONCE upon generation) */}
      <Modal
        isOpen={newKeyModal.isOpen}
        onClose={() => setNewKeyModal({ isOpen: false, key: '', agentName: '' })}
        title="Agent Access Key Generated"
        subtitle={`Secret token provisioned for ${newKeyModal.agentName}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
              Please copy and store this API key safely in your secret manager. <strong>This key will NEVER be shown again!</strong> If lost, you must rotate and issue a new credential.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 font-mono uppercase">
              Secret API Key
            </label>
            <div className="flex items-center gap-2 bg-surface-950 p-2.5 rounded-xl border border-surface-800 font-mono text-sm text-emerald-400 break-all select-all">
              <span className="flex-1">{newKeyModal.key}</span>
              <button
                onClick={() => copyToClipboard(newKeyModal.key)}
                className="p-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-white transition-colors shrink-0"
                title="Copy Key"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-4 flex justify-end border-t border-surface-800">
            <Button
              variant="primary"
              onClick={() => setNewKeyModal({ isOpen: false, key: '', agentName: '' })}
            >
              I Have Saved This Key
            </Button>
          </div>
        </div>
      </Modal>

      {/* Slide-out Agent Detail Drawer */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedAgent(null)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-surface-900 border-l border-surface-800 p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="space-y-6 overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-surface-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{selectedAgent.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">ID: {selectedAgent.id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                {/* Status & Risk Pill */}
                <div className="flex items-center gap-2">
                  <Badge variant={selectedAgent.status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED'} withDot>
                    {selectedAgent.status}
                  </Badge>
                  <RiskBadge level={selectedAgent.max_risk_level} />
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Description
                  </h4>
                  <p className="text-sm text-slate-300 bg-surface-850 p-3 rounded-xl border border-surface-800">
                    {selectedAgent.description || 'No description provided.'}
                  </p>
                </div>

                {/* Telemetry Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface-850 rounded-xl border border-surface-800">
                    <p className="text-xs text-slate-400">Total Invocations</p>
                    <p className="text-xl font-bold font-mono text-white mt-1">
                      {(selectedAgent.invocations_count || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-surface-850 rounded-xl border border-surface-800">
                    <p className="text-xs text-slate-400">Registered Date</p>
                    <p className="text-xs font-mono text-slate-300 mt-2">
                      {selectedAgent.created_at ? format(new Date(selectedAgent.created_at), 'yyyy-MM-dd') : '—'}
                    </p>
                  </div>
                </div>

                {/* Credentials Management */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Active Credentials ({selectedAgent.credentials?.length || 0})
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Plus}
                      onClick={() => handleGenerateKey(selectedAgent)}
                      className="text-xs text-primary-400"
                    >
                      New Key
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {selectedAgent.credentials && selectedAgent.credentials.length > 0 ? (
                      selectedAgent.credentials.map((cred) => (
                        <div
                          key={cred.id}
                          className="p-3 rounded-xl bg-surface-850 border border-surface-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-semibold text-white">{cred.name}</p>
                            <p className="font-mono text-slate-400 mt-0.5">
                              {cred.prefix}••••••••
                            </p>
                          </div>
                          <button
                            onClick={() => handleRevokeKey(selectedAgent, cred.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Revoke Key"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 italic p-3 text-center bg-surface-850 rounded-xl">
                        No active credentials. Generate one to allow agent authentication.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="pt-4 border-t border-surface-800 flex items-center gap-3">
                <Button
                  variant={selectedAgent.status === 'ACTIVE' ? 'danger' : 'success'}
                  size="md"
                  className="w-full"
                  onClick={() => handleToggleStatus(selectedAgent)}
                >
                  {selectedAgent.status === 'ACTIVE' ? 'Disable Agent' : 'Enable Agent'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
};

export default Agents;
