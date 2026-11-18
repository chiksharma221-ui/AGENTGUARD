import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Database,
  FileCode,
  Github,
  Globe,
  Terminal,
  Cpu,
  Power,
  Code,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Server,
} from 'lucide-react';
import { toolsApi } from '../services/api';
import RiskBadge from '../components/ui/RiskBadge';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';

const CATEGORY_ICONS = {
  database: Database,
  filesystem: FileCode,
  github: Github,
  web: Globe,
  system: Terminal,
};

const INITIAL_TOOLS = [
  {
    id: 'tool-1',
    name: 'db_execute_query',
    category: 'database',
    risk_level: 'HIGH',
    description: 'Executes parameterized SQL statements against configured relational databases.',
    enabled: true,
    mcp_server: 'postgres-mcp-server',
    schema: {
      type: 'object',
      properties: {
        database: { type: 'string', description: 'Target database identifier' },
        query: { type: 'string', description: 'SQL query string with sanitization requirements' },
        max_rows: { type: 'integer', default: 100 },
        dry_run: { type: 'boolean', default: false },
      },
      required: ['database', 'query'],
    },
  },
  {
    id: 'tool-2',
    name: 'fs_read_file',
    category: 'filesystem',
    risk_level: 'LOW',
    description: 'Safely reads contents of local workspace files with strict directory traversal prevention.',
    enabled: true,
    mcp_server: 'filesystem-mcp-server',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path within the agent sandbox' },
        encoding: { type: 'string', enum: ['utf-8', 'base64'], default: 'utf-8' },
      },
      required: ['path'],
    },
  },
  {
    id: 'tool-3',
    name: 'fs_write_file',
    category: 'filesystem',
    risk_level: 'HIGH',
    description: 'Writes or updates files inside sandboxed directories. Path restrictions apply.',
    enabled: true,
    mcp_server: 'filesystem-mcp-server',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Destination path' },
        content: { type: 'string', description: 'File content' },
        overwrite: { type: 'boolean', default: false },
      },
      required: ['path', 'content'],
    },
  },
  {
    id: 'tool-4',
    name: 'github_create_pull_request',
    category: 'github',
    risk_level: 'MEDIUM',
    description: 'Opens a pull request against target repository branches via GitHub REST API.',
    enabled: true,
    mcp_server: 'github-mcp-server',
    schema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repository name' },
        title: { type: 'string' },
        head: { type: 'string' },
        base: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['repo', 'title', 'head', 'base'],
    },
  },
  {
    id: 'tool-5',
    name: 'web_scrape_url',
    category: 'web',
    risk_level: 'LOW',
    description: 'Performs outbound HTTP GET requests and parses static HTML into markdown.',
    enabled: true,
    mcp_server: 'web-fetch-mcp-server',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        timeout_seconds: { type: 'integer', default: 10 },
      },
      required: ['url'],
    },
  },
  {
    id: 'tool-6',
    name: 'k8s_restart_deployment',
    category: 'system',
    risk_level: 'CRITICAL',
    description: 'Initiates a rolling pod restart of Kubernetes deployment in cluster namespace.',
    enabled: false,
    mcp_server: 'k8s-cluster-mcp-server',
    schema: {
      type: 'object',
      properties: {
        cluster: { type: 'string' },
        namespace: { type: 'string' },
        deployment: { type: 'string' },
      },
      required: ['cluster', 'namespace', 'deployment'],
    },
  },
];

