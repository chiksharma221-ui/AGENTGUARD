import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useToast } from '../../hooks/useToast';

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { lastMessage } = useWebSocket('/ws/approvals');
  const toast = useToast();
  const navigate = useNavigate();

  // Listen for real-time approval events over WebSocket
  useEffect(() => {
    if (lastMessage && (lastMessage.type === 'APPROVAL_REQUIRED' || lastMessage.type === 'NEW_APPROVAL' || lastMessage.event === 'pending_approval')) {
      const approvalData = lastMessage.data || lastMessage;
      toast.approvalAlert(approvalData, () => {
        navigate('/approvals');
      });
    }
  }, [lastMessage, toast, navigate]);

  return (
    <div className="min-h-screen bg-background text-slate-100 flex">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <Topbar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in-50 duration-200">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
