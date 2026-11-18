import { useAuthStore } from '../store/authStore';

export const useAuth = () => {
  const {
    user,
    token,
    refreshToken,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    loadCurrentUser,
    refreshAuthToken,
    clearError,
  } = useAuthStore();

  const hasRole = (role) => {
    if (!user) return false;
    if (
      user.is_superuser ||
      (Array.isArray(user.roles) && user.roles.includes('admin'))
    ) {
      return true;
    }
    if (!user.roles) return false;
    if (Array.isArray(user.roles)) {
      return user.roles.includes(role);
    }
    return user.roles === role;
  };

  const isAdmin = hasRole('admin');
  const isSecurityLead = hasRole('security_lead') || isAdmin;
  const isApprover = hasRole('approver') || isAdmin;

  return {
    user,
    token,
    refreshToken,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    loadCurrentUser,
    refreshAuthToken,
    clearError,
    hasRole,
    isAdmin,
    isSecurityLead,
    isApprover,
  };
};

export default useAuth;
