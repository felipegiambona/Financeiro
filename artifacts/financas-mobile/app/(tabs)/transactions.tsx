import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { TransactionRow } from '@/components/TransactionRow';
import { useFinance } from '@/context/FinanceContext';
import { useCategories } from '@/context/CategoryContext';
import { useWallets } from '@/context/WalletContext';
import { useCards } from '@/context/CardContext';
import { useColors } from '@/hooks/useColors';
import {
  calculateCurrentBalance,
  calculateForecast,
  calculateTransactionListTotal,
} from '@/services/financialRules';
import { getFilteredCardInvoices } from '@/services/cardInvoiceFilters';
import { getTransactionOccurrencesForMonth, getTransactionOccurrencesInRange } from '@/services/recurrence';
import { formatCurrency } from '@/utils/currency';
import {
  formatMonthYearLabel,
  formatDateInput,
  formatTransactionGroupLabel,
  createLocalIsoDate,
  getDayKey,
  getMonthStart,
  getSaoPauloToday,
  parseStoredDate,
  shiftMonth,
} from '@/utils/date';
import { TransactionOccurrence } from '@/types/transaction';
import { DatePickerModal } from '@/components/DatePickerModal';
import { PaymentCelebration } from '@/components/PaymentCelebration';
import {
  exportTransactions,
  getExportPeriodLabel,
  type TransactionExportFormat,
  type TransactionExportItem,
} from '@/services/transactionExport';

interface DeleteConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  options?: Array<{
    label: string;
    onConfirm: () => Promise<void>;
    destructive?: boolean;
  }>;
}

type TypeFilter = 'all' | 'income' | 'expense' | 'transfer';
type StatusFilter = 'all' | 'paid' | 'unpaid';
type RecurrenceFilter = 'all' | 'recurring' | 'nonRecurring';
type DateFilterTarget = 'start' | 'end';
type CategoryFilter = 'all' | 'uncategorized' | string;
type BatchPaymentStatus = 'unchanged' | 'paid' | 'unpaid';
type BatchCategory = 'unchanged' | 'none' | string;
type BatchDueDate = 'unchanged' | 'clear' | string;

const TYPE_FILTERS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'expense', label: 'Despesas' },
  { value: 'income', label: 'Receitas' },
  { value: 'transfer', label: 'Transferências' },
];

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'paid', label: 'Pago' },
  { value: 'unpaid', label: 'Não pago' },
];

const RECURRENCE_FILTERS: Array<{ value: RecurrenceFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'recurring', label: 'Recorrentes' },
  { value: 'nonRecurring', label: 'Não recorrentes' },
];

const normalizeSearchText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

