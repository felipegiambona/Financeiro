import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { TransactionRow } from '@/components/TransactionRow';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';
import { calculateCurrentBalance, calculateForecast } from '@/services/financialRules';
import { getTransactionOccurrencesForMonth } from '@/services/recurrence';
import { formatCurrency } from '@/utils/currency';
import { formatMonthLabel, getDateKey, getMonthStart, shiftMonth } from '@/utils/date';
import { TransactionOccurrence } from '@/types/transaction';

interface DeleteConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

type TypeFilter = 'all' | 'income' | 'expense';
type StatusFilter = 'all' | 'paid' | 'unpaid';

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
];

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Pago' },
  { value: 'unpaid', label: 'Não pago' },
];

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    transactions,
    loading,
    error,
    refresh,
    updateTransaction,
    updateTransactionOccurrencePaymentStatus,
    deleteTransaction,
    deleteTransactions,
    clearTransactions,
  } = useFinance();
  const [selectedMonth, setSelectedMonth] = useState(getMonthStart(new Date()));
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const monthOptions = useMemo(() => [-2, -1, 0, 1, 2].map((offset) => shiftMonth(selectedMonth, offset)), [selectedMonth]);
  const selectedTransactions = useMemo(
    () => getTransactionOccurrencesForMonth(transactions, selectedMonth),
    [transactions, selectedMonth],
  );
  const searchQuery = useMemo(() => normalizeSearchText(searchText), [searchText]);
  const filteredTransactions = useMemo(
    () => selectedTransactions.filter((transaction) => (
      (searchQuery.length === 0 || normalizeSearchText(transaction.description).includes(searchQuery))
      &&
      (typeFilter === 'all' || transaction.type === typeFilter)
      && (statusFilter === 'all' || transaction.paymentStatus === statusFilter)
    )),
    [searchQuery, selectedTransactions, statusFilter, typeFilter],
  );
  const filteredSummary = useMemo(
    () => filteredTransactions.reduce(
      (summary, transaction) => {
        if (transaction.type === 'income') {
          summary.income += transaction.amount;
        } else {
          summary.expense += transaction.amount;
        }
        return summary;
      },
      { income: 0, expense: 0 },
    ),
    [filteredTransactions],
  );
  const currentBalance = calculateCurrentBalance(transactions);
  const forecast = calculateForecast(transactions, selectedMonth);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const leaveSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const toggleSelection = (sourceId: string) => {
    setSelectedIds((current) => current.includes(sourceId)
      ? current.filter((id) => id !== sourceId)
      : [...current, sourceId]);
  };

  const confirmDeleteOne = (transaction: TransactionOccurrence) => {
    setDeleteConfirmation({
      title: 'Excluir lançamento?',
      message: transaction.recurrence.kind === 'recurring'
        ? 'Esta ação excluirá a série recorrente e todas as suas ocorrências.'
        : 'Esta ação não poderá ser desfeita.',
      confirmLabel: 'Excluir',
      onConfirm: () => deleteTransaction(transaction.sourceId),
    });
  };

  const confirmDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    const ids = [...selectedIds];
    setDeleteConfirmation({
      title: `Excluir ${ids.length} ${ids.length === 1 ? 'lançamento' : 'lançamentos'}?`,
      message: 'As séries recorrentes selecionadas também serão excluídas por completo. Esta ação não poderá ser desfeita.',
      confirmLabel: 'Excluir selecionados',
      onConfirm: async () => {
        await deleteTransactions(ids);
        leaveSelectionMode();
      },
    });
  };

  const confirmClearAll = () => {
    setDeleteConfirmation({
      title: 'Apagar todos os lançamentos?',
      message: 'Todos os lançamentos e séries recorrentes serão excluídos permanentemente.',
      confirmLabel: 'Apagar todos',
      onConfirm: async () => {
        await clearTransactions();
        leaveSelectionMode();
      },
    });
  };

  const executeConfirmedDeletion = async () => {
    if (!deleteConfirmation) return;
    try {
      setDeleting(true);
      await deleteConfirmation.onConfirm();
      setDeleteConfirmation(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente.');
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePaymentStatus = async (transaction: TransactionOccurrence) => {
    try {
      setUpdatingStatusId(transaction.occurrenceKey);
      const nextStatus = transaction.paymentStatus === 'paid' ? 'unpaid' : 'paid';
      if (transaction.recurrence.kind === 'recurring') {
        await updateTransactionOccurrencePaymentStatus(
          transaction.sourceId,
          transaction.date,
          nextStatus,
        );
      } else {
        await updateTransaction(transaction.sourceId, { paymentStatus: nextStatus });
      }
      await Haptics.selectionAsync();
    } catch {
      Alert.alert('Não foi possível atualizar', 'Tente alterar o status novamente.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Movimentações" title="Transações" />
        <View style={styles.monthHeader}>
          <Text style={[styles.monthTitle, { color: colors.foreground }]}>{formatMonthLabel(selectedMonth)}</Text>
          <View style={styles.monthArrows}>
            <Pressable accessibilityLabel="Mês anterior" hitSlop={8} onPress={() => setSelectedMonth((month) => shiftMonth(month, -1))} style={[styles.arrow, { borderColor: colors.border }]}>
              <Feather name="chevron-left" size={17} color={colors.foreground} />
            </Pressable>
            <Pressable accessibilityLabel="Próximo mês" hitSlop={8} onPress={() => setSelectedMonth((month) => shiftMonth(month, 1))} style={[styles.arrow, { borderColor: colors.border }]}>
              <Feather name="chevron-right" size={17} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.months}>
          {monthOptions.map((month) => {
            const active = getDateKey(month) === getDateKey(selectedMonth);
            return (
              <Pressable key={getDateKey(month)} onPress={() => setSelectedMonth(month)} style={[styles.monthChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card }]}>
                <Text style={[styles.monthChipText, { color: active ? '#FFFFFF' : colors.mutedForeground }]}>{new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(month).replace('.', '')}</Text>
                <Text style={[styles.monthChipYear, { color: active ? colors.accent : colors.foreground }]}>{month.getFullYear()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={[styles.filtersPanel, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={[styles.searchField, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              accessibilityLabel="Buscar lançamento pelo nome"
              autoCorrect={false}
              onChangeText={(value) => {
                setSearchText(value);
                leaveSelectionMode();
              }}
              placeholder="Buscar por nome"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="search"
              style={[styles.searchInput, { color: colors.foreground }]}
              value={searchText}
            />
            {searchText.length > 0 ? (
              <Pressable
                accessibilityLabel="Limpar busca"
                hitSlop={8}
                onPress={() => {
                  setSearchText('');
                  leaveSelectionMode();
                }}
                style={styles.clearSearchButton}
              >
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>Tipo</Text>
            <View style={styles.filterOptions}>
              {TYPE_FILTERS.map((option) => {
                const active = typeFilter === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Filtrar por ${option.label.toLowerCase()}`}
                    onPress={() => {
                      setTypeFilter(option.value);
                      leaveSelectionMode();
                    }}
                    style={[
                      styles.filterChip,
                      { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.filterChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>Status</Text>
            <View style={styles.filterOptions}>
              {STATUS_FILTERS.map((option) => {
                const active = statusFilter === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Filtrar por ${option.label.toLowerCase()}`}
                    onPress={() => {
                      setStatusFilter(option.value);
                      leaveSelectionMode();
                    }}
                    style={[
                      styles.filterChip,
                      { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.filterChipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
        <View style={styles.metrics}>
          <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Saldo atual</Text>
            <Text style={[styles.metricValue, { color: colors.foreground }]}>{formatCurrency(currentBalance)}</Text>
          </View>
          <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Previsão do mês</Text>
            <Text style={[styles.metricValue, { color: forecast >= 0 ? colors.income : colors.expense }]}>{formatCurrency(forecast)}</Text>
          </View>
        </View>
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : (
          <>
            <View style={styles.listHeader}>
              <View style={styles.listTitleRow}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Lançamentos</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Novo lançamento"
                  testID="new-transaction-list-button"
                  onPress={() => router.push('/transaction/new')}
                  hitSlop={8}
                  style={({ pressed }) => [styles.inlineNewButton, { backgroundColor: colors.accent }, pressed && styles.pressed]}
                >
                  <Feather name="plus" size={15} color={colors.accentForeground} />
                </Pressable>
              </View>
              <View style={styles.listActions}>
                <Text style={[styles.count, { color: colors.mutedForeground }]}>
                  {selectionMode ? `${selectedIds.length} selecionados` : `${filteredTransactions.length} ${filteredTransactions.length === 1 ? 'item' : 'itens'}`}
                </Text>
                {filteredTransactions.length > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => selectionMode ? leaveSelectionMode() : setSelectionMode(true)}
                    style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                  >
                    <Text style={[styles.textActionLabel, { color: colors.foreground }]}>{selectionMode ? 'Cancelar' : 'Selecionar'}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {selectionMode ? (
              <View style={styles.selectionActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedIds(Array.from(new Set(filteredTransactions.map((item) => item.sourceId))))}
                  style={({ pressed }) => [styles.secondaryAction, { borderColor: colors.border }, pressed && styles.pressed]}
                >
                  <Text style={[styles.secondaryActionLabel, { color: colors.foreground }]}>Selecionar todos</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={selectedIds.length === 0}
                  onPress={confirmDeleteSelected}
                  style={({ pressed }) => [
                    styles.deleteSelectedAction,
                    { backgroundColor: colors.expense },
                    selectedIds.length === 0 && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather name="trash-2" size={14} color="#FFFFFF" />
                  <Text style={styles.deleteSelectedLabel}>Excluir selecionados</Text>
                </Pressable>
              </View>
            ) : transactions.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={confirmClearAll}
                style={({ pressed }) => [styles.clearAllAction, pressed && styles.pressed]}
              >
                <Feather name="trash-2" size={13} color={colors.expense} />
                <Text style={[styles.clearAllLabel, { color: colors.expense }]}>Apagar todos</Text>
              </Pressable>
            ) : null}
            {filteredTransactions.length === 0 ? (
              <EmptyState message={selectedTransactions.length === 0 ? 'Não há lançamentos neste mês.' : 'Nenhum lançamento corresponde aos filtros.'} />
            ) : (
              filteredTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.occurrenceKey}
                  transaction={transaction}
                  onPress={() => router.push({ pathname: '/transaction/new', params: { id: transaction.id } })}
                  onTogglePaymentStatus={() => void handleTogglePaymentStatus(transaction)}
                  paymentStatusUpdating={updatingStatusId === transaction.occurrenceKey}
                  onDelete={() => confirmDeleteOne(transaction)}
                  selectionMode={selectionMode}
                  selected={selectedIdSet.has(transaction.sourceId)}
                  onToggleSelection={() => toggleSelection(transaction.sourceId)}
                />
              ))
            )}
            {filteredTransactions.length > 0 ? (
              <View style={[styles.monthSummary, { borderTopColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>No mês selecionado</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>{formatCurrency(filteredSummary.income - filteredSummary.expense)}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <Modal
        animationType="fade"
        transparent
        visible={deleteConfirmation !== null}
        onRequestClose={() => !deleting && setDeleteConfirmation(null)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar confirmação"
            disabled={deleting}
            onPress={() => setDeleteConfirmation(null)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.confirmationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.confirmationIcon, { backgroundColor: colors.expenseSoft }]}>
              <Feather name="trash-2" size={18} color={colors.expense} />
            </View>
            <Text style={[styles.confirmationTitle, { color: colors.foreground }]}>{deleteConfirmation?.title}</Text>
            <Text style={[styles.confirmationMessage, { color: colors.mutedForeground }]}>{deleteConfirmation?.message}</Text>
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => setDeleteConfirmation(null)}
                style={({ pressed }) => [styles.confirmationCancel, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Text style={[styles.confirmationCancelLabel, { color: colors.foreground }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => void executeConfirmedDeletion()}
                style={({ pressed }) => [styles.confirmationDelete, { backgroundColor: colors.expense }, deleting && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.confirmationDeleteLabel}>{deleting ? 'Excluindo...' : deleteConfirmation?.confirmLabel}</Text>
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
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  monthTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  monthArrows: { flexDirection: 'row', gap: 7 },
  arrow: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  months: { gap: 7, paddingBottom: 14 },
  monthChip: { width: 65, minHeight: 52, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  monthChipText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'capitalize' },
  monthChipYear: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  filtersPanel: { borderRadius: 9, borderWidth: 1, padding: 8, marginBottom: 14, gap: 7 },
  searchField: { minHeight: 36, borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, fontSize: 11, fontFamily: 'Inter_400Regular' },
  clearSearchButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  filterGroup: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  filterLabel: { width: 43, fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  filterOptions: { flex: 1, flexDirection: 'row', gap: 5 },
  filterChip: { minHeight: 28, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  filterChipText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  metrics: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  metric: { flex: 1, minHeight: 64, borderRadius: 8, borderWidth: 1, padding: 10, justifyContent: 'space-between' },
  metricLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  metricValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineNewButton: { width: 25, height: 25, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  listActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  count: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  textAction: { paddingVertical: 5 },
  textActionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  selectionActions: { flexDirection: 'row', gap: 7, marginBottom: 9 },
  secondaryAction: { minHeight: 34, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryActionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  deleteSelectedAction: { flex: 1, minHeight: 34, borderRadius: 7, paddingHorizontal: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  deleteSelectedLabel: { color: '#FFFFFF', fontSize: 10, fontFamily: 'Inter_700Bold' },
  clearAllAction: { alignSelf: 'flex-end', marginTop: -3, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  clearAllLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.72 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.76)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  confirmationCard: { width: '100%', maxWidth: 350, borderRadius: 12, borderWidth: 1, padding: 18, alignItems: 'center' },
  confirmationIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  confirmationTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  confirmationMessage: { marginTop: 7, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  confirmationActions: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 18 },
  confirmationCancel: { flex: 1, minHeight: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmationCancelLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  confirmationDelete: { flex: 1.35, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  confirmationDeleteLabel: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  monthSummary: { borderTopWidth: 1, marginTop: 6, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});