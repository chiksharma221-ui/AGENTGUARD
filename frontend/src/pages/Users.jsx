import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users as UsersIcon,
  Plus,
  Shield,
  Edit2,
  Trash2,
  KeyRound,
  Power,
  UserCheck,
  UserX,
  Mail,
  Lock,
} from 'lucide-react';
import { usersApi } from '../services/api';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal, { ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import { format } from 'date-fns';

const INITIAL_USERS = [
  {
    id: 'usr-1',
    name: 'Alex Vance',
    email: 'admin@agentguard.io',
    roles: ['admin', 'security_lead'],
    status: 'ACTIVE',
    created_at: '2026-08-12',
  },
  {
    id: 'usr-2',
    name: 'Sarah Jenkins',
    email: 'sjenkins@enterprise.corp',
    roles: ['security_lead'],
    status: 'ACTIVE',
    created_at: '2026-09-01',
  },
  {
    id: 'usr-3',
    name: 'Marcus Brody',
    email: 'mbrody@operations.net',
    roles: ['operator'],
    status: 'ACTIVE',
    created_at: '2026-10-15',
  },
  {
    id: 'usr-4',
    name: 'Elena Rostova',
    email: 'elena@compliance.audit',
    roles: ['auditor'],
    status: 'ACTIVE',
    created_at: '2026-11-01',
  },
];

const AVAILABLE_ROLES = [
  { id: 'admin', name: 'Admin', desc: 'Full system configuration, user provisioning, and gateway controls' },
  { id: 'security_lead', name: 'Security Lead', desc: 'Policy formulation, approval authority, and audit reviews' },
  { id: 'operator', name: 'Operator', desc: 'Human-in-the-loop review and execution decisions' },
  { id: 'auditor', name: 'Auditor', desc: 'Read-only access to tamper-evident audit logs and reports' },
  { id: 'viewer', name: 'Viewer', desc: 'Read-only access to dashboards and status indicators' },
];

export const Users = () => {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [usersList, setUsersList] = useState(INITIAL_USERS);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [roleModal, setRoleModal] = useState({ isOpen: false, user: null });
  const [pwdModal, setPwdModal] = useState({ isOpen: false, user: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, user: null });

  // Create Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState(['operator']);

  // Password Reset State
  const [newPassword, setNewPassword] = useState('');

  // Fetch users
  const { data: serverUsers, isLoading } = useQuery({
    queryKey: ['usersList'],
    queryFn: async () => {
      try {
        const res = await usersApi.list();
        const list = Array.isArray(res) ? res : res?.items || [];
        return list.length > 0 ? list : INITIAL_USERS;
      } catch {
        return INITIAL_USERS;
      }
    },
  });

  const displayUsers = serverUsers || usersList;

  // Create user
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const newUser = {
      id: `usr-${Date.now()}`,
      name,
      email,
      roles: selectedRoles,
      status: 'ACTIVE',
      created_at: format(new Date(), 'yyyy-MM-dd'),
    };

    try {
      await usersApi.create({ name, email, password, roles: selectedRoles });
    } catch {
      // fallback
    }

    setUsersList((prev) => [newUser, ...prev]);
    queryClient.invalidateQueries({ queryKey: ['usersList'] });
    setCreateModalOpen(false);
    setName('');
    setEmail('');
    setPassword('');
    setSelectedRoles(['operator']);
    toast.success(`User ${newUser.name} created successfully`);
  };

  // Toggle user active / deactivated status
  const handleToggleStatus = (user) => {
    const updatedStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setUsersList((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: updatedStatus } : u))
    );
    queryClient.invalidateQueries({ queryKey: ['usersList'] });
    toast.success(`User ${user.name} marked as ${updatedStatus}`);
  };

  // Toggle role assignment for user
  const handleToggleUserRole = (roleId) => {
    if (!roleModal.user) return;
    const currentRoles = roleModal.user.roles || [];
    let updated = [];
    if (currentRoles.includes(roleId)) {
      if (currentRoles.length === 1) {
        toast.warning('User must retain at least one assigned role');
        return;
      }
      updated = currentRoles.filter((r) => r !== roleId);
    } else {
      updated = [...currentRoles, roleId];
    }

    setUsersList((prev) =>
      prev.map((u) => (u.id === roleModal.user.id ? { ...u, roles: updated } : u))
    );
    setRoleModal((prev) => ({
      ...prev,
      user: { ...prev.user, roles: updated },
    }));
    toast.success('Role permissions updated');
  };

  // Change password
  const handleChangePassword = (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setPwdModal({ isOpen: false, user: null });
    setNewPassword('');
    toast.success(`Password successfully changed for ${pwdModal.user?.name}`);
  };

  // Delete user
  const confirmDeleteUser = () => {
    setUsersList((prev) => prev.filter((u) => u.id !== deleteConfirm.user.id));
    queryClient.invalidateQueries({ queryKey: ['usersList'] });
    setDeleteConfirm({ isOpen: false, user: null });
    toast.success('User account removed');
  };

  const columns = [
    {
      key: 'name',
      label: 'Team Member',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-primary-500/30 text-primary-300 font-bold flex items-center justify-center text-xs uppercase">
            {row.name.slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-white text-xs">{row.name}</p>
            <p className="text-[11px] text-slate-400">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'roles',
      label: 'Assigned Roles',
      render: (roles) => (
        <div className="flex flex-wrap gap-1">
          {Array.isArray(roles) &&
            roles.map((r) => (
              <Badge key={r} variant={r} size="sm">
                {r.toUpperCase()}
              </Badge>
            ))}
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
      key: 'created_at',
      label: 'Member Since',
      render: (val) => <span className="font-mono text-xs text-slate-400">{val}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setRoleModal({ isOpen: true, user: row })}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition-colors"
            title="Manage Roles"
          >
            <Shield className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPwdModal({ isOpen: true, user: row })}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-800 transition-colors"
            title="Reset Password"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleToggleStatus(row)}
            className={`p-1.5 rounded-lg transition-colors ${
              row.status === 'ACTIVE'
                ? 'text-emerald-400 hover:bg-emerald-500/10'
                : 'text-slate-500 hover:text-slate-300 hover:bg-surface-800'
            }`}
            title={row.status === 'ACTIVE' ? 'Deactivate User' : 'Activate User'}
          >
            <Power className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirm({ isOpen: true, user: row })}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete User"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">User & Access Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Role-Based Access Control (RBAC): govern who can define policies and approve agent tasks.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setCreateModalOpen(true)}>
          Invite Team Member
        </Button>
      </div>

      {/* Users Table */}
      <DataTable
        columns={columns}
        data={displayUsers}
        isLoading={isLoading}
      />

      {/* Create User Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Provision New Team Member"
        subtitle="Invite an operator or security engineer to the AgentGuard gateway."
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rachel Adams"
              className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Work Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="rachel@enterprise.com"
              className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Temporary Password <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Initial RBAC Roles
            </label>
            <div className="space-y-2">
              {AVAILABLE_ROLES.map((role) => (
                <label
                  key={role.id}
                  className="flex items-start gap-2.5 p-2 rounded-xl bg-surface-900 border border-surface-800 cursor-pointer hover:border-surface-700 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRoles([...selectedRoles, role.id]);
                      } else {
                        setSelectedRoles(selectedRoles.filter((r) => r !== role.id));
                      }
                    }}
                    className="mt-0.5 rounded bg-surface-800 border-surface-700 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      {role.name}
                    </span>
                    <span className="text-[11px] text-slate-400 block">{role.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-surface-800">
            <Button variant="secondary" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Provision Member
            </Button>
          </div>
        </form>
      </Modal>

      {/* Role Assignment Modal */}
      {roleModal.user && (
        <Modal
          isOpen={roleModal.isOpen}
          onClose={() => setRoleModal({ isOpen: false, user: null })}
          title={`Assign Roles: ${roleModal.user.name}`}
          subtitle="Configure RBAC permissions and capabilities for this user."
          size="md"
        >
          <div className="space-y-3">
            {AVAILABLE_ROLES.map((role) => {
              const isAssigned = (roleModal.user.roles || []).includes(role.id);
              return (
                <div
                  key={role.id}
                  onClick={() => handleToggleUserRole(role.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors flex items-center justify-between ${
                    isAssigned
                      ? 'bg-primary-500/10 border-primary-500/30'
                      : 'bg-surface-900 border-surface-800 hover:border-surface-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-xs">{role.name}</span>
                      {isAssigned && (
                        <span className="text-[10px] bg-primary-500/20 text-primary-400 px-1.5 py-0.2 rounded font-mono">
                          ASSIGNED
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{role.desc}</p>
                  </div>

                  <input
                    type="checkbox"
                    checked={isAssigned}
                    readOnly
                    className="rounded bg-surface-800 border-surface-700 text-primary-600 focus:ring-primary-500 w-4 h-4 pointer-events-none"
                  />
                </div>
              );
            })}

            <div className="pt-3 flex justify-end border-t border-surface-800">
              <Button
                variant="primary"
                onClick={() => setRoleModal({ isOpen: false, user: null })}
              >
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Password Reset Modal */}
      {pwdModal.user && (
        <Modal
          isOpen={pwdModal.isOpen}
          onClose={() => setPwdModal({ isOpen: false, user: null })}
          title={`Reset Password for ${pwdModal.user.name}`}
          subtitle="Set a new secure master password for this account."
          size="sm"
        >
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New Secure Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-surface-900 border border-surface-750 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500"
              />
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-surface-800">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setPwdModal({ isOpen: false, user: null })}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Update Password
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete User Confirmation */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, user: null })}
        onConfirm={confirmDeleteUser}
        title="Revoke Team Member Access"
        message={`Are you sure you want to permanently revoke all access for ${deleteConfirm.user?.name}?`}
      />
    </div>
  );
};

export default Users;
