'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearAuthToken, getAuthToken, setAuthToken, api } from '@/lib/api';
import { User } from '@/types';

interface ImpersonatedOrg {
  id: number;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  isSuperAdmin: boolean;
  isOwner: boolean;
  isManager: boolean;
  isAccountant: boolean;
  isDriver: boolean;
  impersonatedOrg: ImpersonatedOrg | null;
  enterOrganization: (org: ImpersonatedOrg) => void;
  exitOrganization: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: async () => {},
  isSuperAdmin: false,
  isOwner: false,
  isManager: false,
  isAccountant: false,
  isDriver: false,
  impersonatedOrg: null,
  enterOrganization: () => {},
  exitOrganization: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [impersonatedOrg, setImpersonatedOrg] = useState<ImpersonatedOrg | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    const storedUser = localStorage.getItem('haultrack_user');
    const impId = localStorage.getItem('haultrack_impersonated_org_id');
    const impName = localStorage.getItem('haultrack_impersonated_org_name');

    if (impId && impName) {
      setImpersonatedOrg({ id: Number(impId), name: impName });
    }

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
          setImpersonatedOrg(null);
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
    localStorage.removeItem('haultrack_impersonated_org_id');
    localStorage.removeItem('haultrack_impersonated_org_name');
    setImpersonatedOrg(null);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    } finally {
      clearAuthToken();
      setUser(null);
      setImpersonatedOrg(null);
      window.location.href = '/login';
    }
  };

  const enterOrganization = (org: ImpersonatedOrg) => {
    localStorage.setItem('haultrack_impersonated_org_id', String(org.id));
    localStorage.setItem('haultrack_impersonated_org_name', org.name);
    setImpersonatedOrg(org);
  };

  const exitOrganization = () => {
    localStorage.removeItem('haultrack_impersonated_org_id');
    localStorage.removeItem('haultrack_impersonated_org_name');
    setImpersonatedOrg(null);
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isOwner = user?.role === 'owner' || (isSuperAdmin && impersonatedOrg !== null);
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
        isSuperAdmin,
        isOwner,
        isManager,
        isAccountant,
        isDriver,
        impersonatedOrg,
        enterOrganization,
        exitOrganization,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
