/**
 * useAuth Hook - Microsoft SSO Authentication
 * Manages authentication state and provides login/logout functions
 */
import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3300';

// User type
export interface User {
  id: string;
  email: string;
  name: string;
  roles: string[];
}

// Auth context type
interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (returnUrl?: string) => void;
  logout: (full?: boolean) => void;
  refreshToken: () => Promise<void>;
  hasRole: (role: string) => boolean;
  isAdmin: boolean;
}

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Token storage key
const TOKEN_KEY = 'auth_token';

/**
 * Get stored token
 */
function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Store token
 */
function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.warn('Could not store token:', e);
  }
}

/**
 * Clear stored token
 */
function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn('Could not clear token:', e);
  }
}

/**
 * Check if token is expired
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/**
 * Auth Provider component
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for callback token on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const returnUrl = params.get('returnUrl');
    
    if (token) {
      storeToken(token);
      // Clean URL
      const cleanUrl = returnUrl || window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
    
    // Check authentication status
    checkAuth();
  }, []);

  /**
   * Check current authentication status
   */
  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    const token = getStoredToken();
    
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    
    // Quick client-side expiry check
    if (isTokenExpired(token)) {
      clearToken();
      setUser(null);
      setIsLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Auth check failed');
      }
      
      const data = await response.json();
      
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        clearToken();
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check error:', err);
      clearToken();
      setUser(null);
      setError('Authentication check failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initiate Microsoft login
   */
  const login = useCallback((returnUrl?: string) => {
    const url = returnUrl 
      ? `${API_URL}/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`
      : `${API_URL}/auth/login`;
    
    window.location.href = url;
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async (full: boolean = false) => {
    clearToken();
    setUser(null);
    
    if (full) {
      // Full logout including Microsoft
      window.location.href = `${API_URL}/auth/logout?full=true`;
    } else {
      // Just clear local session
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // Ignore errors
      }
    }
  }, []);

  /**
   * Refresh auth token
   */
  const refreshToken = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          storeToken(data.token);
        }
      } else {
        // Token refresh failed, need to re-login
        clearToken();
        setUser(null);
      }
    } catch (err) {
      console.error('Token refresh error:', err);
    }
  }, []);

  /**
   * Check if user has specific role
   */
  const hasRole = useCallback((role: string): boolean => {
    return user?.roles?.includes(role) ?? false;
  }, [user]);

  /**
   * Check if user is admin
   */
  const isAdmin = user?.roles?.includes('admin') ?? false;

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    refreshToken,
    hasRole,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth hook
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Protected route wrapper component
 */
export function RequireAuth({ 
  children, 
  role,
  fallback,
}: { 
  children: ReactNode;
  role?: string;
  fallback?: ReactNode;
}) {
  const { isAuthenticated, isLoading, hasRole, login } = useAuth();
  
  if (isLoading) {
    return fallback || <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    // Redirect to login
    login(window.location.pathname);
    return fallback || <div>Redirecting to login...</div>;
  }
  
  if (role && !hasRole(role)) {
    return <div>Access denied. Required role: {role}</div>;
  }
  
  return <>{children}</>;
}

/**
 * Hook for fetching with auth
 */
export function useAuthFetch() {
  const { isAuthenticated } = useAuth();
  
  const authFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = getStoredToken();
    
    const headers: HeadersInit = {
      ...options.headers,
    };
    
    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
    
    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  }, []);
  
  return { authFetch, isAuthenticated };
}

export default useAuth;
