/**
 * Transactional Auth Next - Client Provider
 */

'use client';

import * as React from 'react';
import type { TransactionalAuthUser, Session } from '../types';

interface AuthContextValue {
  user: TransactionalAuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (returnTo?: string) => void;
  logout: (returnTo?: string) => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export interface TransactionalAuthProviderProps {
  children: React.ReactNode;
  /** Initial session from server (optional) */
  initialSession?: { user: TransactionalAuthUser; expiresAt: number } | null;
}

/**
 * Client-side auth provider for Next.js.
 *
 * @example
 * ```tsx
 * // app/layout.tsx
 * import { TransactionalAuthProvider } from '@usetransactional/auth-next/client';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <TransactionalAuthProvider>
 *           {children}
 *         </TransactionalAuthProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export function TransactionalAuthProvider({
  children,
  initialSession,
}: TransactionalAuthProviderProps) {
  const [user, setUser] = React.useState<TransactionalAuthUser | null>(
    initialSession?.user || null
  );
  const [isLoading, setIsLoading] = React.useState(!initialSession);

  // Fetch session on mount if not provided
  React.useEffect(() => {
    if (!initialSession) {
      fetchSession();
    }
  }, [initialSession]);

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/session');
      const data = await response.json();
      setUser(data.session?.user || null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = (returnTo?: string) => {
    const url = new URL('/api/auth/login', window.location.origin);
    if (returnTo) {
      url.searchParams.set('returnTo', returnTo);
    }
    window.location.href = url.toString();
  };

  const logout = (returnTo?: string) => {
    const url = new URL('/api/auth/logout', window.location.origin);
    if (returnTo) {
      url.searchParams.set('returnTo', returnTo);
    }
    window.location.href = url.toString();
  };

  const refreshSession = async () => {
    await fetchSession();
  };

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth state and methods in Client Components.
 *
 * @example
 * ```tsx
 * 'use client';
 * import { useAuth } from '@usetransactional/auth-next/client';
 *
 * export function LoginButton() {
 *   const { user, isLoading, login, logout } = useAuth();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   if (user) {
 *     return <button onClick={() => logout()}>Logout</button>;
 *   }
 *
 *   return <button onClick={() => login()}>Login</button>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a TransactionalAuthProvider');
  }
  return context;
}

/**
 * Hook to get the current user in Client Components.
 */
export function useUser(): { user: TransactionalAuthUser | null; isLoading: boolean } {
  const { user, isLoading } = useAuth();
  return { user, isLoading };
}
