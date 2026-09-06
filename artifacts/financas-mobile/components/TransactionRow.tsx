import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Transaction } from '@/types/transaction';
import { formatDate } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const colors = useColors();
  const isIncome = transaction.type === 'income';
  const tone = isIncome ? colors.income : colors.expense;
  const softTone = isIncome ? colors.incomeSoft : colors.expenseSoft;
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.typeIcon, { backgroundColor: softTone }]}>
        <Feather name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={18} color={tone} />
      </View>
      <View style={styles.details}>
        <Text numberOfLines={1} style={[styles.description, { color: colors.foreground }]}>{transaction.description}</Text>
        <View style={styles.meta}>
          <Text style={[styles.date, { color: colors.mutedForeground }]}>{formatDate(transaction.date)}</Text>
          {transaction.recurrence.kind === 'recurring' ? (
            <View style={[styles.recurrence, { backgroundColor: colors.secondary }]}>
              <Feather name="repeat" size={10} color={colors.secondaryForeground} />
              <Text style={[styles.recurrenceText, { color: colors.secondaryForeground }]}>Recorrente</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Text style={[styles.amount, { color: tone }]}>{isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 74, borderRadius: 18, borderWidth: 1, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 9 },
  typeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, minWidth: 0, gap: 7 },
  description: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  date: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  recurrence: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 3 },
  recurrenceText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  amount: { fontSize: 13, fontFamily: 'Inter_700Bold', textAlign: 'right' },
});