function formatFilterDate(date: Date): string {
  return formatDateInput(date);
}

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { typeFilter: typeFilterParam, statusFilter: statusFilterParam } = useLocalSearchParams<{
    typeFilter?: string;
    statusFilter?: string;
  }>();
  const {
    transactions,
    loading,
    error,
    refresh,
    updateTransaction,
    updateTransactionOccurrencePaymentStatus,
    deleteTransaction,
    deleteTransactions,
    updateTransactions,
  } = useFinance();
  const { wallets } = useWallets();
  const { cards, refresh: refreshCards } = useCards();
  const { categories } = useCategories();
  const routeTypeFilter = Array.isArray(typeFilterParam) ? typeFilterParam[0] : typeFilterParam;
  const routeStatusFilter = Array.isArray(statusFilterParam) ? statusFilterParam[0] : statusFilterParam;
  const [selectedMonth, setSelectedMonth] = useState(getMonthStart(getSaoPauloToday()));
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [paymentCelebration, setPaymentCelebration] = useState<string | null>(null);
  const [openSwipeKey, setOpenSwipeKey] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [recurrenceFilter, setRecurrenceFilter] = useState<RecurrenceFilter>('all');
  const [walletFilter, setWalletFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [cardFilter, setCardFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [dateRangeStart, setDateRangeStart] = useState<Date | null>(null);
  const [dateRangeEnd, setDateRangeEnd] = useState<Date | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<DateFilterTarget | null>(null);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditSaving, setBatchEditSaving] = useState(false);
  const [batchPaymentStatus, setBatchPaymentStatus] = useState<BatchPaymentStatus>('unchanged');
  const [batchWalletId, setBatchWalletId] = useState('unchanged');
  const [batchCategoryId, setBatchCategoryId] = useState<BatchCategory>('unchanged');
  const [batchDueDate, setBatchDueDate] = useState<BatchDueDate>('unchanged');
  const [batchDueDatePickerOpen, setBatchDueDatePickerOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<TransactionExportFormat | null>(null);

  useFocusEffect(useCallback(() => {
    void refreshCards();
  }, [refreshCards]));

  useEffect(() => {
    const validTypeFilter = TYPE_FILTERS.some((option) => option.value === routeTypeFilter)
      ? routeTypeFilter as TypeFilter
      : null;
    const validStatusFilter = STATUS_FILTERS.some((option) => option.value === routeStatusFilter)
      ? routeStatusFilter as StatusFilter
      : null;

    if (validTypeFilter) setTypeFilter(validTypeFilter);
    if (validStatusFilter) setStatusFilter(validStatusFilter);
    if (validTypeFilter || validStatusFilter) setMoreFiltersOpen(true);
  }, [routeStatusFilter, routeTypeFilter]);
  const selectedTransactions = useMemo(
    () => {
      const occurrences = dateRangeStart || dateRangeEnd
        ? getTransactionOccurrencesInRange(
          transactions,
          dateRangeStart
            ? new Date(dateRangeStart.getFullYear(), dateRangeStart.getMonth(), dateRangeStart.getDate(), 0, 0, 0, 0)
            : new Date(1970, 0, 1, 0, 0, 0, 0),
          dateRangeEnd
            ? new Date(dateRangeEnd.getFullYear(), dateRangeEnd.getMonth(), dateRangeEnd.getDate(), 23, 59, 59, 999)
            : new Date(2100, 0, 1, 23, 59, 59, 999),
        )
        : getTransactionOccurrencesForMonth(transactions, selectedMonth);
      return occurrences.sort((a, b) => {
        const dateDifference = parseStoredDate(b.date).getTime() - parseStoredDate(a.date).getTime();
        if (dateDifference !== 0) return dateDifference;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    },
    [dateRangeEnd, dateRangeStart, selectedMonth, transactions],
  );
  const searchQuery = useMemo(() => normalizeSearchText(searchText), [searchText]);
  const filteredTransactions = useMemo(
    () => selectedTransactions.filter((transaction) => (
      (searchQuery.length === 0 || normalizeSearchText(transaction.description).includes(searchQuery))
      &&
      (typeFilter === 'all' || transaction.type === typeFilter)
      && (statusFilter === 'all' || transaction.paymentStatus === statusFilter)
      && (
        recurrenceFilter === 'all'
        || (recurrenceFilter === 'recurring' && transaction.recurrence.kind !== 'none')
        || (recurrenceFilter === 'nonRecurring' && transaction.recurrence.kind === 'none')
      )
      && (
        walletFilter === 'all'
        || transaction.walletId === walletFilter
        || transaction.destinationWalletId === walletFilter
      )
      && (
        categoryFilter === 'all'
        || (categoryFilter === 'uncategorized' && !transaction.categoryId)
        || transaction.categoryId === categoryFilter
      )
       && (cardFilter === 'all' || transaction.cardId === cardFilter)
    )),
     [cardFilter, categoryFilter, recurrenceFilter, searchQuery, selectedTransactions, statusFilter, typeFilter, walletFilter],
  );
  const exportItems = useMemo<TransactionExportItem[]>(
    () => filteredTransactions.map((transaction) => ({
      date: transaction.date,
      type: transaction.type,
      isInvestment: transaction.isInvestment,
      description: transaction.description,
      category: categories.find((category) => category.id === transaction.categoryId)?.name ?? 'Sem categoria',
      wallet: wallets.find((wallet) => wallet.id === transaction.walletId)?.title ?? 'Carteira não encontrada',
      destinationWallet: transaction.destinationWalletId
        ? wallets.find((wallet) => wallet.id === transaction.destinationWalletId)?.title ?? 'Carteira não encontrada'
        : '',
      status: transaction.paymentStatus,
      amount: transaction.amount,
      recurrence: transaction.recurrence.kind === 'installment'
        ? 'Parcelado'
        : transaction.recurrence.kind === 'recurring'
          ? 'Recorrente'
          : 'none',
    })),
    [categories, filteredTransactions, wallets],
  );
  const exportPeriodLabel = useMemo(
    () => getExportPeriodLabel(selectedMonth, dateRangeStart, dateRangeEnd),
    [dateRangeEnd, dateRangeStart, selectedMonth],
  );
  const transactionGroups = useMemo(() => {
    const groups = new Map<string, TransactionOccurrence[]>();
    filteredTransactions.forEach((transaction) => {
      const key = getDayKey(parseStoredDate(transaction.date));
      const group = groups.get(key);
      if (group) {
        group.push(transaction);
      } else {
        groups.set(key, [transaction]);
      }
    });

    return Array.from(groups, ([key, groupTransactions]) => ({
      key,
      label: formatTransactionGroupLabel(groupTransactions[0].date),
      transactions: groupTransactions,
      total: groupTransactions.reduce((total, transaction) => {
        if (transaction.cardId && transaction.cardEntryType !== 'invoice_payment') return total;
        if (transaction.cardEntryType === 'invoice_payment' && transaction.paymentStatus !== 'paid') return total;
        if (transaction.type === 'income') return total + transaction.amount;
        if (transaction.type === 'expense') return total - transaction.amount;
        if (typeFilter === 'transfer') return total + transaction.amount;
        if (walletFilter !== 'all' && transaction.destinationWalletId === walletFilter) return total + transaction.amount;
        if (walletFilter !== 'all' && transaction.walletId === walletFilter) return total - transaction.amount;
        return total;
      }, 0),
    }));
  }, [filteredTransactions, typeFilter, walletFilter]);
  const currentBalance = calculateCurrentBalance(wallets, transactions, cards);
  const forecast = calculateForecast(transactions, selectedMonth, cards);
  const cardInvoicesForMonth = useMemo(() => {
    const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;
    return getFilteredCardInvoices(cards, {
      monthKey,
      cardId: cardFilter,
      status: statusFilter,
      dateRangeStart,
      dateRangeEnd,
    });
  }, [cardFilter, cards, dateRangeEnd, dateRangeStart, selectedMonth, statusFilter]);
  const showCardInvoices = (typeFilter === 'all' || typeFilter === 'expense')
    && cardInvoicesForMonth.length > 0;
  const monthTotal = calculateTransactionListTotal(filteredTransactions, walletFilter, typeFilter);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const leaveSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    setOpenSwipeKey(null);
  };

  const toggleSelection = (sourceId: string) => {
    setSelectedIds((current) => current.includes(sourceId)
      ? current.filter((id) => id !== sourceId)
      : [...current, sourceId]);
  };

  const confirmDeleteOne = (transaction: TransactionOccurrence) => {
    if (transaction.recurrence.kind !== 'none') {
      const occurrenceDate = createLocalIsoDate(parseStoredDate(transaction.date));
      const excludedDates = Array.from(new Set([
        ...(transaction.recurrence.excludedDates ?? []),
        occurrenceDate,
      ])).sort();
      const deleteOnlyOccurrence = () => updateTransaction(transaction.sourceId, {
        recurrence: {
          ...transaction.recurrence,
          excludedDates,
        },
      });
      setDeleteConfirmation({
        title: 'Excluir ocorrência?',
        message: 'Escolha se deseja remover apenas este lançamento ou toda a série recorrente.',
        confirmLabel: 'Toda a série',
        onConfirm: () => deleteTransaction(transaction.sourceId),
        options: [
          { label: 'Apenas este lançamento', onConfirm: deleteOnlyOccurrence },
          { label: 'Toda a série', onConfirm: () => deleteTransaction(transaction.sourceId), destructive: true },
        ],
      });
      return;
    }
    setDeleteConfirmation({
      title: 'Excluir lançamento?',
      message: 'Esta ação não poderá ser desfeita.',
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

  const openBatchEdit = () => {
    if (selectedIds.length === 0) return;
    setBatchPaymentStatus('unchanged');
    setBatchWalletId('unchanged');
    setBatchCategoryId('unchanged');
    setBatchDueDate('unchanged');
    setBatchEditOpen(true);
  };

  const applyBatchEdit = async () => {
    const updates: {
      walletId?: string;
      categoryId?: string | null;
      dueDate?: string | null;
      paymentStatus?: 'paid' | 'unpaid';
    } = {};
    if (batchPaymentStatus !== 'unchanged') updates.paymentStatus = batchPaymentStatus;
    if (batchWalletId !== 'unchanged') updates.walletId = batchWalletId;
    if (batchCategoryId !== 'unchanged') updates.categoryId = batchCategoryId === 'none' ? null : batchCategoryId;
    if (batchDueDate !== 'unchanged') updates.dueDate = batchDueDate === 'clear' ? null : batchDueDate;

    if (Object.keys(updates).length === 0) {
      Alert.alert('Nenhuma alteração', 'Escolha pelo menos um campo para aplicar aos lançamentos selecionados.');
      return;
    }

    try {
      setBatchEditSaving(true);
      await updateTransactions([...selectedIds], updates);
      setBatchEditOpen(false);
      leaveSelectionMode();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Não foi possível editar', 'Tente aplicar as alterações novamente.');
    } finally {
      setBatchEditSaving(false);
    }
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
      if (transaction.recurrence.kind !== 'none') {
        await updateTransactionOccurrencePaymentStatus(
          transaction.sourceId,
          transaction.date,
          nextStatus,
        );
      } else {
        await updateTransaction(transaction.sourceId, { paymentStatus: nextStatus });
      }
      if (nextStatus === 'paid') {
        setPaymentCelebration(transaction.description);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.selectionAsync();
      }
    } catch {
      Alert.alert('Não foi possível atualizar', 'Tente alterar o status novamente.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const renderTypeFilter = (option: { value: TypeFilter; label: string }) => {
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
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setStatusFilter('all');
    setRecurrenceFilter('all');
    setWalletFilter('all');
    setCategoryFilter('all');
    setCardFilter('all');
    setSearchText('');
    setDateRangeStart(null);
    setDateRangeEnd(null);
    setDatePickerTarget(null);
    setMoreFiltersOpen(false);
    setWalletPickerOpen(false);
    setCategoryPickerOpen(false);
    setCardPickerOpen(false);
    leaveSelectionMode();
    router.setParams({ typeFilter: undefined, statusFilter: undefined });
  };

  const handleExport = async (format: TransactionExportFormat) => {
    setExportMenuOpen(false);
    setExportingFormat(format);
    try {
      await exportTransactions(exportItems, exportPeriodLabel, format);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (exportError) {
      Alert.alert(
        'Não foi possível exportar',
        exportError instanceof Error ? exportError.message : 'Tente novamente.',
      );
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Movimentações"
          title="Transações"
          rightContent={(
            <View style={styles.monthSelector} accessibilityLabel="Selecionar mês das transações">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mês anterior"
                hitSlop={8}
                onPress={() => setSelectedMonth((month) => shiftMonth(month, -1))}
                style={({ pressed }) => [styles.monthButton, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Feather name="chevron-left" size={15} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.monthText, { color: colors.foreground }]} numberOfLines={1}>
                {formatMonthYearLabel(selectedMonth)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Próximo mês"
                hitSlop={8}
                onPress={() => setSelectedMonth((month) => shiftMonth(month, 1))}
                style={({ pressed }) => [styles.monthButton, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Feather name="chevron-right" size={15} color={colors.foreground} />
              </Pressable>
            </View>
          )}
        />
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
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: moreFiltersOpen }}
            accessibilityLabel={moreFiltersOpen ? 'Ocultar mais filtros' : 'Exibir mais filtros'}
            onPress={() => setMoreFiltersOpen((open) => !open)}
            style={({ pressed }) => [styles.moreFiltersToggle, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <View style={styles.moreFiltersControl}>
              <Text style={[styles.moreFiltersLabel, { color: colors.foreground }]}>Mais filtros</Text>
               {(typeFilter !== 'all' || statusFilter !== 'all' || recurrenceFilter !== 'all' || walletFilter !== 'all' || categoryFilter !== 'all' || cardFilter !== 'all' || dateRangeStart !== null || dateRangeEnd !== null) ? (
                <View style={[styles.activeFiltersDot, { backgroundColor: colors.radio }]} />
              ) : null}
              <Feather name={moreFiltersOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
            </View>
          </Pressable>
          {moreFiltersOpen ? (
            <View style={styles.moreFiltersContent}>
              <View style={styles.filterGroup}>
                <Text numberOfLines={1} style={[styles.filterLabel, { color: colors.mutedForeground }]}>Tipo</Text>
                <View style={styles.filterRows}>
                  <View style={styles.filterRow}>
                    {TYPE_FILTERS.slice(0, 2).map(renderTypeFilter)}
                  </View>
                  <View style={styles.filterRow}>
                    {TYPE_FILTERS.slice(2).map(renderTypeFilter)}
                  </View>
                </View>
              </View>
              <View style={styles.filterGroup}>
                <Text numberOfLines={1} style={[styles.filterLabel, { color: colors.mutedForeground }]}>Status</Text>
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
              <View style={styles.filterGroup}>
                <Text numberOfLines={1} style={[styles.filterLabel, { color: colors.mutedForeground }]}>Carteira</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar carteira, ${walletFilter === 'all' ? 'todas as carteiras' : wallets.find((wallet) => wallet.id === walletFilter)?.title ?? 'carteira selecionada'}`}
                  testID="wallet-filter-picker"
                  onPress={() => setWalletPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.walletFilterCombo,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather name="briefcase" size={14} color={colors.mutedForeground} />
                  <Text numberOfLines={1} style={[styles.walletFilterText, { color: colors.foreground }]}>
                    {walletFilter === 'all' ? 'Todas as carteiras' : wallets.find((wallet) => wallet.id === walletFilter)?.title ?? 'Carteira selecionada'}
                  </Text>
                  <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
                </Pressable>
              </View>
              <View style={styles.filterGroup}>
                <Text numberOfLines={1} style={[styles.filterLabel, { color: colors.mutedForeground }]}>Categoria</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Selecionar categoria, ${categoryFilter === 'all' ? 'todas as categorias' : categoryFilter === 'uncategorized' ? 'sem categoria' : categories.find((category) => category.id === categoryFilter)?.name ?? 'categoria selecionada'}`}
                  testID="category-filter-picker"
                  onPress={() => setCategoryPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.walletFilterCombo,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather name="tag" size={14} color={colors.mutedForeground} />
                  <Text numberOfLines={1} style={[styles.walletFilterText, { color: colors.foreground }]}>
                    {categoryFilter === 'all'
                      ? 'Todas as categorias'
                      : categoryFilter === 'uncategorized'
                        ? 'Sem categoria'
                        : categories.find((category) => category.id === categoryFilter)?.name ?? 'Categoria selecionada'}
                  </Text>
                  <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
                </Pressable>
              </View>
               <View style={styles.filterGroup}>
                 <Text numberOfLines={1} style={[styles.filterLabel, { color: colors.mutedForeground }]}>Cartão</Text>
                 <Pressable
                   accessibilityRole="button"
                   accessibilityLabel={`Selecionar cartão, ${cardFilter === 'all' ? 'todos os cartões' : cards.find((card) => card.id === cardFilter)?.name ?? 'cartão selecionado'}`}
                   testID="card-filter-picker"
                   onPress={() => setCardPickerOpen(true)}
                   style={({ pressed }) => [
                     styles.walletFilterCombo,
                     { backgroundColor: colors.card, borderColor: colors.border },
                     pressed && styles.pressed,
                   ]}
                 >
                   <Feather name="credit-card" size={14} color={colors.mutedForeground} />
                   <Text numberOfLines={1} style={[styles.walletFilterText, { color: colors.foreground }]}>
                     {cardFilter === 'all' ? 'Todos os cartões' : cards.find((card) => card.id === cardFilter)?.name ?? 'Cartão selecionado'}
                   </Text>
                   <Feather name="chevron-down" size={15} color={colors.mutedForeground} />
                 </Pressable>
               </View>
              <View style={styles.filterGroup}>
                <Text numberOfLines={1} style={[styles.filterLabel, { color: colors.mutedForeground }]}>Data</Text>
                <View style={styles.dateFilterContent}>
                  <View style={styles.dateFilterRow}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Selecionar data inicial"
                      onPress={() => setDatePickerTarget('start')}
                      style={[styles.dateFilterButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Feather name="calendar" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.dateFilterText, { color: dateRangeStart ? colors.foreground : colors.mutedForeground }]}>
                        {dateRangeStart ? formatFilterDate(dateRangeStart) : 'Data inicial'}
                      </Text>
                    </Pressable>
                    <Text style={[styles.dateFilterSeparator, { color: colors.mutedForeground }]}>até</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Selecionar data final"
                      onPress={() => setDatePickerTarget('end')}
                      style={[styles.dateFilterButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      <Feather name="calendar" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.dateFilterText, { color: dateRangeEnd ? colors.foreground : colors.mutedForeground }]}>
                        {dateRangeEnd ? formatFilterDate(dateRangeEnd) : 'Data final'}
                      </Text>
                    </Pressable>
                  </View>
                  {dateRangeStart && dateRangeEnd && dateRangeStart.getTime() > dateRangeEnd.getTime() ? (
                    <Text style={[styles.dateFilterError, { color: colors.expense }]}>A data inicial deve ser anterior à data final.</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.filterGroup}>
                <Text numberOfLines={1} style={[styles.filterLabel, { color: colors.mutedForeground }]}>Recorrência</Text>
                <View style={styles.recurrenceOptions}>
                  {RECURRENCE_FILTERS.map((option) => {
                    const active = recurrenceFilter === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`Filtrar por ${option.label.toLowerCase()}`}
                        onPress={() => {
                          setRecurrenceFilter(option.value);
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Limpar filtros"
                onPress={clearFilters}
                style={({ pressed }) => [styles.clearFiltersAction, pressed && styles.pressed]}
              >
                <Feather name="x-circle" size={14} color={colors.mutedForeground} />
                <Text style={[styles.clearFiltersLabel, { color: colors.mutedForeground }]}>Limpar filtros</Text>
              </Pressable>
            </View>
          ) : null}
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
              </View>
              <View style={styles.listActions}>
                <Text style={[styles.count, { color: colors.mutedForeground }]}>
                  {selectionMode ? `${selectedIds.length} selecionados` : `${filteredTransactions.length} ${filteredTransactions.length === 1 ? 'item' : 'itens'}`}
                </Text>
                {filteredTransactions.length > 0 ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Exportar lançamentos exibidos"
                      testID="export-transactions-button"
                      disabled={exportingFormat !== null}
                      onPress={() => setExportMenuOpen(true)}
                      style={({ pressed }) => [styles.exportAction, exportingFormat !== null && styles.disabled, pressed && styles.pressed]}
                    >
                      <Feather name="download" size={13} color={colors.foreground} />
                      <Text style={[styles.exportActionLabel, { color: colors.foreground }]}>Exportar</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => selectionMode ? leaveSelectionMode() : setSelectionMode(true)}
                      style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                    >
                      <Text style={[styles.textActionLabel, { color: colors.foreground }]}>{selectionMode ? 'Cancelar' : 'Selecionar'}</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>
            {selectionMode ? (
              <View style={styles.selectionActions}>
                <View style={styles.selectionActionRow}>
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
                    onPress={openBatchEdit}
                    style={({ pressed }) => [
                      styles.editSelectedAction,
                      { backgroundColor: colors.primary },
                      selectedIds.length === 0 && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Feather name="edit-3" size={14} color={colors.primaryForeground} />
                    <Text style={[styles.editSelectedLabel, { color: colors.primaryForeground }]}>Editar selecionados</Text>
                  </Pressable>
                </View>
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
                  <Feather name="trash-2" size={14} color={colors.destructiveForeground} />
                  <Text style={[styles.deleteSelectedLabel, { color: colors.destructiveForeground }]}>Excluir selecionados</Text>
                </Pressable>
              </View>
            ) : null}
            {filteredTransactions.length === 0 ? (
              <EmptyState message={selectedTransactions.length === 0 ? 'Não há lançamentos neste mês.' : 'Nenhum lançamento corresponde aos filtros.'} />
            ) : transactionGroups.map((group) => (
              <View key={group.key} style={styles.transactionGroup}>
                <View style={styles.groupHeader}>
                  <Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>{group.label}</Text>
                  <Text style={[styles.groupTotal, { color: group.total >= 0 ? colors.income : colors.expense }]}>
                    {formatCurrency(group.total)}
                  </Text>
                </View>
                {group.transactions.map((transaction) => (
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
                    swipeOpen={openSwipeKey === transaction.occurrenceKey}
                    onSwipeOpen={() => setOpenSwipeKey(transaction.occurrenceKey)}
                    onSwipeClose={() => setOpenSwipeKey(null)}
                  />
                ))}
              </View>
            ))}
            {filteredTransactions.length > 0 ? (
              <View style={styles.monthSummary}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  Total
                </Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>
                  {formatCurrency(monthTotal)}
                </Text>
              </View>
            ) : null}
            {showCardInvoices ? (
              <View style={styles.cardInvoicesSection}>
                <View style={styles.cardInvoicesHeader}>
                  <View style={styles.cardInvoicesHeaderCopy}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Cartões</Text>
                    <Text style={[styles.cardInvoicesHint, { color: colors.mutedForeground }]}>
                      Resumo da fatura do mês. Não é um lançamento individual.
                    </Text>
                  </View>
                </View>
                {cardInvoicesForMonth.map(({ card, invoice }) => {
                  const statusLabel = invoice.status === 'paid'
                    ? 'Fatura paga'
                    : invoice.status === 'overdue'
                      ? 'Fatura atrasada'
                      : invoice.status === 'closed'
                        ? 'Fatura fechada'
                        : 'Fatura aberta';
                  return (
                    <Pressable
                      key={`${card.id}-${invoice.invoiceMonth}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir detalhes da fatura do cartão ${card.name}`}
                      onPress={() => router.push({ pathname: '/more/card/[id]', params: { id: card.id } })}
                      style={({ pressed }) => [
                        styles.cardInvoiceRow,
                        { backgroundColor: colors.card, borderColor: colors.border },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.cardInvoiceIcon, { backgroundColor: colors.secondary }]}>
                        <Feather name="credit-card" size={16} color={colors.foreground} />
                      </View>
                      <View style={styles.cardInvoiceCopy}>
                        <Text style={[styles.cardInvoiceTitle, { color: colors.foreground }]}>{card.name}</Text>
                        <Text style={[styles.cardInvoiceStatus, { color: invoice.status === 'overdue' ? colors.expense : colors.mutedForeground }]}>
                          {statusLabel}
                        </Text>
                         <Text style={[styles.cardInvoiceDueDate, { color: colors.mutedForeground }]}>
                           Vencimento: {formatDateInput(parseStoredDate(invoice.dueDate))}
                         </Text>
                      </View>
                      <Text style={[styles.cardInvoiceAmount, { color: colors.expense }]}>{formatCurrency(invoice.amount)}</Text>
                      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <Modal
        animationType="fade"
        transparent
        visible={exportMenuOpen}
        onRequestClose={() => setExportMenuOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar opções de exportação"
            onPress={() => setExportMenuOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.exportMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.exportMenuHeader}>
              <View style={styles.exportMenuTitleBlock}>
                <Text style={[styles.exportMenuEyebrow, { color: colors.mutedForeground }]}>Extrato de lançamentos</Text>
                <Text style={[styles.exportMenuTitle, { color: colors.foreground }]}>Exportar</Text>
              </View>
              <Pressable
                accessibilityLabel="Fechar opções de exportação"
                onPress={() => setExportMenuOpen(false)}
                style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
              >
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            <Text style={[styles.exportMenuDescription, { color: colors.mutedForeground }]}>
              Serão exportados os {exportItems.length} {exportItems.length === 1 ? 'lançamento' : 'lançamentos'} exibidos na listagem.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Exportar extrato em CSV"
              disabled={exportingFormat !== null}
              onPress={() => void handleExport('csv')}
              style={({ pressed }) => [styles.exportOption, { borderColor: colors.border }, exportingFormat !== null && styles.disabled, pressed && styles.pressed]}
            >
              <View style={[styles.exportOptionIcon, { backgroundColor: colors.incomeSoft }]}>
                <Feather name="file-text" size={17} color={colors.income} />
              </View>
              <View style={styles.exportOptionCopy}>
                <Text style={[styles.exportOptionTitle, { color: colors.foreground }]}>
                  {exportingFormat === 'csv' ? 'Gerando CSV...' : 'Arquivo CSV'}
                </Text>
                <Text style={[styles.exportOptionDescription, { color: colors.mutedForeground }]}>
                  Compatível com planilhas e outros sistemas.
                </Text>
              </View>
              <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Exportar extrato em PDF"
              disabled={exportingFormat !== null}
              onPress={() => void handleExport('pdf')}
              style={({ pressed }) => [styles.exportOption, { borderColor: colors.border }, exportingFormat !== null && styles.disabled, pressed && styles.pressed]}
            >
              <View style={[styles.exportOptionIcon, { backgroundColor: colors.expenseSoft }]}>
                <Feather name="file" size={17} color={colors.expense} />
              </View>
              <View style={styles.exportOptionCopy}>
                <Text style={[styles.exportOptionTitle, { color: colors.foreground }]}>
                  {exportingFormat === 'pdf' ? 'Gerando PDF...' : 'Arquivo PDF'}
                </Text>
                <Text style={[styles.exportOptionDescription, { color: colors.mutedForeground }]}>
                  Formato pronto para visualizar ou imprimir.
                </Text>
              </View>
              <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>
      </Modal>
      <DatePickerModal
        visible={datePickerTarget !== null}
        value={
          datePickerTarget === 'start'
            ? dateRangeStart ?? selectedMonth
            : dateRangeEnd ?? dateRangeStart ?? selectedMonth
        }
        eyebrow={datePickerTarget === 'start' ? 'DATA INICIAL' : 'DATA FINAL'}
        onClose={() => setDatePickerTarget(null)}
        onConfirm={(date) => {
          if (datePickerTarget === 'start') setDateRangeStart(date);
          if (datePickerTarget === 'end') setDateRangeEnd(date);
          setDatePickerTarget(null);
        }}
      />
      <Modal
        animationType="fade"
        transparent
        visible={walletPickerOpen}
        onRequestClose={() => setWalletPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar seletor de carteira"
            onPress={() => setWalletPickerOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.walletMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.walletMenuTitle, { color: colors.foreground }]}>Filtrar por carteira</Text>
            <Pressable
              testID="wallet-filter-option-all"
              onPress={() => {
                setWalletFilter('all');
                setWalletPickerOpen(false);
                leaveSelectionMode();
              }}
              style={({ pressed }) => [
                styles.walletMenuOption,
                { backgroundColor: walletFilter === 'all' ? colors.primary : colors.card, borderColor: walletFilter === 'all' ? colors.primary : colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Feather name="layers" size={17} color={walletFilter === 'all' ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.walletMenuOptionText, { color: walletFilter === 'all' ? colors.primaryForeground : colors.foreground }]}>Todas as carteiras</Text>
              {walletFilter === 'all' ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
            </Pressable>
            {wallets.map((wallet) => {
              const active = wallet.id === walletFilter;
              return (
                <Pressable
                  key={wallet.id}
                  testID={`wallet-filter-option-${wallet.id}`}
                  onPress={() => {
                    setWalletFilter(wallet.id);
                    setWalletPickerOpen(false);
                    leaveSelectionMode();
                  }}
                  style={({ pressed }) => [
                    styles.walletMenuOption,
                    { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Feather name="briefcase" size={17} color={active ? colors.primaryForeground : colors.mutedForeground} />
                  <Text numberOfLines={1} style={[styles.walletMenuOptionText, { color: active ? colors.primaryForeground : colors.foreground }]}>{wallet.title}</Text>
                  {active ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={categoryPickerOpen}
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar seletor de categoria"
            onPress={() => setCategoryPickerOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.walletMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.walletMenuTitle, { color: colors.foreground }]}>Filtrar por categoria</Text>
            <Pressable
              testID="category-filter-option-all"
              onPress={() => {
                setCategoryFilter('all');
                setCategoryPickerOpen(false);
                leaveSelectionMode();
              }}
              style={({ pressed }) => [
                styles.walletMenuOption,
                { backgroundColor: categoryFilter === 'all' ? colors.primary : colors.card, borderColor: categoryFilter === 'all' ? colors.primary : colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Feather name="layers" size={17} color={categoryFilter === 'all' ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.walletMenuOptionText, { color: categoryFilter === 'all' ? colors.primaryForeground : colors.foreground }]}>Todas as categorias</Text>
              {categoryFilter === 'all' ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
            </Pressable>
            <Pressable
              testID="category-filter-option-uncategorized"
              onPress={() => {
                setCategoryFilter('uncategorized');
                setCategoryPickerOpen(false);
                leaveSelectionMode();
              }}
              style={({ pressed }) => [
                styles.walletMenuOption,
                { backgroundColor: categoryFilter === 'uncategorized' ? colors.primary : colors.card, borderColor: categoryFilter === 'uncategorized' ? colors.primary : colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Feather name="tag" size={17} color={categoryFilter === 'uncategorized' ? colors.primaryForeground : colors.mutedForeground} />
              <Text style={[styles.walletMenuOptionText, { color: categoryFilter === 'uncategorized' ? colors.primaryForeground : colors.foreground }]}>Sem categoria</Text>
              {categoryFilter === 'uncategorized' ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
            </Pressable>
            {categories.map((category) => {
              const active = categoryFilter === category.id;
              return (
                <Pressable
                  key={category.id}
                  testID={`category-filter-option-${category.id}`}
                  onPress={() => {
                    setCategoryFilter(category.id);
                    setCategoryPickerOpen(false);
                    leaveSelectionMode();
                  }}
                  style={({ pressed }) => [
                    styles.walletMenuOption,
                    { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.categoryFilterDot, { backgroundColor: category.color }]} />
                  <Text numberOfLines={1} style={[styles.walletMenuOptionText, { color: active ? colors.primaryForeground : colors.foreground }]}>{category.name}</Text>
                  {active ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
       <Modal
         animationType="fade"
         transparent
         visible={cardPickerOpen}
         onRequestClose={() => setCardPickerOpen(false)}
       >
         <View style={styles.modalRoot}>
           <Pressable
             accessibilityLabel="Fechar seletor de cartão"
             onPress={() => setCardPickerOpen(false)}
             style={StyleSheet.absoluteFill}
           />
           <View style={[styles.walletMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <Text style={[styles.walletMenuTitle, { color: colors.foreground }]}>Filtrar por cartão</Text>
             <Pressable
               testID="card-filter-option-all"
               onPress={() => {
                 setCardFilter('all');
                 setCardPickerOpen(false);
                 leaveSelectionMode();
               }}
               style={({ pressed }) => [
                 styles.walletMenuOption,
                 { backgroundColor: cardFilter === 'all' ? colors.primary : colors.card, borderColor: cardFilter === 'all' ? colors.primary : colors.border },
                 pressed && styles.pressed,
               ]}
             >
               <Feather name="layers" size={17} color={cardFilter === 'all' ? colors.primaryForeground : colors.mutedForeground} />
               <Text style={[styles.walletMenuOptionText, { color: cardFilter === 'all' ? colors.primaryForeground : colors.foreground }]}>Todos os cartões</Text>
               {cardFilter === 'all' ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
             </Pressable>
             {cards.map((card) => {
               const active = cardFilter === card.id;
               return (
                 <Pressable
                   key={card.id}
                   testID={`card-filter-option-${card.id}`}
                   onPress={() => {
                     setCardFilter(card.id);
                     setCardPickerOpen(false);
                     leaveSelectionMode();
                   }}
                   style={({ pressed }) => [
                     styles.walletMenuOption,
                     { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border },
                     pressed && styles.pressed,
                   ]}
                 >
                   <Feather name="credit-card" size={17} color={active ? colors.primaryForeground : colors.mutedForeground} />
                   <Text numberOfLines={1} style={[styles.walletMenuOptionText, { color: active ? colors.primaryForeground : colors.foreground }]}>{card.name}</Text>
                   {active ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
                 </Pressable>
               );
             })}
           </View>
         </View>
       </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={batchEditOpen}
        onRequestClose={() => !batchEditSaving && setBatchEditOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar edição em lote"
            disabled={batchEditSaving}
            onPress={() => setBatchEditOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.batchEditCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.batchEditHeader}>
              <View style={[styles.batchEditIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="edit-3" size={18} color={colors.primary} />
              </View>
              <View style={styles.batchEditTitleBlock}>
                <Text style={[styles.confirmationTitle, { color: colors.foreground }]}>Editar selecionados</Text>
                <Text style={[styles.batchEditSubtitle, { color: colors.mutedForeground }]}>
                  Aplicar alterações a {selectedIds.length} {selectedIds.length === 1 ? 'lançamento' : 'lançamentos'}
                </Text>
              </View>
            </View>
            <ScrollView
              contentContainerStyle={styles.batchEditContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.batchEditLabel, { color: colors.foreground }]}>Status do pagamento</Text>
              <View style={styles.batchEditOptions}>
                {([
                  ['unchanged', 'Não alterar'],
                  ['paid', 'Pago'],
                  ['unpaid', 'Não pago'],
                ] as Array<[BatchPaymentStatus, string]>).map(([value, label]) => {
                  const active = batchPaymentStatus === value;
                  return (
                    <Pressable
                      key={value}
                      testID={`batch-status-${value}`}
                      onPress={() => setBatchPaymentStatus(value)}
                      style={[styles.batchEditOption, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                    >
                      <Text style={[styles.batchEditOptionText, { color: active ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={[styles.batchEditLabel, { color: colors.foreground }]}>Carteira</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.batchEditHorizontalOptions}>
                {[
                  { value: 'unchanged', label: 'Não alterar' },
                  ...wallets.map((wallet) => ({ value: wallet.id, label: wallet.title })),
                ].map((option) => {
                  const active = batchWalletId === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setBatchWalletId(option.value)}
                      style={[styles.batchEditOption, styles.batchEditWalletOption, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                    >
                      <Text numberOfLines={1} style={[styles.batchEditOptionText, { color: active ? colors.primaryForeground : colors.foreground }]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[styles.batchEditLabel, { color: colors.foreground }]}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.batchEditHorizontalOptions}>
                {[
                  { value: 'unchanged' as const, label: 'Não alterar' },
                  { value: 'none' as const, label: 'Sem categoria' },
                  ...categories.map((category) => ({ value: category.id, label: category.name })),
                ].map((option) => {
                  const active = batchCategoryId === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setBatchCategoryId(option.value)}
                      style={[styles.batchEditOption, styles.batchEditWalletOption, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                    >
                      <Text numberOfLines={1} style={[styles.batchEditOptionText, { color: active ? colors.primaryForeground : colors.foreground }]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[styles.batchEditLabel, { color: colors.foreground }]}>Vencimento</Text>
              <View style={styles.batchEditOptions}>
                {([
                  ['unchanged', 'Não alterar'],
                  ['clear', 'Limpar'],
                ] as Array<[BatchDueDate, string]>).map(([value, label]) => {
                  const active = batchDueDate === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setBatchDueDate(value)}
                      style={[styles.batchEditOption, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
                    >
                      <Text style={[styles.batchEditOptionText, { color: active ? colors.primaryForeground : colors.foreground }]}>{label}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setBatchDueDatePickerOpen(true)}
                  style={[styles.batchEditDateButton, { backgroundColor: batchDueDate !== 'unchanged' && batchDueDate !== 'clear' ? colors.primary : colors.card, borderColor: batchDueDate !== 'unchanged' && batchDueDate !== 'clear' ? colors.primary : colors.border }]}
                >
                  <Feather name="calendar" size={14} color={batchDueDate !== 'unchanged' && batchDueDate !== 'clear' ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={[styles.batchEditOptionText, { color: batchDueDate !== 'unchanged' && batchDueDate !== 'clear' ? colors.primaryForeground : colors.foreground }]}>
                    {batchDueDate !== 'unchanged' && batchDueDate !== 'clear' ? formatFilterDate(parseStoredDate(batchDueDate)) : 'Escolher data'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
            <View style={styles.batchEditActions}>
              <Pressable
                disabled={batchEditSaving}
                onPress={() => setBatchEditOpen(false)}
                style={({ pressed }) => [styles.confirmationCancel, { borderColor: colors.border }, batchEditSaving && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.confirmationCancelLabel, { color: colors.foreground }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                disabled={batchEditSaving}
                onPress={() => void applyBatchEdit()}
                style={({ pressed }) => [styles.confirmationDelete, { backgroundColor: colors.primary }, batchEditSaving && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.confirmationDeleteLabel}>{batchEditSaving ? 'Salvando...' : 'Aplicar alterações'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <DatePickerModal
        visible={batchDueDatePickerOpen}
        value={batchDueDate !== 'unchanged' && batchDueDate !== 'clear' ? parseStoredDate(batchDueDate) : getSaoPauloToday()}
        onClose={() => setBatchDueDatePickerOpen(false)}
        onConfirm={(date) => {
          setBatchDueDate(createLocalIsoDate(date));
          setBatchDueDatePickerOpen(false);
        }}
      />
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
            {deleteConfirmation?.options ? (
              <View style={styles.confirmationOptionStack}>
                {deleteConfirmation.options.map((option) => (
                  <Pressable
                    key={option.label}
                    accessibilityRole="button"
                    disabled={deleting}
                    onPress={() => void (async () => {
                      setDeleting(true);
                      try {
                        await option.onConfirm();
                        setDeleteConfirmation(null);
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      } catch {
                        Alert.alert('Não foi possível excluir', 'Tente novamente.');
                      } finally {
                        setDeleting(false);
                      }
                    })()}
                    style={({ pressed }) => [
                      styles.confirmationOption,
                      option.destructive
                        ? { backgroundColor: colors.expense, borderColor: colors.expense }
                        : { backgroundColor: colors.card, borderColor: colors.border },
                      deleting && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.confirmationOptionLabel, { color: option.destructive ? colors.destructiveForeground : colors.foreground }]}>
                      {deleting ? 'Excluindo...' : option.label}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  accessibilityRole="button"
                  disabled={deleting}
                  onPress={() => setDeleteConfirmation(null)}
                  style={({ pressed }) => [styles.confirmationCancel, { borderColor: colors.border }, pressed && styles.pressed]}
                >
                  <Text style={[styles.confirmationCancelLabel, { color: colors.foreground }]}>Cancelar</Text>
                </Pressable>
              </View>
            ) : (
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
                  <Text style={[styles.confirmationDeleteLabel, { color: colors.destructiveForeground }]}>
                    {deleting ? 'Excluindo...' : deleteConfirmation?.confirmLabel}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
      {paymentCelebration ? (
        <PaymentCelebration
          description={paymentCelebration}
          onDone={() => setPaymentCelebration(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  monthSelector: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  monthButton: { width: 25, height: 25, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthText: { maxWidth: 122, fontSize: 10, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'capitalize' },
  filtersPanel: { borderRadius: 9, borderWidth: 1, padding: 8, marginBottom: 14, gap: 7 },
  searchField: { minHeight: 36, borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, fontSize: 11, fontFamily: 'Inter_400Regular' },
  clearSearchButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  moreFiltersToggle: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  moreFiltersControl: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  moreFiltersLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  activeFiltersDot: { width: 6, height: 6, borderRadius: 3 },
  moreFiltersContent: { gap: 7, paddingTop: 1 },
  filterGroup: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  filterLabel: { width: 64, flexShrink: 0, marginLeft: 3, fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  filterRows: { flex: 1, gap: 5 },
  filterRow: { flexDirection: 'row', gap: 5 },
  filterOptions: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  recurrenceOptions: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 5 },
  filterChip: { minHeight: 28, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  filterChipText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  walletFilterCombo: { minHeight: 34, flex: 1, borderRadius: 6, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  walletFilterText: { flex: 1, minWidth: 0, fontSize: 10, fontFamily: 'Inter_500Medium' },
  clearFiltersAction: { alignSelf: 'flex-end', minHeight: 28, marginRight: 5, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 3 },
  clearFiltersLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  metrics: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  metric: { flex: 1, minHeight: 64, borderRadius: 8, borderWidth: 1, padding: 10, justifyContent: 'space-between' },
  metricLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  metricValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  listTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  listActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  count: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  exportAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5 },
  exportActionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  textAction: { paddingVertical: 5 },
  textActionLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  selectionActions: { gap: 7, marginBottom: 9 },
  selectionActionRow: { flexDirection: 'row', gap: 7 },
  secondaryAction: { minHeight: 34, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryActionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  editSelectedAction: { flex: 1, minHeight: 34, borderRadius: 7, paddingHorizontal: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  editSelectedLabel: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  deleteSelectedAction: { minHeight: 34, borderRadius: 7, paddingHorizontal: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  deleteSelectedLabel: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.72 },
  transactionGroup: { marginBottom: 7 },
  cardInvoicesSection: { marginTop: 16, gap: 8 },
  cardInvoicesHeader: { marginBottom: 1 },
  cardInvoicesHeaderCopy: { gap: 3 },
  cardInvoicesHint: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular' },
  cardInvoiceRow: { minHeight: 58, borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 9 },
  cardInvoiceIcon: { width: 31, height: 31, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cardInvoiceCopy: { flex: 1, minWidth: 0 },
  cardInvoiceTitle: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  cardInvoiceStatus: { fontSize: 10, fontFamily: 'Inter_500Medium', marginTop: 3 },
  cardInvoiceDueDate: { fontSize: 9, fontFamily: 'Inter_500Medium', marginTop: 2 },
  cardInvoiceAmount: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, marginBottom: 7 },
  groupLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'capitalize' },
  groupTotal: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  dateFilterContent: { flex: 1, gap: 5 },
  dateFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateFilterButton: { flex: 1, minHeight: 34, borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateFilterText: { flex: 1, fontSize: 9, fontFamily: 'Inter_500Medium' },
  dateFilterSeparator: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  dateFilterError: { fontSize: 9, fontFamily: 'Inter_500Medium' },
  walletMenu: { width: '100%', maxWidth: 350, borderRadius: 12, borderWidth: 1, padding: 13, gap: 7 },
  walletMenuTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  walletMenuOption: { minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  walletMenuOptionText: { flex: 1, minWidth: 0, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  categoryFilterDot: { width: 11, height: 11, borderRadius: 6 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.76)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  exportMenu: { width: '100%', maxWidth: 360, borderRadius: 12, borderWidth: 1, padding: 16, gap: 9 },
  exportMenuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  exportMenuTitleBlock: { flex: 1, minWidth: 0 },
  exportMenuEyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.1, textTransform: 'uppercase' },
  exportMenuTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 4 },
  closeButton: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  exportMenuDescription: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginBottom: 3 },
  exportOption: { minHeight: 62, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exportOptionIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  exportOptionCopy: { flex: 1, minWidth: 0 },
  exportOptionTitle: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  exportOptionDescription: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular', marginTop: 3 },
  confirmationCard: { width: '100%', maxWidth: 350, borderRadius: 12, borderWidth: 1, padding: 18, alignItems: 'center' },
  confirmationIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  confirmationTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  confirmationMessage: { marginTop: 7, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  confirmationActions: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 18 },
  confirmationOptionStack: { width: '100%', gap: 8, marginTop: 18 },
  confirmationOption: { minHeight: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  confirmationOptionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  confirmationCancel: { flex: 1, minHeight: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmationCancelLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  confirmationDelete: { flex: 1.35, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  confirmationDeleteLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  batchEditCard: { width: '100%', maxWidth: 370, maxHeight: '88%', borderRadius: 12, borderWidth: 1, padding: 16 },
  batchEditHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  batchEditIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  batchEditTitleBlock: { flex: 1, minWidth: 0 },
  batchEditSubtitle: { marginTop: 3, fontSize: 10, fontFamily: 'Inter_400Regular' },
  batchEditContent: { paddingTop: 5, paddingBottom: 4, gap: 8 },
  batchEditLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: 5 },
  batchEditOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  batchEditHorizontalOptions: { gap: 6 },
  batchEditOption: { minHeight: 36, borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  batchEditWalletOption: { maxWidth: 170 },
  batchEditOptionText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  batchEditDateButton: { minHeight: 36, borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  batchEditActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  monthSummary: { paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});