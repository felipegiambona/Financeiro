import { Feather } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || 'U';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length > 1) return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function getClerkErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Tente novamente.';

  const clerkError = error as {
    errors?: Array<{ longMessage?: string; message?: string }>;
    message?: string;
  };
  const message = clerkError.errors?.[0]?.longMessage
    ?? clerkError.errors?.[0]?.message
    ?? clerkError.message;

  return message || 'Tente novamente.';
}

export function ProfileDetails({ showBack = false }: { showBack?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session, signOut, deleteAccount, updateProfile } = useAuth();
  const { user } = useUser();
  const {
    clearPendingNotifications,
    notificationAccessEnabled,
    notificationImportEnabled,
    notificationListenerAvailable,
    openNotificationSettings,
    refreshNotificationAccess,
    setNotificationImportEnabled,
  } = useFinance();
  const name = session?.name || 'Usuário';
  const email = session?.email || 'E-mail não informado';
  const initials = useMemo(() => getInitials(name, email), [email, name]);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(name);
  const [savingProfile, setSavingProfile] = useState(false);

  useFocusEffect(useCallback(() => {
    void refreshNotificationAccess();
  }, [refreshNotificationAccess]));

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!enabled) {
      await setNotificationImportEnabled(false);
      return;
    }
    if (!notificationAccessEnabled) {
      await setNotificationImportEnabled(true);
      await openNotificationSettings();
      return;
    }
    await setNotificationImportEnabled(true);
  };

  const handleSignOut = async () => {
    await clearPendingNotifications();
    await signOut();
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      await clearPendingNotifications();
    } catch {
      setDeletingAccount(false);
      Alert.alert('Não foi possível excluir a conta', 'Sua conta não foi excluída. Tente novamente.');
    }
  };

  const handlePickProfileImage = async () => {
    if (!user) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      const imageAsset = result.assets?.[0];
      const imageUri = imageAsset?.uri;
      if (result.canceled || !imageUri) return;

      setSavingProfile(true);
      const imageFile = {
        uri: imageUri,
        name: imageAsset.fileName ?? 'profile-image.jpg',
        type: imageAsset.mimeType ?? 'image/jpeg',
      };
      await user.setProfileImage({ file: imageFile as unknown as Blob });
    } catch (error) {
      console.error('[ProfileDetails] Falha ao alterar a foto do perfil', error);
      Alert.alert('Não foi possível alterar a foto', getClerkErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const trimmedName = profileName.trim();
    if (!trimmedName) {
      Alert.alert('Nome obrigatório', 'Informe um nome para o perfil.');
      return;
    }

    const nameParts = trimmedName.split(/\s+/);
    const firstName = nameParts.shift() ?? trimmedName;
    const lastName = nameParts.join(' ');

    try {
      setSavingProfile(true);
      await updateProfile(firstName, lastName || undefined);
      setEditingProfile(false);
    } catch (error) {
      console.error('[ProfileDetails] Falha ao salvar o perfil', error);
      Alert.alert('Não foi possível salvar o perfil', getClerkErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Conta" title="Perfil" showBack={showBack} />

        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Alterar foto do perfil"
            disabled={savingProfile}
            onPress={() => void handlePickProfileImage()}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={[styles.avatarText, { color: colors.accentForeground }]}>{initials}</Text>
              </View>
            )}
            <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
              <Feather name="camera" size={11} color={colors.primaryForeground} />
            </View>
          </Pressable>
          <View style={styles.profileCopy}>
            {editingProfile ? (
              <TextInput
                accessibilityLabel="Nome do perfil"
                testID="profile-name-input"
                value={profileName}
                onChangeText={setProfileName}
                placeholder="Nome do perfil"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.profileNameInput, { color: colors.foreground, borderColor: colors.input }]}
              />
            ) : (
              <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
            )}
            <Text style={[styles.email, { color: colors.mutedForeground }]}>{email}</Text>
            <View style={[styles.status, { backgroundColor: colors.paidSoft }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.paid }]} />
              <Text style={[styles.statusText, { color: colors.paid }]}>Conta ativa</Text>
            </View>
          </View>
        </View>
        {editingProfile ? (
          <View style={styles.profileActions}>
            <Pressable
              accessibilityRole="button"
              disabled={savingProfile}
              onPress={() => {
                setProfileName(name);
                setEditingProfile(false);
              }}
              style={({ pressed }) => [styles.profileCancelButton, { borderColor: colors.border }, savingProfile && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={[styles.profileCancelText, { color: colors.foreground }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              testID="profile-save-button"
              disabled={savingProfile}
              onPress={() => void handleSaveProfile()}
              style={({ pressed }) => [styles.profileSaveButton, { backgroundColor: colors.primary }, savingProfile && styles.disabled, pressed && styles.pressed]}
            >
              <Text style={[styles.profileSaveText, { color: colors.primaryForeground }]}>
                {savingProfile ? 'Salvando...' : 'Salvar perfil'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Editar perfil"
            testID="profile-edit-button"
            onPress={() => {
              setProfileName(name);
              setEditingProfile(true);
            }}
            style={({ pressed }) => [styles.editProfileButton, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Feather name="edit-2" size={15} color={colors.foreground} />
            <Text style={[styles.editProfileText, { color: colors.foreground }]}>Editar perfil</Text>
          </Pressable>
        )}

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
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Automação</Text>
        <View style={[styles.automationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.automationHeader}>
            <View style={[styles.infoIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="bell" size={16} color={colors.foreground} />
            </View>
            <View style={styles.automationCopy}>
              <Text style={[styles.automationTitle, { color: colors.foreground }]}>Importar por notificações</Text>
              <Text style={[styles.automationDescription, { color: colors.mutedForeground }]}>
                Cria lançamentos pagos quando uma notificação contém um valor e termos de movimentação.
              </Text>
            </View>
            {Platform.OS === 'android' && notificationListenerAvailable ? (
              <Switch
                accessibilityLabel="Importar lançamentos por notificações"
                testID="notification-import-switch"
                value={notificationImportEnabled && notificationAccessEnabled}
                onValueChange={(value) => void handleNotificationToggle(value)}
                trackColor={{ false: colors.secondary, true: colors.primary }}
                thumbColor={colors.foreground}
              />
            ) : null}
          </View>
          {Platform.OS !== 'android' ? (
            <Text style={[styles.automationStatus, { color: colors.mutedForeground }]}>Disponível somente em development build Android.</Text>
          ) : !notificationListenerAvailable ? (
            <Text style={[styles.automationStatus, { color: colors.mutedForeground }]}>Instale uma development build para ativar esta função.</Text>
          ) : (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.automationStatus, { color: notificationAccessEnabled ? colors.paid : colors.expense }]}>
                {notificationAccessEnabled ? 'Acesso às notificações concedido.' : 'Acesso às notificações ainda não concedido.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={notificationAccessEnabled ? 'Revisar acesso às notificações' : 'Conceder acesso às notificações'}
                testID="notification-settings-button"
                onPress={() => void openNotificationSettings()}
                style={({ pressed }) => [styles.automationButton, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Feather name="settings" size={15} color={colors.foreground} />
                <Text style={[styles.automationButtonText, { color: colors.foreground }]}>
                  {notificationAccessEnabled ? 'Revisar acesso' : 'Conceder acesso'}
                </Text>
              </Pressable>
              <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
                O Android exige acesso especial para ler notificações. O app guarda apenas candidatos com valor e não salva o texto completo da notificação.
              </Text>
            </>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          testID="profile-sign-out-button"
          disabled={deletingAccount}
          onPress={() => Alert.alert(
            'Sair da conta',
            'As notificações pendentes deste dispositivo serão descartadas.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: () => void handleSignOut() },
            ],
          )}
          style={({ pressed }) => [styles.signOutButton, { backgroundColor: colors.expenseSoft, borderColor: colors.expense }, pressed && styles.pressed]}
        >
          <Feather name="log-out" size={17} color={colors.expense} />
          <Text style={[styles.signOutText, { color: colors.expense }]}>Sair da conta</Text>
        </Pressable>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Zona de perigo</Text>
        <View style={[styles.deleteCard, { backgroundColor: colors.card, borderColor: colors.expense }]}>
          <Text style={[styles.deleteTitle, { color: colors.foreground }]}>Excluir conta</Text>
          <Text style={[styles.deleteDescription, { color: colors.mutedForeground }]}>
            Remove permanentemente seu perfil, carteiras e lançamentos. Essa ação não pode ser desfeita.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Excluir conta permanentemente"
            testID="profile-delete-account-button"
            disabled={deletingAccount}
            onPress={() => Alert.alert(
              'Excluir conta permanentemente?',
              'Todos os seus dados financeiros serão removidos e você não poderá recuperar esta conta.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Excluir conta', style: 'destructive', onPress: () => void handleDeleteAccount() },
              ],
            )}
            style={({ pressed }) => [
              styles.deleteButton,
              { backgroundColor: colors.expense, borderColor: colors.expense },
              deletingAccount && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="trash-2" size={16} color={colors.primaryForeground} />
            <Text style={[styles.deleteButtonText, { color: colors.primaryForeground }]}>
              {deletingAccount ? 'Excluindo conta...' : 'Excluir conta'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  profileCard: { borderWidth: 1, borderRadius: 9, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatarButton: { width: 58, height: 58, position: 'relative' },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  avatarEditBadge: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  profileNameInput: { minHeight: 36, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 0, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
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
  editProfileButton: { minHeight: 42, borderWidth: 1, borderRadius: 7, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  editProfileText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  profileActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  profileCancelButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  profileSaveButton: { flex: 1, minHeight: 42, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  profileCancelText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  profileSaveText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  automationCard: { borderWidth: 1, borderRadius: 9, padding: 13 },
  automationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  automationCopy: { flex: 1, minWidth: 0 },
  automationTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  automationDescription: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 4 },
  automationStatus: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_500Medium', marginTop: 10 },
  automationButton: { minHeight: 40, borderWidth: 1, borderRadius: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 },
  automationButtonText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  privacyNote: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular', marginTop: 10 },
  signOutButton: { minHeight: 48, borderRadius: 8, borderWidth: 1, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  deleteCard: { borderWidth: 1, borderRadius: 9, padding: 13 },
  deleteTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  deleteDescription: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 5 },
  deleteButton: { minHeight: 42, borderRadius: 7, borderWidth: 1, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  deleteButtonText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});