import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { calculateForecastByMonth } from '@/services/financialRules';
import { Transaction } from '@/types/transaction';
import { Card } from '@/types/card';
import { formatCurrency } from '@/utils/currency';
import { getSaoPauloToday, SAO_PAULO_TIME_ZONE } from '@/utils/date';

export function ForecastTable({ transactions, cards = [] }: { transactions: Transaction[]; cards?: Card[] }) {
  const colors = useColors();
  const [selectedYear, setSelectedYear] = useState(getSaoPauloToday().getFullYear());
  const forecasts = useMemo(
    () => calculateForecastByMonth(transactions, selectedYear, cards),
    [cards, transactions, selectedYear],
  );

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>Previsão por mês</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Resultado previsto apenas dos lançamentos de cada mês</Text>
        </View>
        <View style={styles.yearSelector}>
          <Pressable
            accessibilityLabel="Ano anterior"
            hitSlop={8}
            onPress={() => setSelectedYear((year) => year - 1)}
            style={({ pressed }) => [styles.yearButton, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Feather name="chevron-left" size={15} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.year, { color: colors.foreground }]}>{selectedYear}</Text>
          <Pressable
            accessibilityLabel="Próximo ano"
            hitSlop={8}
            onPress={() => setSelectedYear((year) => year + 1)}
            style={({ pressed }) => [styles.yearButton, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Feather name="chevron-right" size={15} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerText, { color: colors.mutedForeground }]}>Mês</Text>
        <Text style={[styles.headerText, { color: colors.mutedForeground }]}>Previsão</Text>
      </View>

      {forecasts.map((item, index) => (
        <View
          key={item.key}
          style={[styles.row, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}
        >
          <Text style={[styles.month, { color: colors.foreground }]}>
            {new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: SAO_PAULO_TIME_ZONE }).format(item.date)}
          </Text>
          <Text style={[styles.value, { color: item.forecast < 0 ? colors.expense : colors.foreground }]}>
            {formatCurrency(item.forecast)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderWidth: 1, borderRadius: 8, marginTop: 14, paddingHorizontal: 12, paddingVertical: 13 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 7, marginBottom: 14 },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular', marginTop: 3 },
  yearSelector: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  yearButton: { width: 25, height: 25, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  year: { minWidth: 34, fontSize: 12, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  tableHeader: { borderBottomWidth: 1, paddingBottom: 7, flexDirection: 'row', justifyContent: 'space-between' },
  headerText: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.7 },
  row: { minHeight: 31, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 12, fontFamily: 'Inter_500Medium', textTransform: 'capitalize' },
  value: { fontSize: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  pressed: { opacity: 0.6 },
});