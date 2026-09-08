import { Feather } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || 'U';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const name = session?.name || 'Usuário';
  const email = session?.email || 'E-mail não informado';
  const initials = useMemo(() => getInitials(name, email), [email, name]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Conta" title="Seu perfil" />

        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={[styles.avatarText, { color: colors.accentForeground }]}>{initials}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
            <Text style={[styles.email, { color: colors.mutedForeground }]}>{email}</Text>
            <View style={[styles.status, { backgroundColor: colors.paidSoft }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.paid }]} />
              <Text style={[styles.statusText, { color: colors.paid }]}>Conta ativa</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Informações da conta</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="mail" size={16} color={colors.foreground} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>E-mail</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{email}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <View style={[styles.infoIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="shield" size={16} color={colors.foreground} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Identificador da conta</Text>
              <Text numberOfLines={1} style={[styles.infoValue, { color: colors.foreground }]}>{session?.userId || 'Não disponível'}</Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          testID="profile-sign-out-button"
          onPress={() => void signOut()}
          style={({ pressed }) => [
            styles.signOutButton,
            { backgroundColor: colors.expenseSoft, borderColor: colors.expense },
            pressed && styles.pressed,
          ]}
        >
          <Feather name="log-out" size={17} color={colors.expense} />
          <Text style={[styles.signOutText, { color: colors.expense }]}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  profileCard: { borderWidth: 1, borderRadius: 9, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  email: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 3 },
  status: { alignSelf: 'flex-start', borderRadius: 5, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 9, paddingHorizontal: 7, paddingVertical: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, marginTop: 24, marginBottom: 8, textTransform: 'uppercase' },
  infoCard: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13 },
  infoRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11 },
  infoIcon: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1, minWidth: 0 },
  infoLabel: { fontSize: 10, fontFamily: 'Inter_500Medium', marginBottom: 3 },
  infoValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  divider: { height: 1 },
  signOutButton: { minHeight: 48, borderRadius: 8, borderWidth: 1, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  pressed: { opacity: 0.72 },
});