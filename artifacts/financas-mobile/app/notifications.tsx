import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';
import { getPendingTransactionOccurrences, formatPendingTransactionDate } from '@/services/pendingNotifications';
import { formatCurrency } from '@/utils/currency';
import { TransactionOccurrence } from '@/types/transaction';

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, loading, error, refresh, updateTransaction, updateTransactionOccurrencePaymentStatus } = useFinance();
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const pendingTransactions = useMemo(() => getPendingTransactionOccurrences(transactions), [transactions]);

  const markAsPaid = async (transaction: TransactionOccurrence) => {
    try {
      setUpdatingKey(transaction.occurrenceKey);
      if (transaction.recurrence.kind !== 'none') {
        await updateTransactionOccurrencePaymentStatus(transaction.sourceId, transaction.date, 'paid');
      } else {
        await updateTransaction(transaction.sourceId, { paymentStatus: 'paid' });
      }
    } catch {
      Alert.alert('Não foi possível atualizar', 'Tente marcar o lançamento como pago novamente.');
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Atenção" title="Notificações" showBack />
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : pendingTransactions.length === 0 ? (
          <EmptyState message="Você não tem pendências a analisar." />
        ) : (
          <>
            <View style={[styles.summaryCard, { backgroundColor: colors.pendingSoft, borderColor: colors.pending }]}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.pending }]}>
                <Feather name="bell" size={17} color={colors.background} />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Você tem pendências a analisar</Text>
                <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
                  {pendingTransactions.length} {pendingTransactions.length === 1 ? 'lançamento precisa' : 'lançamentos precisam'} da sua atenção.
                </Text>
              </View>
            </View>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Lançamentos pendentes</Text>
            <View style={styles.pendingList}>
              {pendingTransactions.map((transaction) => {
                const isIncome = transaction.type === 'income';
                const isTransfer = transaction.type === 'transfer';
                const tone = isTransfer ? colors.primaryForeground : isIncome ? colors.income : colors.expense;
                const softTone = isTransfer ? colors.secondary : isIncome ? colors.incomeSoft : colors.expenseSoft;
                const icon = isTransfer ? 'repeat' : isIncome ? 'arrow-down-left' : 'arrow-up-right';
                const isUpdating = updatingKey === transaction.occurrenceKey;

                return (
                  <View key={transaction.occurrenceKey} style={[styles.pendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.pendingTop}>
                      <View style={[styles.transactionIcon, { backgroundColor: softTone }]}>
                        <Feather name={icon} size={17} color={tone} />
                      </View>
                      <View style={styles.transactionCopy}>
                        <Text numberOfLines={1} style={[styles.description, { color: colors.foreground }]}>{transaction.description}</Text>
                        <Text style={[styles.date, { color: colors.pending }]}>
                          {formatPendingTransactionDate(transaction.date)}
                          {transaction.recurrence.kind === 'installment'
                            ? ' · Parcelado'
                            : transaction.recurrence.kind === 'recurring' ? ' · Recorrente' : ''}
                        </Text>
                      </View>
                      <Text style={[styles.amount, { color: tone }]}>
                        {isTransfer ? '' : isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}
                      </Text>
                    </View>
                    <View style={[styles.pendingBottom, { borderTopColor: colors.border }]}>
                      <Text style={[styles.status, { color: colors.pending }]}>Não pago</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Marcar ${transaction.description} como pago`}
                        testID={`notification-pay-${transaction.occurrenceKey}`}
                        disabled={isUpdating}
                        onPress={() => void markAsPaid(transaction)}
                        style={({ pressed }) => [
                          styles.payButton,
                          { backgroundColor: colors.primary },
                          isUpdating && styles.updating,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.payButtonText, { color: colors.primaryForeground }]}>
                          {isUpdating ? 'Salvando...' : 'Marcar como pago'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  summaryCard: { borderWidth: 1, borderRadius: 9, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 },
  summaryIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  summaryText: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 3 },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  pendingList: { gap: 8 },
  pendingCard: { borderWidth: 1, borderRadius: 9, padding: 11 },
  pendingTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  transactionIcon: { width: 31, height: 31, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  transactionCopy: { flex: 1, minWidth: 0 },
  description: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  date: { fontSize: 10, fontFamily: 'Inter_500Medium', marginTop: 3 },
  amount: { fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  pendingBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 9, borderTopWidth: 1 },
  status: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  payButton: { minHeight: 28, borderRadius: 6, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  payButtonText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  updating: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});