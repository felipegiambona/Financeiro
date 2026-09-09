import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ErrorState, LoadingState } from '@/components/StateView';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { calculateCurrentBalance, calculateMonthlyTotals } from '@/services/financialRules';
import { formatCurrency } from '@/utils/currency';

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, loading, error, refresh } = useFinance();
  const { signOut } = useAuth();
  const balance = calculateCurrentBalance(transactions);
  const monthlyTotals = useMemo(() => calculateMonthlyTotals(transactions, new Date()), [transactions]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Visão geral" title="Seu dinheiro, no controle." actionLabel="Sair" actionIcon="log-out" onAction={() => void signOut()} />
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : (
          <>
            <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
              <View style={styles.balanceTop}>
                <Text style={styles.balanceLabel}>Saldo atual</Text>
                <View style={styles.balanceMark}><Feather name="bar-chart-2" size={17} color={colors.accent} /></View>
              </View>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.balanceValue}>{formatCurrency(balance)}</Text>
              <Text style={styles.balanceHint}>Receitas menos despesas</Text>
              <View style={[styles.balanceAccent, { backgroundColor: colors.accent }]} />
            </View>
            <View style={styles.monthMetrics}>
              <View style={[styles.monthMetric, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.metricIcon, { backgroundColor: colors.incomeSoft }]}>
                  <Feather name="trending-up" size={16} color={colors.income} />
                </View>
                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Receitas do mês</Text>
                <Text style={[styles.metricValue, { color: colors.income }]}>{formatCurrency(monthlyTotals.income)}</Text>
              </View>
              <View style={[styles.monthMetric, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.metricIcon, { backgroundColor: colors.expenseSoft }]}>
                  <Feather name="trending-down" size={16} color={colors.expense} />
                </View>
                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>Despesas do mês</Text>
                <Text style={[styles.metricValue, { color: colors.expense }]}>{formatCurrency(monthlyTotals.expense)}</Text>
              </View>
            </View>
            <View style={styles.monthMetrics}>
              <View style={[styles.monthMetric, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.metricIcon, { backgroundColor: colors.incomeSoft }]}>
                  <Feather name="clock" size={16} color={colors.income} />
                </View>
                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>A Receber</Text>
                <Text style={[styles.metricValue, { color: colors.income }]}>{formatCurrency(monthlyTotals.receivable)}</Text>
              </View>
              <View style={[styles.monthMetric, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.metricIcon, { backgroundColor: colors.expenseSoft }]}>
                  <Feather name="credit-card" size={16} color={colors.expense} />
                </View>
                <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>A Pagar</Text>
                <Text style={[styles.metricValue, { color: colors.expense }]}>{formatCurrency(monthlyTotals.payable)}</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Novo lançamento"
              testID="new-transaction-button"
              onPress={() => router.push('/transaction/new')}
              style={({ pressed }) => [styles.newButton, { backgroundColor: colors.accent }, pressed && styles.pressed]}
            >
              <View style={styles.buttonIcon}><Feather name="plus" size={19} color={colors.accentForeground} /></View>
              <Text style={[styles.newButtonText, { color: colors.accentForeground }]}>Novo lançamento</Text>
              <Feather name="arrow-up-right" size={18} color={colors.accentForeground} />
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  balanceCard: { minHeight: 164, borderRadius: 9, padding: 17, overflow: 'hidden', justifyContent: 'space-between', marginBottom: 10 },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: '#D4D4D4', fontSize: 12, fontFamily: 'Inter_500Medium' },
  balanceMark: { width: 30, height: 30, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  balanceValue: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontFamily: 'Inter_700Bold', letterSpacing: -0.8, marginTop: 17 },
  balanceHint: { color: '#999999', fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
  balanceAccent: { position: 'absolute', width: 92, height: 92, borderRadius: 8, right: -38, bottom: -45, opacity: 0.22 },
  monthMetrics: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  monthMetric: { flex: 1, minHeight: 112, borderRadius: 9, borderWidth: 1, padding: 12 },
  metricIcon: { width: 29, height: 29, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  metricLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  metricValue: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 5 },
  newButton: { minHeight: 48, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 },
  buttonIcon: { width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' },
  newButtonText: { flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold' },
  pressed: { opacity: 0.72 },
});
