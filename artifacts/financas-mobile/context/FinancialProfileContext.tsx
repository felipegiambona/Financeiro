import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createFinancialProfile,
  deleteFinancialProfile,
  listFinancialProfiles,
  setFinancialProfileId,
  updateFinancialProfile,
  type FinancialProfile,
} from '@workspace/api-client-react';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

interface FinancialProfileContextValue {
  profiles: FinancialProfile[];
  activeProfile: FinancialProfile | null;
  loading: boolean;
  switchProfile: (profileId: string) => Promise<void>;
  createProfile: (input: { type: 'business'; name: string; businessName: string; imageData?: string | null }, options?: { activate?: boolean }) => Promise<FinancialProfile>;
  updateProfile: (profileId: string, input: { businessName?: string; imageData?: string | null }) => Promise<FinancialProfile>;
  deleteProfile: (profileId: string) => Promise<void>;
}

const FinancialProfileContext = createContext<FinancialProfileContextValue | null>(null);

export function FinancialProfileProvider({ children }: React.PropsWithChildren) {
  const colors = useColors();
  const { session } = useAuth();
  const [profiles, setProfiles] = useState<FinancialProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<FinancialProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const selectProfile = useCallback(async (nextProfiles: FinancialProfile[]) => {
    if (!session?.userId) return;
    if (nextProfiles.length === 0) {
      setFinancialProfileId(undefined);
      setProfiles([]);
      setActiveProfile(null);
      return;
    }
    const storedId = await AsyncStorage.getItem(`financas-mobile:financial-profile:${session.userId}`);
    const selected = nextProfiles.find((profile) => profile.id === storedId)
      ?? nextProfiles.find((profile) => profile.type === 'personal')
      ?? nextProfiles[0];
    setFinancialProfileId(selected.id);
    setProfiles(nextProfiles);
    setActiveProfile(selected);
  }, [session?.userId]);

  useEffect(() => {
    if (!session?.userId) {
      setFinancialProfileId(undefined);
      setProfiles([]);
      setActiveProfile(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    void listFinancialProfiles()
      .then(async (items) => {
        if (mounted) await selectProfile(items);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [selectProfile, session?.userId]);

  const switchProfile = useCallback(async (profileId: string) => {
    const selected = profiles.find((profile) => profile.id === profileId);
    if (!selected || !session?.userId) return;
    await AsyncStorage.setItem(`financas-mobile:financial-profile:${session.userId}`, selected.id);
    setFinancialProfileId(selected.id);
    setActiveProfile(selected);
  }, [profiles, session?.userId]);

  const createProfile = useCallback(async (
    input: { type: 'business'; name: string; businessName: string; imageData?: string | null },
    options: { activate?: boolean } = {},
  ) => {
    const created = await createFinancialProfile(input);
    setProfiles((current) => [...current, created]);
    if (options.activate !== false) {
      if (session?.userId) {
        await AsyncStorage.setItem(`financas-mobile:financial-profile:${session.userId}`, created.id);
      }
      setFinancialProfileId(created.id);
      setActiveProfile(created);
    }
    return created;
  }, [session?.userId]);

  const updateProfile = useCallback(async (
    profileId: string,
    input: { businessName?: string; imageData?: string | null },
  ) => {
    const current = profiles.find((profile) => profile.id === profileId);
    if (!current || current.type !== 'business') {
      throw new Error('Apenas o perfil empresarial pode ser atualizado.');
    }

    const updated = await updateFinancialProfile(profileId, input);
    setProfiles((items) => items.map((profile) => profile.id === profileId ? updated : profile));
    if (activeProfile?.id === profileId) {
      setActiveProfile(updated);
    }
    return updated;
  }, [activeProfile?.id, profiles]);

  const deleteProfile = useCallback(async (profileId: string) => {
    const deletedProfile = profiles.find((profile) => profile.id === profileId);
    if (!deletedProfile || deletedProfile.type !== 'business') {
      throw new Error('Apenas o perfil empresarial pode ser excluído.');
    }

    await deleteFinancialProfile(profileId);
    const remainingProfiles = profiles.filter((profile) => profile.id !== profileId);
    const activeProfileWasDeleted = activeProfile?.id === profileId;
    const nextProfile = activeProfileWasDeleted
      ? remainingProfiles.find((profile) => profile.type === 'personal') ?? remainingProfiles[0] ?? null
      : activeProfile;

    setProfiles(remainingProfiles);
    if (!activeProfileWasDeleted) return;

    if (nextProfile && session?.userId) {
      await AsyncStorage.setItem(`financas-mobile:financial-profile:${session.userId}`, nextProfile.id);
      setFinancialProfileId(nextProfile.id);
      setActiveProfile(nextProfile);
      return;
    }

    if (session?.userId) {
      await AsyncStorage.removeItem(`financas-mobile:financial-profile:${session.userId}`);
    }
    setFinancialProfileId(undefined);
    setActiveProfile(null);
  }, [activeProfile, profiles, session?.userId]);

  const value = useMemo(
    () => ({ profiles, activeProfile, loading, switchProfile, createProfile, updateProfile, deleteProfile }),
    [activeProfile, createProfile, deleteProfile, loading, profiles, switchProfile, updateProfile],
  );

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  }
  return <FinancialProfileContext.Provider value={value}>{children}</FinancialProfileContext.Provider>;
}

export function useFinancialProfiles(): FinancialProfileContextValue {
  const context = useContext(FinancialProfileContext);
  if (!context) throw new Error('useFinancialProfiles deve ser usado dentro de FinancialProfileProvider.');
  return context;
}