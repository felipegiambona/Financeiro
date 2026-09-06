import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';
import { calculateTotalsByMonth } from '@/services/financialRules';
import { formatCurrency } from '@/utils/currency';
import { formatShortMonthLabel } from '@/utils/date';

export default function ChartsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, loading, error, refresh } = useFinance();
  const totals = useMemo(() => calculateTotalsByMonth(transactions), [transactions]);
  const hasData = totals.some((month) => month.income > 0 || month.expense > 0);
  const maxValue = Math.max(...totals.flatMap((month) => [month.income, month.expense]), 1);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}>
        <ScreenHeader eyebrow="Análise" title="Gráficos" />
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : !hasData ? (
          <EmptyState message="Não há dados suficientes para exibir o gráfico." />
        ) : (
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>Receitas x despesas por mês</Text>
            <Text style={[styles.chartDescription, { color: colors.mutedForeground }]}>Uma visão dos últimos seis meses</Text>
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.income }]} /><Text style={[styles.legendText, { color: colors.mutedForeground }]}>Receitas</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: colors.expense }]} /><Text style={[styles.legendText, { color: colors.mutedForeground }]}>Despesas</Text></View>
            </View>
            <View style={styles.chart}>
              {totals.map((month) => (
                <View key={month.key} style={styles.chartColumn}>
                  <View style={styles.barArea}>
                    <View style={styles.barGroup}>
                      <View style={[styles.bar, { height: Math.max(month.income / maxValue * 144, month.income > 0 ? 5 : 0), backgroundColor: colors.income }]} />
                      <View style={[styles.bar, { height: Math.max(month.expense / maxValue * 144, month.expense > 0 ? 5 : 0), backgroundColor: colors.expense }]} />
                    </View>
                  </View>
                  <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>{formatShortMonthLabel(month.date)}</Text>
                </View>
              ))}
            </View>
            <View style={[styles.chartFooter, { borderTopColor: colors.border }]}>
              <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>Maior movimento</Text>
              <Text style={[styles.footerValue, { color: colors.foreground }]}>{formatCurrency(maxValue)}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },
  chartCard: { borderRadius: 24, borderWidth: 1, padding: 20 },
  chartTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  chartDescription: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 6 },
  legend: { flexDirection: 'row', gap: 18, marginTop: 21 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  chart: { height: 205, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 7, marginTop: 16 },
  chartColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 9 },
  barArea: { height: 158, width: '100%', justifyContent: 'flex-end' },
  barGroup: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: '100%' },
  bar: { width: 9, minHeight: 0, borderRadius: 5 },
  monthLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  chartFooter: { borderTopWidth: 1, paddingTop: 15, marginTop: 18, flexDirection: 'row', justifyContent: 'space-between' },
  footerLabel: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  footerValue: { fontSize: 13, fontFamily: 'Inter_700Bold' },
});