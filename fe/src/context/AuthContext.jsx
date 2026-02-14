import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('amp_token'));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('amp_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(Boolean(token));

  const persistAuth = (nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    if (nextToken) {
      localStorage.setItem('amp_token', nextToken);
    } else {
      localStorage.removeItem('amp_token');
    }

    if (nextUser) {
      localStorage.setItem('amp_user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('amp_user');
    }
  };

  const login = async ({ email, password }) => {
    const { data } = await api.post('/auth/login', { email, password });
    persistAuth(data.token, data.user);
    return data.user;
  };

  const logout = () => {
    persistAuth(null, null);
  };

  useEffect(() => {
    const hydrate = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        localStorage.setItem('amp_user', JSON.stringify(data.user));
      } catch (_error) {
        persistAuth(null, null);
      } finally {
        setLoading(false);
      }
    };

    hydrate();
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === 'ADMIN'
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used in AuthProvider');
  return context;
};
