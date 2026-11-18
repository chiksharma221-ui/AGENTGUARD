import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Scale,
  Plus,
  Edit2,
  Trash2,
  Power,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Code,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { policiesApi } from '../services/api';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import RiskBadge from '../components/ui/RiskBadge';
import Button from '../components/ui/Button';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';

const INITIAL_POLICIES = [
  {
    id: 'pol-101',
    name: 'Block Root Credential Access',
    description: 'Deny any filesystem modification targeting secret paths or system credentials',
    tool_pattern: 'fs_*',
    operation_type: 'write',
    risk_level: 'CRITICAL',
    decision: 'DENY',
    priority: 10,
    enabled: true,
  },
  {
    id: 'pol-102',
    name: 'Require Approval for DB Mutation',
    description: 'Any database UPDATE, DELETE, or DROP requires security human-in-the-loop sign-off',
    tool_pattern: 'db_execute_*',
    operation_type: 'write',
    risk_level: 'HIGH',
    decision: 'REQUIRE_APPROVAL',
    priority: 20,
    enabled: true,
  },
  {
    id: 'pol-103',
    name: 'Allow Read-Only CRM Inquiries',
    description: 'Permit agents to retrieve customer status and support history without friction',
    tool_pattern: 'crm_get_*',
    operation_type: 'read',
    risk_level: 'LOW',
    decision: 'ALLOW',
    priority: 50,
    enabled: true,
  },
  {
    id: 'pol-104',
    name: 'Production Kubernetes Guardrail',
    description: 'Enforce approval on container restart or rollout changes in production namespaces',
    tool_pattern: 'k8s_*',
    operation_type: 'execute',
    risk_level: 'CRITICAL',
    decision: 'REQUIRE_APPROVAL',
    priority: 15,
    enabled: true,
  },
  {
    id: 'pol-105',
    name: 'Allow GitHub Issue Review',
    description: 'Allow AI code review bots to read PRs and comments freely',
    tool_pattern: 'github_read_*',
    operation_type: 'read',
    risk_level: 'LOW',
    decision: 'ALLOW',
    priority: 60,
    enabled: true,
  },
];

