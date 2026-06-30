import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange, signUp, signIn, signOut, resetPassword } from '../services/authService';
import { fetchUserRole } from '../services/rolesService';
import { isAdmin as computeIsAdmin } from '../utils/admin';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        const r = await fetchUserRole(u.uid, u.email);
        setRole(r);
      } else {
        setRole(null);
      }
    });
    return unsubscribe;
  }, []);

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    role,
    isBetaTester: role === 'beta_tester',
    isAdmin: computeIsAdmin(user),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useIsAdmin() {
  return useAuth().isAdmin;
}
