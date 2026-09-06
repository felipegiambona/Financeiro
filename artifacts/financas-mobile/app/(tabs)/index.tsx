import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ErrorState, LoadingState } from '@/components/StateView';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';
import { calculateCurrentBalance } from '@/services/financialRules';
import { formatCurrency } from '@/utils/currency';

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, loading, error, refresh } = useFinance();
  const balance = calculateCurrentBalance(transactions);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Visão geral" title="Seu dinheiro, no controle." />
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
  content: { paddingHorizontal: 20 },
  balanceCard: { minHeight: 210, borderRadius: 26, padding: 24, overflow: 'hidden', justifyContent: 'space-between', marginBottom: 14 },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { color: '#D7E3DC', fontSize: 14, fontFamily: 'Inter_500Medium' },
  balanceMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(184,239,145,0.16)', alignItems: 'center', justifyContent: 'center' },
  balanceValue: { color: '#FFFFFF', fontSize: 36, lineHeight: 45, fontFamily: 'Inter_700Bold', letterSpacing: -1.1, marginTop: 26 },
  balanceHint: { color: '#A9BCB1', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 5 },
  balanceAccent: { position: 'absolute', width: 145, height: 145, borderRadius: 80, right: -52, bottom: -75, opacity: 0.9 },
  newButton: { minHeight: 62, borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 11 },
  buttonIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(18,32,51,0.10)', alignItems: 'center', justifyContent: 'center' },
  newButtonText: { flex: 1, fontSize: 15, fontFamily: 'Inter_700Bold' },
  pressed: { opacity: 0.72 },
});
