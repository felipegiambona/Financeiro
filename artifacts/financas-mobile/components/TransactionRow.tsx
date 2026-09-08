import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Transaction } from '@/types/transaction';
import { formatDate } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';

interface TransactionRowProps {
  transaction: Transaction;
  onPress?: () => void;
  onTogglePaymentStatus?: () => void;
  paymentStatusUpdating?: boolean;
}

export function TransactionRow({
  transaction,
  onPress,
  onTogglePaymentStatus,
  paymentStatusUpdating = false,
}: TransactionRowProps) {
  const colors = useColors();
  const isIncome = transaction.type === 'income';
  const tone = isIncome ? colors.income : colors.expense;
  const softTone = isIncome ? colors.incomeSoft : colors.expenseSoft;
  const isPaid = transaction.paymentStatus === 'paid';
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `Editar ${transaction.description}` : undefined}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.editArea, pressed && styles.pressed]}
      >
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
      </Pressable>
      <View style={styles.trailing}>
        <Text style={[styles.amount, { color: tone }]}>{isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Marcar ${transaction.description} como ${isPaid ? 'não pago' : 'pago'}`}
          testID={`toggle-payment-status-${transaction.id}`}
          disabled={!onTogglePaymentStatus || paymentStatusUpdating}
          onPress={onTogglePaymentStatus}
          style={({ pressed }) => [
            styles.status,
            { backgroundColor: isPaid ? colors.paidSoft : colors.pendingSoft },
            paymentStatusUpdating && styles.updating,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.statusText, { color: isPaid ? colors.paid : colors.pending }]}>
            {paymentStatusUpdating ? 'Salvando...' : isPaid ? 'Pago' : 'Não pago'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  editArea: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeIcon: { width: 29, height: 29, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, minWidth: 0, gap: 3 },
  description: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  date: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  recurrence: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  recurrenceText: { fontSize: 8, fontFamily: 'Inter_500Medium' },
  status: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  statusText: { fontSize: 8, fontFamily: 'Inter_600SemiBold' },
  amount: { fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  trailing: { alignItems: 'flex-end', gap: 5 },
  updating: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});