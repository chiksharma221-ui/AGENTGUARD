import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import ApprovalCenter from './pages/ApprovalCenter';
import Policies from './pages/Policies';
import Tools from './pages/Tools';
import AuditLogs from './pages/AuditLogs';
import Users from './pages/Users';
import { useAuth } from './hooks/useAuth';

export const App = () => {
  const { loadCurrentUser } = useAuth();

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />

      {/* Protected Routes wrapped in Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route
          path="agents"
          element={
            <ProtectedRoute requiredRole="admin">
              <Agents />
            </ProtectedRoute>
          }
        />
        <Route
          path="approvals"
          element={
            <ProtectedRoute requiredRole="approver">
              <ApprovalCenter />
            </ProtectedRoute>
          }
        />
        <Route
          path="policies"
          element={
            <ProtectedRoute requiredRole="security_lead">
              <Policies />
            </ProtectedRoute>
          }
        />
        <Route path="tools" element={<Tools />} />
        <Route path="audit" element={<AuditLogs />} />
        <Route
          path="users"
          element={
            <ProtectedRoute requiredRole="admin">
              <Users />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback wildcard route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
