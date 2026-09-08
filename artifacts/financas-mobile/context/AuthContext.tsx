import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/expo';
import { setAuthTokenGetter } from '@workspace/api-client-react';

interface AuthSession {
  userId: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const { isLoaded, isSignedIn, userId, getToken } = useClerkAuth();
  const { user } = useUser();
  const { signOut: clerkSignOut } = useClerk();

  // Register synchronously so child providers cannot issue their first request
  // before the Clerk token getter is available.
  setAuthTokenGetter(isSignedIn ? () => getToken() : null);

  useEffect(() => {
    return () => setAuthTokenGetter(null);
  }, []);

  const signOut = useCallback(async () => {
    setAuthTokenGetter(null);
    await clerkSignOut();
  }, [clerkSignOut]);

  const session = isSignedIn && userId
    ? {
        userId,
        email: user?.primaryEmailAddress?.emailAddress ?? '',
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || '',
      }
    : null;
  const value = useMemo(
    () => ({ session, loading: !isLoaded, signOut }),
    [isLoaded, session?.email, session?.name, session?.userId, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}