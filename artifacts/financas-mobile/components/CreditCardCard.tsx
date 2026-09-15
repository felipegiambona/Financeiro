import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { formatCurrency } from '@/utils/currency';
import type { Card } from '@/types/card';

interface CreditCardCardProps {
  card: Card;
  onPress?: () => void;
  onPay?: () => void;
  paying?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function CreditCardCard({ card, onPress, onPay, paying = false, style }: CreditCardCardProps) {
  const colors = useColors();
  const isClosed = card.invoiceStatus === 'closed';
  const isPaid = card.invoiceStatus === 'paid';
  const isOverdue = card.invoiceStatus === 'overdue';
  const hasInvoiceAmount = card.currentInvoiceAmount > 0;
  const cardSummary = (
    <>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: colors.primary }]}>
          <Feather name="credit-card" size={18} color={colors.primaryForeground} />
        </View>
        <View style={styles.titleCopy}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.foreground }]}>{card.name}</Text>
          <Text style={[styles.schedule, { color: colors.mutedForeground }]}>
            Vencimento dia {card.dueDay}
            {'\n'}
            Fecha dia {card.closingDay}
          </Text>
        </View>
        <View style={[styles.status, { backgroundColor: isOverdue ? colors.expenseSoft : isClosed ? colors.pendingSoft : colors.paidSoft }]}>
          <View style={[styles.statusDot, { backgroundColor: isOverdue ? colors.expense : isClosed ? colors.pending : colors.paid }]} />
          <Text style={[styles.statusText, { color: isOverdue ? colors.expense : isClosed ? colors.pending : colors.paid }]}>
            {isPaid ? 'Paga' : isOverdue ? 'Atrasada' : isClosed ? 'Fechada' : 'Aberta'}
          </Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Fatura atual</Text>
          <Text style={[styles.metricValue, { color: colors.expense }]}>{formatCurrency(card.currentInvoiceAmount)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Limite disponível</Text>
          <Text style={[styles.metricValue, { color: colors.foreground }]}>
            {card.availableLimit == null ? 'Não informado' : formatCurrency(card.availableLimit)}
          </Text>
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir detalhes do cartão ${card.name}`}
          onPress={onPress}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          {cardSummary}
        </Pressable>
      ) : cardSummary}

      {onPay ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hasInvoiceAmount ? `Pagar fatura do cartão ${card.name}` : `Nenhum lançamento na fatura do cartão ${card.name}`}
          testID={`pay-card-invoice-${card.id}`}
          disabled={paying || !hasInvoiceAmount || isPaid}
          onStartShouldSetResponder={() => true}
          onPress={(event) => {
            event.stopPropagation();
            onPay();
          }}
          style={({ pressed }) => [
            styles.payButton,
            { backgroundColor: colors.secondary, borderColor: colors.border },
            (paying || card.currentInvoiceAmount <= 0 || isPaid) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="check-circle" size={15} color={colors.foreground} />
          <Text style={[styles.payText, { color: colors.foreground }]}>
            {paying ? 'Pagando...' : isPaid ? 'Fatura paga' : isOverdue ? 'Pagar fatura atrasada' : hasInvoiceAmount ? 'Pagar fatura' : 'Sem lançamentos'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 13, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  schedule: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular', marginTop: 3 },
  status: { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  metrics: { flexDirection: 'row', gap: 12, marginTop: 16 },
  metric: { flex: 1, minWidth: 0 },
  metricLabel: { fontSize: 9, fontFamily: 'Inter_500Medium' },
  metricValue: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 4 },
  payButton: { minHeight: 36, borderWidth: 1, borderRadius: 7, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  payText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.48 },
  pressed: { opacity: 0.72 },
});