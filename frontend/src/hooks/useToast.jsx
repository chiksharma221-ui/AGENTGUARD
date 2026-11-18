import toast from 'react-hot-toast';

export const useToast = () => {
  const defaultStyle = {
    background: '#151722',
    color: '#f8fafc',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
    borderRadius: '10px',
    fontSize: '14px',
    padding: '12px 16px',
    maxWidth: '420px',
  };

  const showSuccess = (message, options = {}) => {
    return toast.success(message, {
      style: {
        ...defaultStyle,
        borderColor: 'rgba(16, 185, 129, 0.3)',
      },
      iconTheme: {
        primary: '#10b981',
        secondary: '#0a0b0f',
      },
      duration: 4000,
      ...options,
    });
  };

  const showError = (message, options = {}) => {
    return toast.error(message, {
      style: {
        ...defaultStyle,
        borderColor: 'rgba(239, 68, 68, 0.3)',
      },
      iconTheme: {
        primary: '#ef4444',
        secondary: '#0a0b0f',
      },
      duration: 5000,
      ...options,
    });
  };

  const showWarning = (message, options = {}) => {
    return toast(message, {
      icon: '⚠️',
      style: {
        ...defaultStyle,
        borderColor: 'rgba(245, 158, 11, 0.3)',
      },
      duration: 4500,
      ...options,
    });
  };

  const showInfo = (message, options = {}) => {
    return toast(message, {
      icon: 'ℹ️',
      style: {
        ...defaultStyle,
        borderColor: 'rgba(99, 102, 241, 0.3)',
      },
      duration: 4000,
      ...options,
    });
  };

  const showApprovalAlert = (approvalData, onView) => {
    return toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-surface-850 border border-primary-500/40 shadow-glow-primary rounded-xl p-4 pointer-events-auto flex items-start gap-3 backdrop-blur-xl`}
        >
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
              Pending Approval Required
            </p>
            <p className="text-sm font-medium text-white truncate mt-0.5">
              {approvalData.tool_name || 'Tool Execution'}
            </p>
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              Agent <span className="text-slate-200 font-mono">{approvalData.agent_name || 'Agent'}</span> requested high-risk action.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  if (onView) onView(approvalData);
                  else window.location.href = '/approvals';
                }}
                className="px-3 py-1 bg-primary-600 hover:bg-primary-500 text-white text-xs font-medium rounded-md shadow-sm transition-colors"
              >
                Review Now
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="px-2 py-1 bg-surface-750 hover:bg-surface-700 text-slate-300 text-xs rounded-md transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ),
      { duration: 8000 }
    );
  };

  return {
    success: showSuccess,
    error: showError,
    warning: showWarning,
    info: showInfo,
    approvalAlert: showApprovalAlert,
    dismiss: toast.dismiss,
  };
};

export default useToast;
