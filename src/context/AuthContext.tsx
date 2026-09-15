// src/context/AuthContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { checkAuth, logout } from '@/lib/login_api';
import { useRouter } from 'next/navigation';

type AuthContextType = {
  isAuthenticated: boolean;
  isSyncing: boolean;
  setIsAuthenticated: (value: boolean) => void;
  handleLogout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local flag for optimistic auth on app open (fast path, favorites render instantly).
const AUTH_FLAG_KEY = 'auth_token';

function hasStoredAuthFlag(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return !!window.localStorage.getItem(AUTH_FLAG_KEY);
  } catch {
    return false;
  }
}

function persistAuthFlag(value: boolean) {
  try {
    if (typeof window === 'undefined') return;
    if (value) {
      window.localStorage.setItem(AUTH_FLAG_KEY, '1');
    } else {
      window.localStorage.removeItem(AUTH_FLAG_KEY);
    }
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Start authenticated when a local session exists, verify in background.
  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(() => hasStoredAuthFlag());
  // True while background verification is in progress (only when optimistically authenticated).
  const [isSyncing, setIsSyncing] = useState<boolean>(() => hasStoredAuthFlag());
  const router = useRouter();

  const setIsAuthenticated = (value: boolean) => {
    setIsAuthenticatedState(value);
    persistAuthFlag(value);
    if (!value) {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const authStatus = await checkAuth();
        if (authStatus.isAuthenticated) {
          setIsAuthenticatedState(true);
          persistAuthFlag(true);
        } else {
          // Expired session: fall back to unauthenticated.
          setIsAuthenticatedState(false);
          persistAuthFlag(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Keep optimistic value on network error, stop sync indicator.
        if (!hasStoredAuthFlag()) {
          setIsAuthenticatedState(false);
        }
      } finally {
        setIsSyncing(false);
      }
    };
    verifyAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setIsAuthenticatedState(false);
      setIsSyncing(false);
      persistAuthFlag(false);
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isSyncing, setIsAuthenticated, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}