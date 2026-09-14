import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ForecastTable } from '@/components/ForecastTable';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useFinance } from '@/context/FinanceContext';
import { useCategories } from '@/context/CategoryContext';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';
import { useInvestments } from '@/context/InvestmentContext';
import { useCards } from '@/context/CardContext';
import { useColors } from '@/hooks/useColors';
import type { Investment, InvestmentAssetType } from '@workspace/api-client-react';
import { calculateTotalsByMonth } from '@/services/financialRules';
import { getTransactionOccurrencesForMonth } from '@/services/recurrence';
import { formatCurrency } from '@/utils/currency';
import { formatMonthYearLabel, formatShortMonthLabel, shiftMonth } from '@/utils/date';

export default function ChartsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, loading, error, refresh } = useFinance();
  const { categories } = useCategories();
  const { cards } = useCards();
  const { activeProfile } = useFinancialProfiles();
  const {
    investments,
    loading: investmentsLoading,
    error: investmentsError,
    refresh: refreshInvestments,
  } = useInvestments();
  const totals = useMemo(() => calculateTotalsByMonth(transactions, 6, cards), [cards, transactions]);
  const hasData = totals.some((month) => month.income > 0 || month.expense > 0);
  const maxValue = Math.max(...totals.flatMap((month) => [month.income, month.expense]), 1);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [categoryMonth, setCategoryMonth] = useState(() => shiftMonth(new Date(), 0));
  const [chartWidth, setChartWidth] = useState(0);
  const selectedMonth = totals.find((month) => month.key === selectedMonthKey) ?? totals[totals.length - 1];
  const selectedMonthIndex = selectedMonth ? totals.findIndex((month) => month.key === selectedMonth.key) : -1;
  const categoryTotals = useMemo(() => {
    const totalsByCategory = new Map<string, number>();
    for (const transaction of getTransactionOccurrencesForMonth(transactions, categoryMonth)) {
      if (transaction.type !== 'expense' || transaction.cardId) continue;
      const key = transaction.categoryId ?? 'uncategorized';
      totalsByCategory.set(key, (totalsByCategory.get(key) ?? 0) + transaction.amount);
    }
    const cardInvoiceTotal = cards.reduce(
      (total, card) => total + card.invoices
        .filter((invoice) => invoice.invoiceMonth === `${categoryMonth.getFullYear()}-${String(categoryMonth.getMonth() + 1).padStart(2, '0')}`)
        .reduce((invoiceTotal, invoice) => invoiceTotal + invoice.amount, 0),
      0,
    );
    if (cardInvoiceTotal > 0) totalsByCategory.set('uncategorized', (totalsByCategory.get('uncategorized') ?? 0) + cardInvoiceTotal);
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    return Array.from(totalsByCategory.entries())
      .map(([key, amount]) => ({
        key,
        amount,
        name: key === 'uncategorized' ? 'Sem categoria' : categoryById.get(key)?.name ?? 'Sem categoria',
        color: key === 'uncategorized' ? colors.mutedForeground : categoryById.get(key)?.color ?? colors.mutedForeground,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [cards, categories, categoryMonth, colors.mutedForeground, transactions]);
  const categoryTotal = categoryTotals.reduce((total, item) => total + item.amount, 0);
  const [incomeCategoryMonth, setIncomeCategoryMonth] = useState(() => shiftMonth(new Date(), 0));
  const incomeCategoryTotals = useMemo(() => {
    const totalsByCategory = new Map<string, number>();
    for (const transaction of getTransactionOccurrencesForMonth(transactions, incomeCategoryMonth)) {
      if (transaction.type !== 'income') continue;
      const key = transaction.categoryId ?? 'uncategorized';
      totalsByCategory.set(key, (totalsByCategory.get(key) ?? 0) + transaction.amount);
    }
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    return Array.from(totalsByCategory.entries())
      .map(([key, amount]) => ({
        key,
        amount,
        name: key === 'uncategorized' ? 'Sem categoria' : categoryById.get(key)?.name ?? 'Sem categoria',
        color: key === 'uncategorized' ? colors.mutedForeground : categoryById.get(key)?.color ?? colors.mutedForeground,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [categories, colors.mutedForeground, incomeCategoryMonth, transactions]);
  const incomeCategoryTotal = incomeCategoryTotals.reduce((total, item) => total + item.amount, 0);

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
                    <View style={styles.totalsHeader}>
                      <Text style={[styles.totalsTitle, { color: colors.foreground }]}>Totais</Text>
                      <View style={styles.chartMonthSelectorRow}>
                        <MonthSelector
                          month={selectedMonth.date}
                          onPrevious={() => {
                            if (selectedMonthIndex > 0) setSelectedMonthKey(totals[selectedMonthIndex - 1].key);
                          }}
                          onNext={() => {
                            if (selectedMonthIndex >= 0 && selectedMonthIndex < totals.length - 1) {
                              setSelectedMonthKey(totals[selectedMonthIndex + 1].key);
                            }
                          }}
                          previousDisabled={selectedMonthIndex <= 0}
                          nextDisabled={selectedMonthIndex < 0 || selectedMonthIndex >= totals.length - 1}
                          accessibilityPrefix="Receitas e despesas"
                        />
                      </View>
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
            <CategoryReport
              title={<>Gastos por{'\n'}categoria</>}
              description="Veja como os gastos se distribuem entre as categorias"
              month={categoryMonth}
              onPrevious={() => setCategoryMonth((month) => shiftMonth(month, -1))}
              onNext={() => setCategoryMonth((month) => shiftMonth(month, 1))}
              accessibilityPrefix="Gastos por categoria"
              totals={categoryTotals}
              total={categoryTotal}
              amountColor={colors.expense}
              emptyMessage="Não há despesas para analisar neste mês."
              percentageLabel="dos gastos"
            />
            <CategoryReport
              title={<>Receitas por{'\n'}categoria</>}
              description="Veja como as receitas se distribuem entre as categorias"
              month={incomeCategoryMonth}
              onPrevious={() => setIncomeCategoryMonth((month) => shiftMonth(month, -1))}
              onNext={() => setIncomeCategoryMonth((month) => shiftMonth(month, 1))}
              accessibilityPrefix="Receitas por categoria"
              totals={incomeCategoryTotals}
              total={incomeCategoryTotal}
              amountColor={colors.income}
              emptyMessage="Não há receitas para analisar neste mês."
              percentageLabel="das receitas"
            />
            <ForecastTable transactions={transactions} cards={cards} />
          </>
        )}
        {activeProfile?.type === 'personal' ? (
          <InvestmentCompositionCard
            investments={investments}
            loading={investmentsLoading}
            error={investmentsError}
            onRetry={() => void refreshInvestments()}
              onAssetTypePress={(assetType) => router.push({ pathname: '/more/investments', params: { assetType } })}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16 },
  chartCard: { borderRadius: 8, borderWidth: 1, padding: 16 },
  categoryCard: { borderRadius: 8, borderWidth: 1, padding: 16, marginTop: 12 },
  investmentCard: { borderRadius: 8, borderWidth: 1, padding: 16, marginTop: 12 },
  categoryTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  categoryTitleCopy: { flex: 1, minWidth: 0 },
  chartTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  categoryTitle: { lineHeight: 19 },
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
  totalsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  totalsTitle: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  chartMonthSelectorRow: { alignItems: 'flex-end' },
  footerLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  footerValue: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  monthSelector: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  monthButton: { width: 25, height: 25, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthText: { maxWidth: 122, fontSize: 10, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'capitalize' },
  movementRows: { gap: 9, marginTop: 12 },
  movementRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  movementLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryEmpty: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 18 },
  categoryRows: { gap: 16, marginTop: 18 },
  categoryRow: { gap: 5 },
  categoryRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  categoryLabel: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  categoryName: { flex: 1, minWidth: 0, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  categoryAmountGroup: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  categoryAmount: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  categoryTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  categoryBar: { height: '100%', borderRadius: 4 },
  categoryPercentage: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  investmentSummary: { flexDirection: 'row', gap: 10, marginTop: 14 },
  investmentMetric: { flex: 1, minWidth: 0 },
  investmentMetricLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  investmentMetricValue: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 4 },
  investmentState: { minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  investmentStateText: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  investmentRetry: { borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, marginTop: 2 },
  investmentRetryText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
});

type CategoryTotal = {
  key: string;
  amount: number;
  name: string;
  color: string;
};

const ASSET_TYPE_LABELS: Record<InvestmentAssetType, string> = {
  stock: 'Ações',
  fii: 'FIIs',
  etf: 'ETFs',
  fund: 'Fundos',
  fixed_income: 'Renda fixa',
  crypto: 'Cripto',
  other: 'Outros',
};

function InvestmentCompositionCard({
  investments,
  loading,
  error,
  onRetry,
  onAssetTypePress,
}: {
  investments: Investment[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAssetTypePress: (assetType: InvestmentAssetType) => void;
}) {
  const colors = useColors();
  const totalCurrentValue = useMemo(
    () => investments.reduce((total, investment) => total + investment.currentValue, 0),
    [investments],
  );
  const totalReturn = useMemo(
    () => investments.reduce((total, investment) => total + investment.returnAmount, 0),
    [investments],
  );
  const composition = useMemo(() => {
    const totalsByType = new Map<InvestmentAssetType, number>();
    for (const investment of investments) {
      totalsByType.set(investment.assetType, (totalsByType.get(investment.assetType) ?? 0) + investment.currentValue);
    }
    const palette = [
      colors.primary,
      colors.income,
      colors.accent,
      colors.expense,
      colors.pending,
      colors.transfer,
      colors.secondaryForeground,
    ];
    return Array.from(totalsByType.entries())
      .sort((first, second) => second[1] - first[1])
      .map(([assetType, amount], index) => ({
        assetType,
        amount,
        color: palette[index % palette.length],
      }));
  }, [colors.accent, colors.expense, colors.income, colors.pending, colors.primary, colors.secondaryForeground, colors.transfer, investments]);

  return (
    <View style={[styles.investmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.chartTitle, { color: colors.foreground }]}>Composição da carteira</Text>
      <Text style={[styles.chartDescription, { color: colors.mutedForeground }]}>Distribuição dos investimentos por tipo de ativo</Text>
      {loading ? (
        <View style={styles.investmentState}>
          <Text style={[styles.investmentStateText, { color: colors.mutedForeground }]}>Carregando investimentos...</Text>
        </View>
      ) : error ? (
        <View style={styles.investmentState}>
          <Feather name="alert-circle" size={20} color={colors.expense} />
          <Text style={[styles.investmentStateText, { color: colors.mutedForeground }]}>Não foi possível carregar sua carteira.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tentar carregar composição da carteira novamente"
            onPress={onRetry}
            style={({ pressed }) => [styles.investmentRetry, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <Text style={styles.investmentRetryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : investments.length === 0 ? (
        <View style={styles.investmentState}>
          <Feather name="bar-chart" size={20} color={colors.mutedForeground} />
          <Text style={[styles.investmentStateText, { color: colors.mutedForeground }]}>Cadastre investimentos para visualizar a composição da sua carteira.</Text>
        </View>
      ) : (
        <>
          <View style={styles.investmentSummary}>
            <View style={styles.investmentMetric}>
              <Text style={[styles.investmentMetricLabel, { color: colors.mutedForeground }]}>Valor atual</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.investmentMetricValue, { color: colors.foreground }]}>
                {formatCurrency(totalCurrentValue)}
              </Text>
            </View>
            <View style={styles.investmentMetric}>
              <Text style={[styles.investmentMetricLabel, { color: colors.mutedForeground }]}>Resultado</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.investmentMetricValue, { color: totalReturn >= 0 ? colors.income : colors.expense }]}>
                {formatCurrency(totalReturn)}
              </Text>
            </View>
          </View>
          {composition.length === 0 ? (
            <Text style={[styles.categoryEmpty, { color: colors.mutedForeground }]}>Não há valor atual para distribuir.</Text>
          ) : (
            <View style={styles.categoryRows}>
              {composition.map((item) => {
                const percentage = totalCurrentValue > 0 ? item.amount / totalCurrentValue : 0;
                return (
                  <Pressable
                    key={item.assetType}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver investimentos de ${ASSET_TYPE_LABELS[item.assetType]}`}
                    accessibilityHint="Abre a carteira filtrada por tipo de ativo"
                    testID={`investment-composition-${item.assetType}`}
                    onPress={() => onAssetTypePress(item.assetType)}
                    style={({ pressed }) => [styles.categoryRow, pressed && styles.pressed]}
                  >
                    <View style={styles.categoryRowHeader}>
                      <View style={styles.categoryLabel}>
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <Text style={[styles.categoryName, { color: colors.foreground }]}>{ASSET_TYPE_LABELS[item.assetType]}</Text>
                      </View>
                      <View style={styles.categoryAmountGroup}>
                        <Text style={[styles.categoryAmount, { color: colors.foreground }]}>{formatCurrency(item.amount)}</Text>
                        <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
                      </View>
                    </View>
                    <View style={[styles.categoryTrack, { backgroundColor: colors.secondary }]}>
                      <View style={[styles.categoryBar, { width: `${Math.max(percentage * 100, 2)}%`, backgroundColor: item.color }]} />
                    </View>
                    <Text style={[styles.categoryPercentage, { color: colors.mutedForeground }]}>
                      {Math.round(percentage * 100)}% da carteira
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );
}

function CategoryReport({
  title,
  description,
  month,
  onPrevious,
  onNext,
  accessibilityPrefix,
  totals,
  total,
  amountColor,
  emptyMessage,
  percentageLabel,
}: {
  title: React.ReactNode;
  description: string;
  month: Date;
  onPrevious: () => void;
  onNext: () => void;
  accessibilityPrefix: string;
  totals: CategoryTotal[];
  total: number;
  amountColor: string;
  emptyMessage: string;
  percentageLabel: string;
}) {
  const colors = useColors();

  return (
    <View style={[styles.categoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.categoryTitleRow}>
        <View style={styles.categoryTitleCopy}>
          <Text style={[styles.chartTitle, styles.categoryTitle, { color: colors.foreground }]}>
            {title}
          </Text>
          <Text style={[styles.chartDescription, { color: colors.mutedForeground }]}>
            {description}
          </Text>
        </View>
        <MonthSelector
          month={month}
          onPrevious={onPrevious}
          onNext={onNext}
          accessibilityPrefix={accessibilityPrefix}
        />
      </View>
      {totals.length === 0 ? (
        <Text style={[styles.categoryEmpty, { color: colors.mutedForeground }]}>
          {emptyMessage}
        </Text>
      ) : (
        <View style={styles.categoryRows}>
          {totals.map((item) => {
            const percentage = total > 0 ? item.amount / total : 0;
            return (
              <View key={item.key} style={styles.categoryRow}>
                <View style={styles.categoryRowHeader}>
                  <View style={styles.categoryLabel}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text numberOfLines={1} style={[styles.categoryName, { color: colors.foreground }]}>{item.name}</Text>
                  </View>
                  <Text style={[styles.categoryAmount, { color: amountColor }]}>{formatCurrency(item.amount)}</Text>
                </View>
                <View style={[styles.categoryTrack, { backgroundColor: colors.secondary }]}>
                  <View style={[styles.categoryBar, { width: `${Math.max(percentage * 100, 2)}%`, backgroundColor: item.color }]} />
                </View>
                <Text style={[styles.categoryPercentage, { color: colors.mutedForeground }]}>
                  {Math.round(percentage * 100)}% {percentageLabel}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function MonthSelector({
  month,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  accessibilityPrefix,
}: {
  month: Date;
  onPrevious: () => void;
  onNext: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  accessibilityPrefix: string;
}) {
  const colors = useColors();

  return (
    <View style={styles.monthSelector} accessibilityLabel={`Selecionar mês em ${accessibilityPrefix}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mês anterior em ${accessibilityPrefix}`}
        accessibilityState={{ disabled: previousDisabled }}
        disabled={previousDisabled}
        hitSlop={8}
        onPress={onPrevious}
        style={({ pressed }) => [
          styles.monthButton,
          { borderColor: colors.border },
          previousDisabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Feather name="chevron-left" size={15} color={colors.foreground} />
      </Pressable>
      <Text style={[styles.monthText, { color: colors.foreground }]} numberOfLines={1}>
        {formatMonthYearLabel(month)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Próximo mês em ${accessibilityPrefix}`}
        accessibilityState={{ disabled: nextDisabled }}
        disabled={nextDisabled}
        hitSlop={8}
        onPress={onNext}
        style={({ pressed }) => [
          styles.monthButton,
          { borderColor: colors.border },
          nextDisabled && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <Feather name="chevron-right" size={15} color={colors.foreground} />
      </Pressable>
    </View>
  );
}