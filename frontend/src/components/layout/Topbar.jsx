import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Menu,
  Bell,
  Search,
  Radio,
  Wifi,
  WifiOff,
  User,
  Shield,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';

const ROUTE_TITLES = {
  '/dashboard': { title: 'Security Dashboard', subtitle: 'Real-time overview of agent activity and policy enforcement' },
  '/agents': { title: 'Agent Registry', subtitle: 'Manage authorized AI agents, API keys, and execution limits' },
  '/approvals': { title: 'Human-in-the-Loop Approvals', subtitle: 'Review and decide pending high-risk tool operations' },
  '/policies': { title: 'Governance Policies', subtitle: 'Configure deterministic security rules, access control, and risk boundaries' },
  '/tools': { title: 'Registered MCP Tools', subtitle: 'Inspect connected Model Context Protocol capabilities and schemas' },
  '/audit': { title: 'Security Audit Logs', subtitle: 'Immutable cryptographically verifiable event stream and traces' },
  '/users': { title: 'User & Access Management', subtitle: 'Manage organization team members, roles, and administrative rights' },
};

export const Topbar = ({ onToggleSidebar }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isConnected, connectionStatus } = useWebSocket('/ws/approvals');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const routeInfo = ROUTE_TITLES[location.pathname] || {
    title: 'AgentGuard Gateway',
    subtitle: 'Secure Agent Execution Environment',
  };

  return (
    <header className="sticky top-0 z-30 h-16 w-full bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/80 px-4 lg:px-8 flex items-center justify-between">
      {/* Left section: Hamburger button & Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-850 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
            {routeInfo.title}
          </h1>
          <p className="hidden md:block text-xs text-slate-400">
            {routeInfo.subtitle}
          </p>
        </div>
      </div>

      {/* Right section: Search bar, WS Status, Notifications, Profile */}
      <div className="flex items-center gap-3">
        {/* Global Search Input */}
        <div className="hidden sm:flex items-center relative w-48 md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search agents, tools, logs..."
            className="w-full bg-surface-900 border border-surface-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
        </div>

        {/* WebSocket Connection Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
          title={`WebSocket Gateway Status: ${connectionStatus}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 beacon-online' : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="hidden md:inline font-semibold">
            {isConnected ? 'LIVE GATEWAY' : 'RECONNECTING'}
          </span>
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-850 relative transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary-500" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-surface-900 border border-surface-700/80 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in-50 zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-surface-800">
                <span className="text-xs font-semibold text-white uppercase tracking-wider">
                  Live Gateway Alerts
                </span>
                <span className="text-[10px] text-primary-400 font-mono">Real-time</span>
              </div>
              <div className="mt-3 space-y-2.5 max-h-64 overflow-y-auto">
                <div className="p-2.5 rounded-lg bg-surface-850 border border-surface-800 text-xs">
                  <p className="font-medium text-amber-400">Policy Interception</p>
                  <p className="text-slate-300 mt-0.5">
                    Agent <span className="font-mono text-white">data-analyst</span> requested delete operation.
                  </p>
                  <span className="text-[10px] text-slate-500 mt-1 block">2 minutes ago</span>
                </div>
                <div className="p-2.5 rounded-lg bg-surface-850 border border-surface-800 text-xs">
                  <p className="font-medium text-emerald-400">MCP Server Synchronized</p>
                  <p className="text-slate-300 mt-0.5">
                    12 new tools discovered from local filesystem MCP server.
                  </p>
                  <span className="text-[10px] text-slate-500 mt-1 block">15 minutes ago</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-850 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-primary-600/30 border border-primary-500/40 text-primary-300 flex items-center justify-center font-bold text-xs uppercase">
              {user?.name ? user.name[0] : 'U'}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-surface-900 border border-surface-700/80 rounded-xl shadow-2xl py-2 z-50">
              <div className="px-4 py-2 border-b border-surface-800">
                <p className="text-xs font-semibold text-white">{user?.name || 'Administrator'}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email || 'admin@agentguard.io'}</p>
              </div>
              <a
                href="#profile"
                onClick={(e) => {
                  e.preventDefault();
                  setShowUserMenu(false);
                }}
                className="flex items-center gap-2 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-surface-800 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Security Profile</span>
              </a>
              <div className="border-t border-surface-800 my-1" />
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                  window.location.href = '/login';
                }}
                className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
