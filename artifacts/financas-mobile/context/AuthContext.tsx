import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/expo';
import {
  deleteAccount as deleteAccountRequest,
  setAuthTokenGetter,
  updateAccountProfile,
  updateAccountProfileImage,
} from '@workspace/api-client-react';

interface AuthSession {
  userId: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  session: AuthSession | null;
  loading: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateProfile: (firstName: string, lastName?: string) => Promise<void>;
  updateProfileImage: (imageBase64: string, mimeType: string) => Promise<void>;
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

  const deleteAccount = useCallback(async () => {
    await deleteAccountRequest();
    setAuthTokenGetter(null);
    await clerkSignOut().catch(() => undefined);
  }, [clerkSignOut]);

  const updateProfile = useCallback(async (firstName: string, lastName?: string) => {
    await updateAccountProfile({
      firstName,
      ...(lastName ? { lastName } : {}),
    });
    try {
      await user?.reload();
    } catch {
      // The profile was already updated on the server; refreshing the local
      // Clerk resource is best effort and should not turn success into an error.
    }
  }, [user]);

  const updateProfileImage = useCallback(async (imageBase64: string, mimeType: string) => {
    await updateAccountProfileImage({ data: imageBase64, mimeType });
    try {
      await user?.reload();
    } catch {
      // The profile image was already updated on the server; refresh is best effort.
    }
  }, [user]);

  const session = isSignedIn && userId
    ? {
        userId,
        email: user?.primaryEmailAddress?.emailAddress ?? '',
        name: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || '',
      }
    : null;
  const value = useMemo(
    () => ({ session, loading: !isLoaded, signOut, deleteAccount, updateProfile, updateProfileImage }),
    [deleteAccount, isLoaded, session?.email, session?.name, session?.userId, signOut, updateProfile, updateProfileImage],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
}