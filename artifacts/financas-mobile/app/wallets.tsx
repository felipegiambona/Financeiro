import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ErrorState, EmptyState, LoadingState } from '@/components/StateView';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';
import { useWallets } from '@/context/WalletContext';
import { calculateWalletTotals } from '@/services/financialRules';
import {
  WALLET_ICON_OPTIONS,
  type Wallet,
  type WalletIcon,
} from '@/types/wallet';
import { formatAmountInput, formatAmountValue, formatCurrency, parseAmountInput } from '@/utils/currency';

interface WalletForm {
  title: string;
  initialBalance: string;
  icon: WalletIcon;
}

const EMPTY_FORM: WalletForm = {
  title: '',
  initialBalance: '0,00',
  icon: 'wallet-outline',
};

function iconLabel(icon: WalletIcon): string {
  return WALLET_ICON_OPTIONS.find((option) => option.icon === icon)?.label ?? 'Carteira';
}

function WalletIconView({ icon, size = 21, color }: { icon: WalletIcon; size?: number; color: string }) {
  return <MaterialCommunityIcons name={icon} size={size} color={color} />;
}

export default function WalletsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { wallets, loading, error, refresh, createWallet, updateWallet, deleteWallet } = useWallets();
  const { transactions, loading: transactionsLoading } = useFinance();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null);
  const [form, setForm] = useState<WalletForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const editingWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === editingWalletId),
    [editingWalletId, wallets],
  );
  const walletTotals = useMemo(
    () => calculateWalletTotals(wallets, transactions),
    [transactions, wallets],
  );

  const openCreate = () => {
    setEditingWalletId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (wallet: Wallet) => {
    setEditingWalletId(wallet.id);
    setForm({
      title: wallet.title,
      initialBalance: formatAmountValue(wallet.initialBalance),
      icon: wallet.icon,
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditingWalletId(null);
  };

  const handleSave = async () => {
    const title = form.title.trim();
    const initialBalance = form.initialBalance.trim() ? parseAmountInput(form.initialBalance) : 0;
    if (!title) {
      Alert.alert('Título obrigatório', 'Informe um título para a carteira.');
      return;
    }
    if (!Number.isFinite(initialBalance) || initialBalance < 0) {
      Alert.alert('Saldo inválido', 'Informe um saldo inicial igual ou maior que zero.');
      return;
    }

    try {
      setSaving(true);
      if (editingWalletId) {
        await updateWallet(editingWalletId, { title, initialBalance, icon: form.icon });
      } else {
        await createWallet({ title, initialBalance, icon: form.icon });
      }
      setModalVisible(false);
      setEditingWalletId(null);
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (wallet: Wallet) => {
    Alert.alert(
      'Excluir carteira?',
      `A carteira "${wallet.title}" será excluída permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void deleteWallet(wallet.id).catch(() => {
              Alert.alert('Não foi possível excluir', 'Tente novamente.');
            });
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        refreshControl={undefined}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Conta"
          title="Carteiras"
          showBack
          actionLabel="Nova"
          actionIcon="plus"
          onAction={openCreate}
        />
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Organize suas contas e acompanhe de onde vem cada saldo.
        </Text>
        {loading || transactionsLoading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : wallets.length === 0 ? (
          <EmptyState message="Nenhuma carteira cadastrada." />
        ) : (
          <View style={styles.walletList}>
            {walletTotals.map(({ wallet, total }) => (
              <View key={wallet.id} style={[styles.walletCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.walletIcon, { backgroundColor: colors.secondary }]}>
                  <WalletIconView icon={wallet.icon} color={colors.foreground} />
                </View>
                <View style={styles.walletCopy}>
                  <Text numberOfLines={1} style={[styles.walletTitle, { color: colors.foreground }]}>{wallet.title}</Text>
                  <Text style={[styles.walletType, { color: colors.mutedForeground }]}>{iconLabel(wallet.icon)}</Text>
                  <Text style={[styles.walletBalance, { color: total >= 0 ? colors.income : colors.expense }]}>{formatCurrency(total)}</Text>
                </View>
                <View style={styles.walletActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${wallet.title}`}
                    testID={`edit-wallet-${wallet.id}`}
                    onPress={() => openEdit(wallet)}
                    style={({ pressed }) => [styles.iconButton, { borderColor: colors.border }, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.foreground} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Excluir ${wallet.title}`}
                    testID={`delete-wallet-${wallet.id}`}
                    onPress={() => confirmDelete(wallet)}
                    style={({ pressed }) => [styles.iconButton, { borderColor: colors.border }, pressed && styles.pressed]}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.expense} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Fechar formulário" onPress={closeModal} style={StyleSheet.absoluteFill} />
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalEyebrow, { color: colors.mutedForeground }]}>Carteiras</Text>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {editingWallet ? 'Editar carteira' : 'Nova carteira'}
                </Text>
              </View>
              <Pressable accessibilityLabel="Fechar" onPress={closeModal} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="close" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Título</Text>
            <TextInput
              accessibilityLabel="Título da carteira"
              testID="wallet-title-input"
              autoCapitalize="sentences"
              placeholder="Ex.: Conta principal"
              placeholderTextColor={colors.mutedForeground}
              value={form.title}
              onChangeText={(title) => setForm((current) => ({ ...current, title }))}
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
            />

            <Text style={[styles.label, { color: colors.foreground }]}>Saldo inicial</Text>
            <View style={[styles.amountShell, { backgroundColor: colors.background, borderColor: colors.input }]}>
              <Text style={[styles.currencyPrefix, { color: colors.mutedForeground }]}>R$</Text>
              <TextInput
                accessibilityLabel="Saldo inicial"
                testID="wallet-balance-input"
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                value={form.initialBalance}
                onChangeText={(value) => setForm((current) => ({ ...current, initialBalance: formatAmountInput(value) }))}
                style={[styles.amountInput, { color: colors.foreground }]}
              />
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Ícone da conta</Text>
            <View style={styles.iconGrid}>
              {WALLET_ICON_OPTIONS.map((option) => {
                const active = form.icon === option.icon;
                return (
                  <Pressable
                    key={option.icon}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Ícone ${option.label}`}
                    testID={`wallet-icon-${option.icon}`}
                    onPress={() => setForm((current) => ({ ...current, icon: option.icon }))}
                    style={[
                      styles.iconOption,
                      {
                        backgroundColor: active ? colors.primary : colors.background,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <WalletIconView icon={option.icon} size={20} color={active ? colors.primaryForeground : colors.foreground} />
                    <Text numberOfLines={1} style={[styles.iconLabel, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.formActions}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={closeModal}
                style={({ pressed }) => [styles.cancelButton, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Text style={[styles.cancelLabel, { color: colors.foreground }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                testID="save-wallet-button"
                onPress={() => void handleSave()}
                style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.accent }, saving && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.saveLabel, { color: colors.accentForeground }]}>{saving ? 'Salvando...' : 'Salvar carteira'}</Text>
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
  intro: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: -7, marginBottom: 18 },
  walletList: { gap: 8 },
  walletCard: { minHeight: 86, borderWidth: 1, borderRadius: 9, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  walletIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  walletCopy: { flex: 1, minWidth: 0 },
  walletTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  walletType: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  walletBalance: { fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 5 },
  walletActions: { flexDirection: 'row', gap: 6 },
  iconButton: { width: 30, height: 30, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.76)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, paddingHorizontal: 18, paddingTop: 17, paddingBottom: 28 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  modalEyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  modalTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  closeButton: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 10 },
  input: { minHeight: 46, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 13, fontFamily: 'Inter_400Regular' },
  amountShell: { minHeight: 46, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginRight: 7 },
  amountInput: { flex: 1, minWidth: 0, paddingVertical: 0, fontSize: 13, fontFamily: 'Inter_400Regular' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  iconOption: { width: '18.5%', minHeight: 62, borderRadius: 8, borderWidth: 1, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', gap: 4 },
  iconLabel: { fontSize: 8, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 20 },
  cancelButton: { flex: 1, minHeight: 45, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  saveButton: { flex: 1.35, minHeight: 45, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  saveLabel: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});