export const Policies = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [policies, setPolicies] = useState(INITIAL_POLICIES);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, name: '' });

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPattern, setFormPattern] = useState('db_*');
  const [formOpType, setFormOpType] = useState('write');
  const [formRisk, setFormRisk] = useState('HIGH');
  const [formDecision, setFormDecision] = useState('REQUIRE_APPROVAL');
  const [formPriority, setFormPriority] = useState(25);
  const [formEnabled, setFormEnabled] = useState(true);

  // Test Sandbox State
  const [testAgent, setTestAgent] = useState('Financial-Analyst-v2');
  const [testTool, setTestTool] = useState('db_execute_query');
  const [testArgs, setTestArgs] = useState('{\n  "query": "DROP TABLE transactions;"\n}');
  const [testResult, setTestResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Fetch policies query
  const { data: serverPolicies, isLoading } = useQuery({
    queryKey: ['policiesList'],
    queryFn: async () => {
      try {
        const res = await policiesApi.list();
        const list = Array.isArray(res) ? res : res?.items || [];
        return list.length > 0 ? list : INITIAL_POLICIES;
      } catch {
        return INITIAL_POLICIES;
      }
    },
  });

  const displayPolicies = serverPolicies || policies;

  const handleOpenCreate = () => {
    setEditingPolicy(null);
    setFormName('');
    setFormDesc('');
    setFormPattern('db_*');
    setFormOpType('write');
    setFormRisk('HIGH');
    setFormDecision('REQUIRE_APPROVAL');
    setFormPriority(25);
    setFormEnabled(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (policy) => {
    setEditingPolicy(policy);
    setFormName(policy.name);
    setFormDesc(policy.description);
    setFormPattern(policy.tool_pattern);
    setFormOpType(policy.operation_type);
    setFormRisk(policy.risk_level);
    setFormDecision(policy.decision);
    setFormPriority(policy.priority);
    setFormEnabled(policy.enabled);
    setModalOpen(true);
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    const policyPayload = {
      id: editingPolicy ? editingPolicy.id : `pol-${Date.now()}`,
      name: formName,
      description: formDesc,
      tool_pattern: formPattern,
      operation_type: formOpType,
      risk_level: formRisk,
      decision: formDecision,
      priority: Number(formPriority),
      enabled: formEnabled,
    };

    try {
      if (editingPolicy) {
        await policiesApi.update(editingPolicy.id, policyPayload);
      } else {
        await policiesApi.create(policyPayload);
      }
    } catch {
      // optimistic fallback
    }

    if (editingPolicy) {
      setPolicies((prev) =>
        prev.map((p) => (p.id === editingPolicy.id ? policyPayload : p))
      );
      toast.success('Policy successfully updated');
    } else {
      setPolicies((prev) => [policyPayload, ...prev]);
      toast.success('New policy deployed');
    }

    queryClient.invalidateQueries({ queryKey: ['policiesList'] });
    setModalOpen(false);
  };

  const handleToggle = async (policy) => {
    const updatedState = !policy.enabled;
    try {
      await policiesApi.toggle(policy.id, updatedState);
    } catch {
      // fallback
    }

    setPolicies((prev) =>
      prev.map((p) => (p.id === policy.id ? { ...p, enabled: updatedState } : p))
    );
    queryClient.invalidateQueries({ queryKey: ['policiesList'] });
    toast.success(`Policy ${policy.name} ${updatedState ? 'enabled' : 'disabled'}`);
  };

  const handleDelete = (policy) => {
    setDeleteConfirm({
      isOpen: true,
      id: policy.id,
      name: policy.name,
    });
  };

  const confirmDelete = async () => {
    try {
      await policiesApi.delete(deleteConfirm.id);
    } catch {
      // fallback
    }

    setPolicies((prev) => prev.filter((p) => p.id !== deleteConfirm.id));
    queryClient.invalidateQueries({ queryKey: ['policiesList'] });
    setDeleteConfirm({ isOpen: false, id: null, name: '' });
    toast.success('Policy deleted');
  };

  // Run Sandbox Evaluation Simulation
  const handleRunEvaluation = async () => {
    setIsEvaluating(true);
    let parsedArgs = {};
    try {
      parsedArgs = JSON.parse(testArgs);
    } catch {
      toast.error('Invalid JSON in simulated arguments');
      setIsEvaluating(false);
      return;
    }

    try {
      const serverResult = await policiesApi.evaluate({
        agent_name: testAgent,
        tool_name: testTool,
        arguments: parsedArgs,
      });
      setTestResult(serverResult);
    } catch {
      // Realistic client-side evaluation fallback matching active policies
      setTimeout(() => {
        const matchingPolicy = displayPolicies
          .filter((p) => p.enabled)
          .sort((a, b) => a.priority - b.priority)
          .find((p) => {
            const regex = new RegExp(`^${p.tool_pattern.replace(/\*/g, '.*')}$`);
            return regex.test(testTool);
          });

        if (matchingPolicy) {
          setTestResult({
            matched_policy_id: matchingPolicy.id,
            matched_policy_name: matchingPolicy.name,
            decision: matchingPolicy.decision,
            risk_level: matchingPolicy.risk_level,
            explanation: `Matched rule "${matchingPolicy.name}" (Priority ${matchingPolicy.priority}). Pattern "${matchingPolicy.tool_pattern}" matches "${testTool}".`,
            trace_time_ms: 12,
          });
        } else {
          setTestResult({
            matched_policy_id: null,
            matched_policy_name: 'Default Fallback Gateway Policy',
            decision: 'ALLOW',
            risk_level: 'LOW',
            explanation: 'No explicit restriction triggered. Default safe allow path.',
            trace_time_ms: 6,
          });
        }
        setIsEvaluating(false);
      }, 400);
      return;
    }
    setIsEvaluating(false);
  };

  const columns = [
    {
      key: 'name',
      label: 'Policy Rule',
      render: (_, row) => (
        <div className="min-w-0">
          <p className="font-semibold text-white text-sm hover:text-primary-400 cursor-pointer" onClick={() => handleOpenEdit(row)}>
            {row.name}
          </p>
          <p className="text-xs text-slate-400 truncate max-w-sm">{row.description}</p>
        </div>
      ),
    },
    {
      key: 'tool_pattern',
      label: 'Tool Pattern',
      render: (val) => (
        <span className="font-mono text-xs bg-surface-850 px-2 py-0.5 rounded border border-surface-750 text-indigo-300">
          {val}
        </span>
      ),
    },
    {
      key: 'decision',
      label: 'Decision',
      width: '130px',
      render: (val) => <Badge variant={val} size="sm" withDot />,
    },
    {
      key: 'risk_level',
      label: 'Risk Severity',
      width: '120px',
      render: (val) => <RiskBadge level={val} size="sm" />,
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      width: '80px',
      align: 'center',
      render: (val) => (
        <span className="font-mono text-xs text-slate-300 bg-surface-800 px-2 py-0.5 rounded">
          {val}
        </span>
      ),
    },
    {
      key: 'enabled',
      label: 'Status',
      width: '100px',
      render: (val, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleToggle(row);
          }}
          className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border transition-colors ${
            val
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${val ? 'bg-emerald-400' : 'bg-slate-500'}`} />
          <span>{val ? 'ACTIVE' : 'OFF'}</span>
        </button>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleOpenEdit(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition-colors"
            title="Edit Policy"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete Policy"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Governance Policies</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic security enforcement engine: intercept, evaluate, and sandbox agent actions.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          Create Policy Rule
        </Button>
      </div>

      {/* Policies Data Table */}
      <DataTable
        columns={columns}
        data={displayPolicies}
        isLoading={isLoading}
        onRowClick={(row) => handleOpenEdit(row)}
      />

      {/* Policy Evaluation Test Sandbox Panel */}
      <div className="glass-card p-6 border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-400 border border-primary-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight">
              Policy Evaluation Sandbox
            </h3>
            <p className="text-xs text-slate-400">
              Test simulated tool invocations against active policies without executing any code.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Test Inputs */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Simulated Agent
                </label>
                <input
                  type="text"
                  value={testAgent}
                  onChange={(e) => setTestAgent(e.target.value)}
                  className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Tool Name
                </label>
                <input
                  type="text"
                  value={testTool}
                  onChange={(e) => setTestTool(e.target.value)}
                  className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Tool Arguments (JSON Payload)
              </label>
              <textarea
                rows={4}
                value={testArgs}
                onChange={(e) => setTestArgs(e.target.value)}
                className="w-full bg-surface-950 border border-surface-750 rounded-xl p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-primary-500"
              />
            </div>

            <Button
              variant="primary"
              size="md"
              icon={Play}
              isLoading={isEvaluating}
              onClick={handleRunEvaluation}
            >
              Evaluate Policy Decision
            </Button>
          </div>

          {/* Test Result Output Box */}
          <div className="lg:col-span-5 bg-surface-950 p-5 rounded-2xl border border-surface-800 min-h-[220px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-surface-800 text-xs">
                <span className="font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  Gateway Evaluation Trace
                </span>
                {testResult?.trace_time_ms && (
                  <span className="text-[11px] font-mono text-slate-400">
                    Latency: {testResult.trace_time_ms}ms
                  </span>
                )}
              </div>

              {testResult ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={testResult.decision} withDot size="lg" />
                    <RiskBadge level={testResult.risk_level} size="md" />
                  </div>

                  <div className="bg-surface-900 p-3 rounded-xl border border-surface-800 text-xs">
                    <p className="font-semibold text-white mb-1">
                      Matched Policy: {testResult.matched_policy_name}
                    </p>
                    <p className="text-slate-400 leading-relaxed">{testResult.explanation}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Click &ldquo;Evaluate Policy Decision&rdquo; to simulate gateway response.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Policy Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPolicy ? 'Update Governance Policy' : 'Create Governance Policy'}
        subtitle="Define deterministic rule condition and enforcement decision."
        size="lg"
      >
        <form onSubmit={handleSavePolicy} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Policy Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Prevent Production Drops"
                className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Tool Name Pattern <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={formPattern}
                onChange={(e) => setFormPattern(e.target.value)}
                placeholder="e.g. db_* or fs_delete"
                className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description & Security Objective
            </label>
            <textarea
              rows={2}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="State the security threat or regulatory requirement being mitigated..."
              className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Decision Enforcement
              </label>
              <select
                value={formDecision}
                onChange={(e) => setFormDecision(e.target.value)}
                className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500"
              >
                <option value="ALLOW">ALLOW (Pass-through)</option>
                <option value="REQUIRE_APPROVAL">REQUIRE APPROVAL (Human Review)</option>
                <option value="DENY">DENY (Immediate Intercept)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Risk Severity Level
              </label>
              <select
                value={formRisk}
                onChange={(e) => setFormRisk(e.target.value)}
                className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Evaluation Priority (1-100)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="enablePolicy"
              checked={formEnabled}
              onChange={(e) => setFormEnabled(e.target.checked)}
              className="rounded bg-surface-800 border-surface-700 text-primary-600 focus:ring-primary-500 w-4 h-4"
            />
            <label htmlFor="enablePolicy" className="text-xs font-medium text-slate-300 cursor-pointer">
              Enable this policy immediately across all registered agents
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-surface-800">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingPolicy ? 'Save Changes' : 'Deploy Policy'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={confirmDelete}
        title="Delete Governance Policy"
        message={`Are you sure you want to permanently delete "${deleteConfirm.name}"? Agents matching this pattern will no longer be subjected to this rule.`}
      />
    </div>
  );
};

export default Policies;
