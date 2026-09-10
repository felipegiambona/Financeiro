import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { TransactionOccurrence } from '@/types/transaction';
import { formatCurrency } from '@/utils/currency';

interface TransactionRowProps {
  transaction: TransactionOccurrence;
  onPress?: () => void;
  onTogglePaymentStatus?: () => void;
  onDelete?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelection?: () => void;
  paymentStatusUpdating?: boolean;
}

export function TransactionRow({
  transaction,
  onPress,
  onTogglePaymentStatus,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelection,
  paymentStatusUpdating = false,
}: TransactionRowProps) {
  const colors = useColors();
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const tone = isTransfer ? colors.primary : isIncome ? colors.income : colors.expense;
  const softTone = isTransfer ? colors.secondary : isIncome ? colors.incomeSoft : colors.expenseSoft;
  const isPaid = transaction.paymentStatus === 'paid';
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {selectionMode ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`${selected ? 'Desmarcar' : 'Selecionar'} ${transaction.description}`}
          onPress={onToggleSelection}
          style={[
            styles.checkbox,
            { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card },
          ]}
        >
          {selected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={selectionMode ? `${selected ? 'Desmarcar' : 'Selecionar'} ${transaction.description}` : onPress ? `Editar ${transaction.description}` : undefined}
        disabled={selectionMode ? !onToggleSelection : !onPress}
        onPress={selectionMode ? onToggleSelection : onPress}
        style={({ pressed }) => [styles.editArea, pressed && styles.pressed]}
      >
        <View style={[styles.typeIcon, { backgroundColor: softTone }]}>
          <Feather name={isTransfer ? 'repeat' : isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={18} color={tone} />
        </View>
        <View style={styles.details}>
          <Text numberOfLines={1} style={[styles.description, { color: colors.foreground }]}>{transaction.description}</Text>
          <View style={styles.meta}>
            {transaction.recurrence.kind !== 'none' ? (
              <View style={[styles.recurrence, { backgroundColor: colors.secondary }]}>
                <Feather name="repeat" size={10} color={colors.secondaryForeground} />
                <Text style={[styles.recurrenceText, { color: colors.secondaryForeground }]}>
                  {transaction.recurrence.kind === 'installment' ? 'Parcelado' : 'Recorrente'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={styles.trailing}>
        <Text style={[styles.amount, { color: tone }]}>{isTransfer ? '' : isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Marcar ${transaction.description} como ${isPaid ? 'não pago' : 'pago'}`}
          testID={`toggle-payment-status-${transaction.occurrenceKey}`}
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
      {!selectionMode && onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Excluir ${transaction.description}`}
          hitSlop={6}
          onPress={onDelete}
          style={({ pressed }) => [styles.deleteButton, { borderColor: colors.border }, pressed && styles.pressed]}
        >
          <Feather name="trash-2" size={14} color={colors.expense} />
        </Pressable>
      ) : null}
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
  recurrence: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  recurrenceText: { fontSize: 8, fontFamily: 'Inter_500Medium' },
  status: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  statusText: { fontSize: 8, fontFamily: 'Inter_600SemiBold' },
  amount: { fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  trailing: { alignItems: 'flex-end', gap: 5 },
  updating: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});