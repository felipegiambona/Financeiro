import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ForecastTable } from '@/components/ForecastTable';
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
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const selectedMonth = totals.find((month) => month.key === selectedMonthKey) ?? totals[totals.length - 1];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Análise" title="Gráficos" />
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : (
          <>
            {!hasData ? (
              <EmptyState message="Não há dados suficientes para exibir o gráfico." />
            ) : (
              <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.chartTitle, { color: colors.foreground }]}>Receitas x Despesas</Text>
                <Text style={[styles.chartDescription, { color: colors.mutedForeground }]}>Toque no gráfico para consultar os valores de cada mês</Text>
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
                    <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Receitas</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
                    <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Despesas</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.chart}
                  onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}
                  onPress={(event) => {
                    if (chartWidth <= 0) return;
                    const index = Math.min(
                      totals.length - 1,
                      Math.floor((event.nativeEvent.locationX / chartWidth) * totals.length),
                    );
                    setSelectedMonthKey(totals[index].key);
                  }}
                  accessibilityRole="adjustable"
                  accessibilityLabel="Gráfico de receitas e despesas por mês"
                  accessibilityHint="Toque em uma área do gráfico para selecionar o mês"
                >
                  {totals.map((month) => (
                    <View
                      key={month.key}
                      style={[
                        styles.chartColumn,
                        selectedMonth?.key === month.key && { backgroundColor: colors.muted, borderRadius: 6 },
                      ]}
                    >
                      <View style={styles.barArea}>
                        <View style={styles.barGroup}>
                          <View style={[styles.bar, { height: Math.max(month.income / maxValue * 144, month.income > 0 ? 5 : 0), backgroundColor: colors.income }]} />
                          <View style={[styles.bar, { height: Math.max(month.expense / maxValue * 144, month.expense > 0 ? 5 : 0), backgroundColor: colors.expense }]} />
                        </View>
                      </View>
                      <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>{formatShortMonthLabel(month.date)}</Text>
                    </View>
                  ))}
                </Pressable>
                {selectedMonth && (
                  <View style={[styles.chartFooter, { borderTopColor: colors.border }]}>
                    <View style={styles.footerHeader}>
                      <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>Maior movimento</Text>
                      <Text style={[styles.selectedMonthLabel, { color: colors.foreground }]}>
                        {formatShortMonthLabel(selectedMonth.date)}
                      </Text>
                    </View>
                    <View style={styles.monthSelector} accessibilityLabel="Selecionar mês">
                      {totals.map((month) => {
                        const isSelected = month.key === selectedMonth.key;
                        return (
                          <Pressable
                            key={month.key}
                            onPress={() => setSelectedMonthKey(month.key)}
                            style={[
                              styles.monthChip,
                              {
                                backgroundColor: isSelected ? colors.primary : colors.muted,
                                borderColor: isSelected ? colors.primary : colors.border,
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={`Selecionar ${formatShortMonthLabel(month.date)}`}
                          >
                            <Text style={[styles.monthChipText, { color: isSelected ? colors.primaryForeground : colors.mutedForeground }]}>
                              {formatShortMonthLabel(month.date)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={styles.movementRows}>
                      <View style={styles.movementRow}>
                        <View style={styles.movementLabel}>
                          <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
                          <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>Receitas</Text>
                        </View>
                        <Text style={[styles.footerValue, { color: colors.income }]}>
                          {formatCurrency(selectedMonth.income)}
                        </Text>
                      </View>
                      <View style={styles.movementRow}>
                        <View style={styles.movementLabel}>
                          <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
                          <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>Despesas</Text>
                        </View>
                        <Text style={[styles.footerValue, { color: colors.expense }]}>
                          {formatCurrency(selectedMonth.expense)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}
            <ForecastTable transactions={transactions} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16 },
  chartCard: { borderRadius: 8, borderWidth: 1, padding: 16 },
  chartTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  chartDescription: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4 },
  legend: { flexDirection: 'row', gap: 14, marginTop: 15 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  chart: { height: 180, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5, marginTop: 12 },
  chartColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 9, paddingTop: 5 },
  barArea: { height: 138, width: '100%', justifyContent: 'flex-end' },
  barGroup: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: '100%' },
  bar: { width: 7, minHeight: 0, borderRadius: 2 },
  monthLabel: { fontSize: 9, fontFamily: 'Inter_600SemiBold' },
  chartFooter: { borderTopWidth: 1, paddingTop: 12, marginTop: 14 },
  footerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  footerValue: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  selectedMonthLabel: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  monthSelector: { flexDirection: 'row', gap: 5, marginTop: 10 },
  monthChip: { minWidth: 35, borderRadius: 12, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5, alignItems: 'center' },
  monthChipText: { fontSize: 9, fontFamily: 'Inter_700Bold' },
  movementRows: { gap: 9, marginTop: 12 },
  movementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  movementLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});