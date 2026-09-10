import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ErrorState, LoadingState } from '@/components/StateView';
import { useFinance } from '@/context/FinanceContext';
import { useAuth } from '@/context/AuthContext';
import { useWallets } from '@/context/WalletContext';
import { useColors } from '@/hooks/useColors';
import { calculateCurrentBalance, calculateMonthlyTotals, calculateWalletTotals } from '@/services/financialRules';
import { formatCurrency } from '@/utils/currency';

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, loading, error, refresh } = useFinance();
  const { wallets, loading: walletsLoading } = useWallets();
  const { signOut } = useAuth();
  const balance = calculateCurrentBalance(transactions);
  const monthlyTotals = useMemo(() => calculateMonthlyTotals(transactions, new Date()), [transactions]);
  const walletTotals = useMemo(() => calculateWalletTotals(wallets, transactions), [transactions, wallets]);

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
            <View style={[styles.walletCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.walletHeader}>
                <Text style={[styles.walletTitle, { color: colors.foreground }]}>Carteiras</Text>
                <MaterialCommunityIcons name="wallet-outline" size={18} color={colors.mutedForeground} />
              </View>
              {walletsLoading ? (
                <Text style={[styles.walletState, { color: colors.mutedForeground }]}>Carregando carteiras...</Text>
              ) : walletTotals.length === 0 ? (
                <Text style={[styles.walletState, { color: colors.mutedForeground }]}>Nenhuma carteira cadastrada.</Text>
              ) : (
                <View style={styles.walletRows}>
                  {walletTotals.map(({ wallet, total }, index) => (
                    <View
                      key={wallet.id}
                      style={[
                        styles.walletRow,
                        index < walletTotals.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                      ]}
                    >
                      <View style={styles.walletName}>
                        <MaterialCommunityIcons name={wallet.icon} size={17} color={colors.mutedForeground} />
                        <Text numberOfLines={1} style={[styles.walletNameText, { color: colors.foreground }]}>{wallet.title}</Text>
                      </View>
                      <Text style={[styles.walletValue, { color: total >= 0 ? colors.income : colors.expense }]}>
                        {formatCurrency(total)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
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
  walletCard: { borderRadius: 9, borderWidth: 1, padding: 14, marginTop: 2 },
  walletHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  walletTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  walletState: { fontSize: 11, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
  walletRows: { gap: 0 },
  walletRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  walletName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletNameText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  walletValue: { fontSize: 13, fontFamily: 'Inter_700Bold', textAlign: 'right' },
});
