'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearAuthToken, getAuthToken, setAuthToken, api } from '@/lib/api';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  isOwner: boolean;
  isManager: boolean;
  isAccountant: boolean;
  isDriver: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: async () => {},
  isOwner: false,
  isManager: false,
  isAccountant: false,
  isDriver: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    const storedUser = localStorage.getItem('haultrack_user');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        clearAuthToken();
      }
    }

    if (token) {
      api.get<{ user: User }>('/auth/me')
        .then((res) => {
          setUser(res.user);
          localStorage.setItem('haultrack_user', JSON.stringify(res.user));
        })
        .catch(() => {
          clearAuthToken();
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = (token: string, userData: User) => {
    setAuthToken(token);
    setUser(userData);
    localStorage.setItem('haultrack_user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAuthToken();
      setUser(null);
      window.location.href = '/login';
    }
  };

  const isOwner = user?.role === 'owner';
  const isManager = user?.role === 'manager';
  const isAccountant = user?.role === 'accountant';
  const isDriver = user?.role === 'driver';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isOwner,
        isManager,
        isAccountant,
        isDriver,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

