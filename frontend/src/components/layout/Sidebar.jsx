import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Bot,
  ShieldCheck,
  Scale,
  Wrench,
  FileText,
  Users,
  Shield,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { approvalsApi } from '../../services/api';

const NAV_ITEMS = [
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Agents', path: '/agents', icon: Bot, requiredRole: 'admin' },
  {
    name: 'Approvals',
    path: '/approvals',
    icon: ShieldCheck,
    hasBadge: true,
    requiredRole: 'approver',
  },
  { name: 'Policies', path: '/policies', icon: Scale, requiredRole: 'security_lead' },
  { name: 'Tools', path: '/tools', icon: Wrench },
  { name: 'Audit Logs', path: '/audit', icon: FileText },
  { name: 'Users', path: '/users', icon: Users, adminOnly: true },
];

export const Sidebar = ({ isOpen, onClose }) => {
  const { user, logout, isAdmin, hasRole, isApprover } = useAuth();

  // Query pending approvals count for the sidebar badge
  const { data: pendingApprovals } = useQuery({
    queryKey: ['pendingApprovalsCount'],
    queryFn: async () => {
      const res = await approvalsApi.list({ status: 'PENDING' });
      if (Array.isArray(res)) return res.length;
      if (res?.items && Array.isArray(res.items)) return res.items.length;
      return typeof res?.total === 'number' ? res.total : 0;
    },
    refetchInterval: 10000,
    enabled: isApprover,
  });

  const pendingCount = pendingApprovals ?? 0;

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-surface-900 border-r border-surface-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Logo Header */}
          <div className="h-16 px-6 flex items-center gap-3 border-b border-surface-800/80">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-primary-600/30 border border-primary-400/30">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-white">Agent</span>
                <span className="font-bold text-base tracking-tight text-primary-400">Guard</span>
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                Security Gateway
              </p>
            </div>
          </div>

          {/* Navigation Menu */}
          <div className="px-3 py-6">
            <div className="px-3 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Core Governance
              </p>
            </div>

            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                if (item.adminOnly && !isAdmin) return null;
                if (item.requiredRole && !hasRole(item.requiredRole)) return null;
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-primary-600/20 to-primary-500/5 text-white border border-primary-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-surface-800/50'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-3">
                          <Icon
                            className={`w-5 h-5 transition-colors ${
                              isActive
                                ? 'text-primary-400'
                                : 'text-slate-400 group-hover:text-slate-300'
                            }`}
                          />
                          <span>{item.name}</span>
                        </div>

                        {item.hasBadge && pendingCount > 0 && (
                          <span className="px-2 py-0.5 text-[11px] font-bold font-mono rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                            {pendingCount}
                          </span>
                        )}

                        {isActive && (
                          <span className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full bg-primary-500 shadow-glow-primary" />
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* User Card & Logout Bottom Section */}
        <div className="p-4 border-t border-surface-800/80 bg-surface-950/40">
          <div className="flex items-center justify-between p-2 rounded-xl bg-surface-850/60 border border-surface-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-sm uppercase shrink-0">
                {user?.name ? user.name.slice(0, 2) : 'AG'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {user?.name || 'Security Lead'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {user?.email || 'admin@agentguard.io'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