export const Tools = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [toolsList, setToolsList] = useState(INITIAL_TOOLS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [schemaModal, setSchemaModal] = useState({ isOpen: false, tool: null });
  const [copied, setCopied] = useState(false);

  // Fetch tools from API
  const { data: serverTools, isLoading } = useQuery({
    queryKey: ['toolsList'],
    queryFn: async () => {
      try {
        const res = await toolsApi.list();
        const list = Array.isArray(res) ? res : res?.items || [];
        return list.length > 0 ? list : INITIAL_TOOLS;
      } catch {
        return INITIAL_TOOLS;
      }
    },
  });

  const displayTools = serverTools || toolsList;

  // Toggle tool enabled status
  const handleToggleTool = async (tool) => {
    const newStatus = !tool.enabled;
    try {
      await toolsApi.toggle(tool.id, newStatus);
    } catch {
      // optimistic
    }

    setToolsList((prev) =>
      prev.map((t) => (t.id === tool.id ? { ...t, enabled: newStatus } : t))
    );
    queryClient.invalidateQueries({ queryKey: ['toolsList'] });
    toast.success(`Tool ${tool.name} ${newStatus ? 'enabled' : 'disabled'}`);
  };

  const handleCopySchema = (schema) => {
    navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
    setCopied(true);
    toast.success('JSON Schema copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredTools = displayTools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' || tool.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header and MCP Gateway Status */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Registered MCP Tools</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Model Context Protocol capabilities accessible by governed AI agents.
          </p>
        </div>

        {/* MCP Status Pill */}
        <div className="flex items-center gap-2 bg-surface-900 border border-surface-800 px-3 py-1.5 rounded-xl text-xs">
          <Server className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300">MCP Gateway:</span>
          <span className="font-semibold text-emerald-400 font-mono">CONNECTED (4 SERVERS)</span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['ALL', 'database', 'filesystem', 'github', 'web', 'system'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider transition-colors shrink-0 ${
                selectedCategory === cat
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-surface-850 text-slate-400 hover:text-slate-200 border border-surface-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools & descriptions..."
            className="w-full bg-surface-900 border border-surface-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTools.map((tool) => {
          const Icon = CATEGORY_ICONS[tool.category] || Wrench;
          return (
            <div
              key={tool.id}
              className={`glass-card p-5 border-white/10 hover:border-primary-500/40 transition-all duration-300 flex flex-col justify-between group ${
                !tool.enabled ? 'opacity-65' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-surface-850 text-primary-400 border border-surface-750 group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono tracking-tight">
                        {tool.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 uppercase font-mono tracking-wider">
                        {tool.category} &bull; {tool.mcp_server}
                      </p>
                    </div>
                  </div>

                  <RiskBadge level={tool.risk_level} size="sm" />
                </div>

                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-4">
                  {tool.description}
                </p>
              </div>

              {/* Bottom Card Bar: View Schema & Enabled Switch */}
              <div className="pt-3 border-t border-surface-800 flex items-center justify-between">
                <button
                  onClick={() => setSchemaModal({ isOpen: true, tool })}
                  className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium"
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>Inspect Schema</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    {tool.enabled ? 'ACTIVE' : 'MUTED'}
                  </span>
                  <button
                    onClick={() => handleToggleTool(tool)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${
                      tool.enabled ? 'bg-primary-600' : 'bg-surface-750'
                    }`}
                    aria-label="Toggle tool availability"
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out ${
                        tool.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schema Viewer Modal */}
      <Modal
        isOpen={schemaModal.isOpen}
        onClose={() => setSchemaModal({ isOpen: false, tool: null })}
        title={`MCP Tool Schema: ${schemaModal.tool?.name}`}
        subtitle={`JSON specification for ${schemaModal.tool?.mcp_server}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400 uppercase">
              Parameter Schema Definition
            </span>
            <button
              onClick={() => handleCopySchema(schemaModal.tool?.schema)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>

          <div className="bg-surface-950 p-4 rounded-xl border border-surface-800 max-h-96 overflow-y-auto font-mono text-xs text-emerald-400 select-all">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(schemaModal.tool?.schema, null, 2)}
            </pre>
          </div>

          <div className="pt-3 flex justify-end border-t border-surface-800">
            <Button
              variant="secondary"
              onClick={() => setSchemaModal({ isOpen: false, tool: null })}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Tools;
