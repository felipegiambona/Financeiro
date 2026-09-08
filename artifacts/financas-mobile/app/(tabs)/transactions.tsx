import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { TransactionRow } from '@/components/TransactionRow';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';
import { calculateCurrentBalance, calculateForecast, calculateMonthlyTotals } from '@/services/financialRules';
import { getTransactionOccurrencesForMonth } from '@/services/recurrence';
import { formatCurrency } from '@/utils/currency';
import { formatMonthLabel, getDateKey, getMonthStart, shiftMonth } from '@/utils/date';
import { TransactionOccurrence } from '@/types/transaction';

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
  } = useFinance();
  const [selectedMonth, setSelectedMonth] = useState(getMonthStart(new Date()));
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const monthOptions = useMemo(() => [-2, -1, 0, 1, 2].map((offset) => shiftMonth(selectedMonth, offset)), [selectedMonth]);
  const selectedTransactions = useMemo(
    () => getTransactionOccurrencesForMonth(transactions, selectedMonth),
    [transactions, selectedMonth],
  );
  const currentBalance = calculateCurrentBalance(transactions);
  const forecast = calculateForecast(transactions);
  const monthlyTotals = calculateMonthlyTotals(transactions, selectedMonth);

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
        <View style={styles.metrics}>
          <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Saldo atual</Text>
            <Text style={[styles.metricValue, { color: colors.foreground }]}>{formatCurrency(currentBalance)}</Text>
          </View>
          <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Previsão</Text>
            <Text style={[styles.metricValue, { color: forecast >= 0 ? colors.income : colors.expense }]}>{formatCurrency(forecast)}</Text>
          </View>
        </View>
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : (
          <>
            <View style={styles.listHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Lançamentos</Text>
              <Text style={[styles.count, { color: colors.mutedForeground }]}>{selectedTransactions.length} {selectedTransactions.length === 1 ? 'item' : 'itens'}</Text>
            </View>
            {selectedTransactions.length === 0 ? (
              <EmptyState message="Não há lançamentos neste mês." />
            ) : (
              selectedTransactions.map((transaction) => (
                <TransactionRow
                  key={transaction.occurrenceKey}
                  transaction={transaction}
                  onPress={() => router.push({ pathname: '/transaction/new', params: { id: transaction.id } })}
                  onTogglePaymentStatus={() => void handleTogglePaymentStatus(transaction)}
                  paymentStatusUpdating={updatingStatusId === transaction.occurrenceKey}
                />
              ))
            )}
            {selectedTransactions.length > 0 ? (
              <View style={[styles.monthSummary, { borderTopColor: colors.border }]}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>No mês selecionado</Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]}>{formatCurrency(monthlyTotals.income - monthlyTotals.expense)}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
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
  metrics: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  metric: { flex: 1, minHeight: 64, borderRadius: 8, borderWidth: 1, padding: 10, justifyContent: 'space-between' },
  metricLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  metricValue: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  count: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  monthSummary: { borderTopWidth: 1, marginTop: 6, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});