import { Feather } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';
import { useColors } from '@/hooks/useColors';
import type { FinancialProfile } from '@workspace/api-client-react';

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
  const { session, signOut, deleteAccount, updateProfile, updateProfileImage } = useAuth();
  const { user } = useUser();
  const { profiles, activeProfile, switchProfile, createProfile, updateProfile: updateBusinessProfile, deleteProfile } = useFinancialProfiles();
  const name = session?.name || 'Usuário';
  const email = session?.email || 'E-mail não informado';
  const isBusinessProfile = activeProfile?.type === 'business';
  const displayedProfileName = isBusinessProfile ? activeProfile.businessName || 'Empresarial' : name;
  const displayedImage = isBusinessProfile ? activeProfile.imageData : user?.imageUrl;
  const initials = useMemo(() => getInitials(displayedProfileName, email), [displayedProfileName, email]);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileName, setProfileName] = useState(name);
  const [savingProfile, setSavingProfile] = useState(false);
  const [switchingProfile, setSwitchingProfile] = useState(false);
  const [deletingBusinessProfile, setDeletingBusinessProfile] = useState(false);
  const [deleteBusinessProfileModalOpen, setDeleteBusinessProfileModalOpen] = useState(false);
  const [businessEditorOpen, setBusinessEditorOpen] = useState(false);
  const [businessProfileBeingEdited, setBusinessProfileBeingEdited] = useState<FinancialProfile | null>(null);
  const [businessNameInput, setBusinessNameInput] = useState('');
  const [businessImageData, setBusinessImageData] = useState<string | null>(null);
  const [savingBusinessProfile, setSavingBusinessProfile] = useState(false);

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
    } catch {
      setDeletingAccount(false);
      throw new Error('Não foi possível excluir a conta.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteBusinessProfile = async () => {
    if (!activeProfile || activeProfile.type !== 'business') return;

    setDeletingBusinessProfile(true);
    try {
      await deleteProfile(activeProfile.id);
    } catch {
      throw new Error('Não foi possível excluir o perfil empresarial.');
    } finally {
      setDeletingBusinessProfile(false);
    }
  };

  const handlePickProfileImage = async () => {
    if (!user) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        quality: 0.8,
      });
      const imageAsset = result.assets?.[0];
      const imageBase64 = imageAsset?.base64;
      if (result.canceled || !imageBase64) return;

      setSavingProfile(true);
      await updateProfileImage(imageBase64, imageAsset.mimeType ?? 'image/jpeg');
    } catch (error) {
      console.error('[ProfileDetails] Falha ao alterar a foto do perfil', error);
      Alert.alert('Não foi possível alterar a foto', getClerkErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const openBusinessEditor = (profile?: FinancialProfile) => {
    setBusinessProfileBeingEdited(profile ?? null);
    setBusinessNameInput(profile?.businessName ?? '');
    setBusinessImageData(profile?.imageData ?? null);
    setBusinessEditorOpen(true);
  };

  const handlePickBusinessImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        base64: true,
        quality: 0.7,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.base64) return;
      setBusinessImageData(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
    } catch {
      Alert.alert('Não foi possível adicionar a imagem', 'Escolha outra imagem e tente novamente.');
    }
  };

  const resetBusinessEditor = () => {
    setBusinessEditorOpen(false);
    setBusinessProfileBeingEdited(null);
    setBusinessNameInput('');
    setBusinessImageData(null);
  };

  const cancelBusinessEditor = () => {
    if (savingBusinessProfile) return;
    resetBusinessEditor();
  };

  const handleSaveBusinessProfile = async () => {
    const trimmedName = businessNameInput.trim();
    if (!trimmedName) {
      Alert.alert('Nome obrigatório', 'Informe o nome da empresa.');
      return;
    }
    try {
      setSavingBusinessProfile(true);
      if (businessProfileBeingEdited) {
        await updateBusinessProfile(businessProfileBeingEdited.id, {
          businessName: trimmedName,
          imageData: businessImageData,
        });
      } else {
        await createProfile({
          type: 'business',
          businessName: trimmedName,
          imageData: businessImageData,
        });
      }
      resetBusinessEditor();
    } catch {
      Alert.alert(
        businessProfileBeingEdited ? 'Não foi possível salvar o perfil' : 'Não foi possível criar o perfil',
        'Tente novamente.',
      );
    } finally {
      setSavingBusinessProfile(false);
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
            accessibilityRole={isBusinessProfile ? undefined : 'button'}
            accessibilityLabel={isBusinessProfile ? undefined : 'Alterar foto do perfil'}
            disabled={isBusinessProfile || savingProfile}
            onPress={() => void handlePickProfileImage()}
            style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
          >
            {displayedImage ? (
              <Image source={{ uri: displayedImage }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={[styles.avatarText, { color: colors.accentForeground }]}>{initials}</Text>
              </View>
            )}
            {!isBusinessProfile ? (
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                <Feather name="camera" size={11} color={colors.primaryForeground} />
              </View>
            ) : null}
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
              <Text style={[styles.name, { color: colors.foreground }]}>{displayedProfileName}</Text>
            )}
            <Text style={[styles.email, { color: colors.mutedForeground }]}>{isBusinessProfile ? 'Perfil empresarial' : email}</Text>
            <View style={[styles.status, { backgroundColor: colors.paidSoft }]}>
              <View style={[styles.statusDot, { backgroundColor: colors.paid }]} />
              <Text style={[styles.statusText, { color: colors.paid }]}>Conta ativa</Text>
            </View>
          </View>
        </View>
        {editingProfile && !isBusinessProfile ? (
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
        ) : !isBusinessProfile ? (
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
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Perfil financeiro</Text>
        <View style={[styles.profileSelector, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.selectorDescription, { color: colors.mutedForeground }]}>
            Separe suas finanças pessoais das operações do negócio.
          </Text>
          {profiles.map((profile) => (
            <Pressable
              key={profile.id}
              accessibilityRole="button"
              accessibilityState={{ selected: profile.id === activeProfile?.id }}
              disabled={switchingProfile}
              onPress={() => {
                if (profile.id === activeProfile?.id) return;
                setSwitchingProfile(true);
                void switchProfile(profile.id).finally(() => setSwitchingProfile(false));
              }}
              style={({ pressed }) => [
                styles.profileOption,
                { borderColor: profile.id === activeProfile?.id ? colors.primary : colors.border, backgroundColor: profile.id === activeProfile?.id ? colors.secondary : colors.card },
                pressed && styles.pressed,
              ]}
            >
              {(profile.type === 'business' ? profile.imageData : user?.imageUrl) ? (
                <Image
                  source={{ uri: profile.type === 'business' ? profile.imageData! : user!.imageUrl }}
                  style={styles.profileOptionImage}
                />
              ) : (
                <Feather name={profile.type === 'business' ? 'briefcase' : 'user'} size={16} color={colors.foreground} />
              )}
              <View style={styles.profileOptionCopy}>
                <Text style={[styles.profileOptionName, { color: colors.foreground }]}>
                  {profile.type === 'business' ? profile.businessName || 'Empresarial' : name}
                </Text>
                <Text style={[styles.profileOptionType, { color: colors.mutedForeground }]}>
                  {profile.type === 'business' ? 'Empresarial' : 'Pessoal'}
                </Text>
              </View>
              {profile.id === activeProfile?.id ? <Feather name="check" size={17} color={colors.primary} /> : null}
            </Pressable>
          ))}
          {!profiles.some((profile) => profile.type === 'business') ? (
            <Pressable
              accessibilityRole="button"
              disabled={switchingProfile}
              onPress={() => openBusinessEditor()}
              style={({ pressed }) => [styles.addProfileButton, { borderColor: colors.border }, pressed && styles.pressed]}
            >
              <Feather name="plus" size={16} color={colors.foreground} />
              <Text style={[styles.addProfileText, { color: colors.foreground }]}>Adicionar perfil empresarial</Text>
            </Pressable>
          ) : null}
          <Text style={[styles.profileDisclaimer, { color: colors.mutedForeground }]}>
            O perfil empresarial é para controle operacional e não substitui ERP, sistema comercial ou sistema contábil.
          </Text>
          {activeProfile?.type === 'business' ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Editar perfil empresarial"
                testID="profile-edit-business-button"
                disabled={switchingProfile || deletingBusinessProfile || savingBusinessProfile}
                onPress={() => openBusinessEditor(activeProfile)}
                style={({ pressed }) => [
                  styles.editBusinessProfileButton,
                  { borderColor: colors.border },
                  (switchingProfile || deletingBusinessProfile || savingBusinessProfile) && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Feather name="edit-2" size={15} color={colors.foreground} />
                <Text style={[styles.editBusinessProfileText, { color: colors.foreground }]}>Editar perfil empresarial</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Excluir perfil empresarial"
                testID="profile-delete-business-button"
                disabled={switchingProfile || deletingBusinessProfile}
                onPress={() => setDeleteBusinessProfileModalOpen(true)}
                style={({ pressed }) => [
                  styles.deleteBusinessProfileButton,
                  { borderColor: colors.expense },
                  (switchingProfile || deletingBusinessProfile) && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Feather name="trash-2" size={15} color={colors.expense} />
                <Text style={[styles.deleteBusinessProfileText, { color: colors.expense }]}>
                  {deletingBusinessProfile ? 'Excluindo perfil...' : 'Excluir perfil empresarial'}
                </Text>
              </Pressable>
            </>
          ) : null}
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
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
          testID="profile-sign-out-button"
          disabled={deletingAccount}
          onPress={() => Alert.alert(
            'Sair da conta',
            'Você será desconectado deste dispositivo.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
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
            Remove o perfil, carteiras e lançamentos do ambiente ativo. Registros mínimos de segurança e backups podem permanecer pelos prazos informados na Política de Privacidade. Essa ação não pode ser desfeita.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Excluir conta permanentemente"
            testID="profile-delete-account-button"
            disabled={deletingAccount}
            onPress={() => setDeleteAccountModalOpen(true)}
            style={({ pressed }) => [
              styles.deleteButton,
              { backgroundColor: colors.expense, borderColor: colors.expense },
              deletingAccount && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="trash-2" size={16} color={colors.destructiveForeground} />
            <Text style={[styles.deleteButtonText, { color: colors.destructiveForeground }]}>
              {deletingAccount ? 'Excluindo conta...' : 'Excluir conta'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <ConfirmationModal
        visible={deleteAccountModalOpen}
        title="Excluir conta permanentemente?"
         message="Seus dados financeiros serão removidos do ambiente ativo. Registros mínimos de segurança e backups podem permanecer pelo prazo necessário, conforme a Política de Privacidade. Você não poderá recuperar esta conta."
        confirmLabel="Excluir conta"
        onConfirm={handleDeleteAccount}
        onClose={() => setDeleteAccountModalOpen(false)}
        errorTitle="Não foi possível excluir a conta"
        errorMessage="Sua conta não foi excluída. Tente novamente."
      />
      <ConfirmationModal
        visible={deleteBusinessProfileModalOpen}
        title="Excluir perfil empresarial?"
        message="As carteiras, lançamentos, categorias, limites, metas e cartões desse perfil serão removidos permanentemente. O perfil pessoal não será afetado."
        confirmLabel="Excluir perfil"
        onConfirm={handleDeleteBusinessProfile}
        onClose={() => setDeleteBusinessProfileModalOpen(false)}
        errorTitle="Não foi possível excluir o perfil"
        errorMessage="O perfil empresarial não foi excluído. Tente novamente."
      />
      <Modal animationType="fade" transparent visible={businessEditorOpen} onRequestClose={cancelBusinessEditor}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cancelBusinessEditor} />
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={[styles.modalEyebrow, { color: colors.mutedForeground }]}>{businessProfileBeingEdited ? 'Editar perfil' : 'Novo perfil'}</Text>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>{businessProfileBeingEdited ? 'Editar perfil empresarial' : 'Perfil empresarial'}</Text>
              </View>
              <Pressable accessibilityLabel="Fechar edição de perfil empresarial" onPress={cancelBusinessEditor} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            <Text style={[styles.modalDescription, { color: colors.mutedForeground }]}>O nome e a imagem ficam separados do seu perfil pessoal.</Text>
            <Text style={[styles.modalLabel, { color: colors.foreground }]}>Nome da empresa</Text>
            <TextInput
              accessibilityLabel="Nome da empresa"
              testID="business-profile-name-input"
              autoCapitalize="words"
              placeholder="Ex.: Estúdio Aurora"
              placeholderTextColor={colors.mutedForeground}
              value={businessNameInput}
              onChangeText={setBusinessNameInput}
              style={[styles.modalInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={businessImageData ? 'Trocar imagem da empresa' : 'Adicionar imagem da empresa'}
              onPress={() => void handlePickBusinessImage()}
              style={({ pressed }) => [styles.businessImagePicker, { borderColor: colors.border, backgroundColor: colors.secondary }, pressed && styles.pressed]}
            >
              {businessImageData ? <Image source={{ uri: businessImageData }} style={styles.businessImagePreview} /> : <Feather name="camera" size={18} color={colors.mutedForeground} />}
              <Text style={[styles.businessImageText, { color: colors.foreground }]}>{businessImageData ? 'Trocar imagem' : 'Adicionar imagem da empresa'}</Text>
            </Pressable>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={savingBusinessProfile}
                onPress={cancelBusinessEditor}
                style={({ pressed }) => [styles.profileCancelButton, { borderColor: colors.border }, savingBusinessProfile && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.profileCancelText, { color: colors.foreground }]}>Cancelar criação</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="business-profile-save-button"
                disabled={savingBusinessProfile}
                onPress={() => void handleSaveBusinessProfile()}
                style={({ pressed }) => [styles.profileSaveButton, { backgroundColor: colors.primary }, savingBusinessProfile && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.profileSaveText, { color: colors.primaryForeground }]}>
                  {savingBusinessProfile ? 'Salvando...' : businessProfileBeingEdited ? 'Salvar alterações' : 'Criar perfil'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  profileSelector: { borderWidth: 1, borderRadius: 9, padding: 12, gap: 8 },
  selectorDescription: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  profileOption: { minHeight: 52, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  profileOptionImage: { width: 30, height: 30, borderRadius: 7 },
  profileOptionCopy: { flex: 1 },
  profileOptionName: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  profileOptionType: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addProfileButton: { minHeight: 42, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 2 },
  addProfileText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  profileDisclaimer: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 4 },
  deleteBusinessProfileButton: { minHeight: 40, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  deleteBusinessProfileText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  editBusinessProfileButton: { minHeight: 40, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  editBusinessProfileText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  profileCancelButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  profileSaveButton: { flex: 1, minHeight: 42, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  profileCancelText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  profileSaveText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  modalCard: { width: '100%', maxWidth: 390, borderRadius: 10, borderWidth: 1, padding: 15 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  modalHeaderCopy: { flex: 1, minWidth: 0 },
  modalEyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.1, textTransform: 'uppercase' },
  modalTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 4 },
  modalDescription: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 10 },
  modalLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 16, marginBottom: 7 },
  modalInput: { minHeight: 45, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 13, fontFamily: 'Inter_400Regular' },
  businessImagePicker: { minHeight: 50, borderWidth: 1, borderRadius: 8, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 11 },
  businessImagePreview: { width: 34, height: 34, borderRadius: 6 },
  businessImageText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  closeButton: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
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