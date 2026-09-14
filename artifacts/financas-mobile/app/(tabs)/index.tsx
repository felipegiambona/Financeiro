import { Feather } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ErrorState, LoadingState } from '@/components/StateView';
import { WalletIconView } from '@/components/WalletIconView';
import { LimitCard } from '@/components/LimitCard';
import { GoalCard } from '@/components/GoalCard';
import { CreditCardCard } from '@/components/CreditCardCard';
import { useCategories } from '@/context/CategoryContext';
import { useFinance } from '@/context/FinanceContext';
import { useLimits } from '@/context/LimitContext';
import { useGoals } from '@/context/GoalContext';
import { useCards } from '@/context/CardContext';
import { useAuth } from '@/context/AuthContext';
import { useWallets } from '@/context/WalletContext';
import { useDashboardPreferences } from '@/context/DashboardPreferencesContext';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';
import { useInvestments } from '@/context/InvestmentContext';
import { useColors } from '@/hooks/useColors';
import { calculateCurrentBalance, calculateMonthlyTotals, calculateWalletTotals } from '@/services/financialRules';
import { calculateLimitUsage } from '@/services/limitRules';
import { calculateGoalProgress } from '@/services/goalRules';
import { getPendingTransactionOccurrences } from '@/services/pendingNotifications';
import { formatCurrency } from '@/utils/currency';

const DASHBOARD_CARD_GAP = 24;

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, loading, error, refresh } = useFinance();
  const { wallets, loading: walletsLoading } = useWallets();
  const { categories } = useCategories();
  const { limits, loading: limitsLoading } = useLimits();
  const { goals, loading: goalsLoading, refresh: refreshGoals } = useGoals();
  const { cards, loading: cardsLoading, refresh: refreshCards, payCardInvoice } = useCards();
  const { session, signOut } = useAuth();
  const { activeProfile } = useFinancialProfiles();
  const {
    investments,
    loading: investmentsLoading,
    error: investmentsError,
    refresh: refreshInvestments,
  } = useInvestments();
  const { visibility } = useDashboardPreferences();
  useFocusEffect(useCallback(() => {
    void refreshGoals();
    void refreshCards();
  }, [refreshCards, refreshGoals]));
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const firstName = session?.name.trim().split(/\s+/)[0] || 'usuário';

    return `${timeGreeting}, ${firstName}`;
  }, [session?.name]);
  const monthlyTotals = useMemo(() => calculateMonthlyTotals(transactions, new Date()), [transactions]);
  const walletTotals = useMemo(() => calculateWalletTotals(wallets, transactions), [transactions, wallets]);
  const balance = calculateCurrentBalance(wallets, transactions);
  const pendingNotifications = useMemo(() => getPendingTransactionOccurrences(transactions), [transactions]);
  const limitCards = useMemo(
    () => limits.map((limit) => ({
      limit,
      categoryName: categories.find((category) => category.id === limit.categoryId)?.name ?? 'Categoria',
      usage: calculateLimitUsage(limit, transactions),
    })),
    [categories, limits, transactions],
  );
  const goalCards = useMemo(
    () => goals
      .map((goal) => ({ goal, ...calculateGoalProgress(goal, transactions) }))
      .sort((first, second) => Number(first.percentage >= 100) - Number(second.percentage >= 100)),
    [goals, transactions],
  );
  const isPersonalProfile = activeProfile?.type === 'personal';
  const investmentSummary = useMemo(() => investments.reduce(
    (summary, investment) => ({
      currentValue: summary.currentValue + investment.currentValue,
      returnAmount: summary.returnAmount + investment.returnAmount,
    }),
    { currentValue: 0, returnAmount: 0 },
  ), [investments]);
  const handlePayCard = useCallback((cardId: string, cardName: string) => {
    Alert.alert(
      'Pagar fatura?',
      `A fatura atual de ${cardName} será marcada como paga e zerada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pagar',
          onPress: () => void payCardInvoice(cardId).catch(() => {
            Alert.alert('Não foi possível pagar', 'Tente novamente.');
          }),
        },
      ],
    );
  }, [payCardInvoice]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Visão geral"
          title={greeting}
          notificationCount={pendingNotifications.length}
          onNotificationPress={() => router.push('/notifications')}
          actionLabel="Sair"
          actionIcon="log-out"
          onAction={() => void signOut()}
        />
        {activeProfile?.type === 'business' ? (
          <View style={styles.businessProfileNotice}>
            <View style={styles.businessProfileNoticeCopy}>
              <Text numberOfLines={1} style={[styles.businessProfileNoticeName, { color: colors.mutedForeground }]}>
                Perfil empresarial ativo: {activeProfile.businessName || 'Empresarial'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Trocar perfil"
              onPress={() => router.push('/more/profile')}
              style={({ pressed }) => [styles.businessProfileSwitchButton, { backgroundColor: colors.secondary, borderColor: colors.border }, pressed && styles.pressed]}
            >
              <Text style={[styles.businessProfileSwitchText, { color: colors.foreground }]}>Trocar perfil</Text>
            </Pressable>
          </View>
        ) : null}
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : (
          <>
            {visibility.balance ? <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
              <View style={styles.balanceTop}>
                <Text style={styles.balanceLabel}>Saldo atual</Text>
                <View style={styles.balanceMark}>
                  <Feather name="bar-chart-2" size={17} color={colors.accent} />
                </View>
              </View>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.balanceValue}>{formatCurrency(balance)}</Text>
              <Text style={styles.balanceHint}>Receitas menos despesas</Text>
            </View> : null}
            {visibility.monthlySummary ? <View style={styles.summaryMetrics}>
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
            </View> : null}
            {visibility.pending ? <View style={styles.pendingMetrics}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver receitas não pagas"
                onPress={() => router.push('/transactions?typeFilter=income&statusFilter=unpaid')}
                style={({ pressed }) => [
                  styles.monthMetric,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.metricIcon, { backgroundColor: colors.incomeSoft }]}>
                  <Feather name="clock" size={16} color={colors.income} />
                </View>
                <View style={styles.metricLabelRow}>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>A Receber</Text>
                  <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.metricValue, { color: colors.income }]}>{formatCurrency(monthlyTotals.receivable)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver despesas não pagas"
                onPress={() => router.push('/transactions?typeFilter=expense&statusFilter=unpaid')}
                style={({ pressed }) => [
                  styles.monthMetric,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.metricIcon, { backgroundColor: colors.expenseSoft }]}>
                  <Feather name="credit-card" size={16} color={colors.expense} />
                </View>
                <View style={styles.metricLabelRow}>
                  <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>A Pagar</Text>
                  <Feather name="chevron-right" size={13} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.metricValue, { color: colors.expense }]}>{formatCurrency(monthlyTotals.payable)}</Text>
              </Pressable>
            </View> : null}
            {visibility.wallets ? <View style={styles.walletSection}>
              <View style={styles.walletHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Minhas carteiras</Text>
                  <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Acompanhe o saldo das suas contas.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Gerenciar carteiras"
                  onPress={() => router.push('/wallets')}
                  style={({ pressed }) => [
                    styles.manageWalletButton,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.manageWalletButtonText, { color: colors.foreground }]}>Gerenciar</Text>
                </Pressable>
              </View>
              <View style={[styles.walletCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                          <WalletIconView icon={wallet.icon} size={17} color={colors.mutedForeground} />
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
            </View> : null}
            {visibility.goals ? <View style={styles.goalsSection}>
              <View style={styles.goalsHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Metas e objetivos</Text>
                  <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Acompanhe o progresso do que você quer conquistar.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver todas as metas"
                  onPress={() => router.push('/more/goals')}
                  style={({ pressed }) => [
                    styles.manageWalletButton,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.manageWalletButtonText, { color: colors.foreground }]}>Ver todas</Text>
                </Pressable>
              </View>
              {goalsLoading ? (
                <Text style={[styles.goalState, { color: colors.mutedForeground }]}>Carregando metas...</Text>
              ) : goalCards.length === 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Criar uma meta"
                  onPress={() => router.push({ pathname: '/more/goals', params: { openNew: '1' } })}
                  style={({ pressed }) => [styles.emptyGoalCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
                >
                  <Feather name="award" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.goalState, { color: colors.mutedForeground }]}>Crie uma meta para acompanhar seu progresso.</Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCardsContent}>
                  {goalCards.map(({ goal, ...progress }) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      {...progress}
                      style={styles.dashboardCarouselCard}
                      onPress={() => router.push({ pathname: '/more/goal/[id]', params: { id: goal.id } })}
                      onEdit={() => router.push({ pathname: '/more/goals', params: { editId: goal.id } })}
                      onDelete={() => router.push({ pathname: '/more/goals', params: { deleteId: goal.id } })}
                    />
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Criar nova meta"
                    testID="dashboard-new-goal-card"
                    onPress={() => router.push({ pathname: '/more/goals', params: { openNew: '1' } })}
                    style={({ pressed }) => [styles.dashboardAddCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
                  >
                    <View style={[styles.dashboardAddIcon, { backgroundColor: colors.secondary }]}>
                      <Feather name="plus" size={19} color={colors.foreground} />
                    </View>
                    <Text style={[styles.dashboardAddTitle, { color: colors.foreground }]}>Nova meta</Text>
                    <Text style={[styles.dashboardAddHint, { color: colors.mutedForeground }]}>Adicionar objetivo</Text>
                  </Pressable>
                </ScrollView>
              )}
            </View> : null}
            {visibility.limits ? <View style={styles.limitsSection}>
              <View style={styles.limitsHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Meus limites</Text>
                  <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Acompanhe o uso dos seus gastos.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Criar novo limite"
                  testID="dashboard-new-limit-button"
                  onPress={() => router.push({ pathname: '/more/limits', params: { openNew: '1' } })}
                  style={({ pressed }) => [styles.addLimitButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
                >
                  <Feather name="plus" size={15} color={colors.primaryForeground} />
                  <Text style={[styles.addLimitText, { color: colors.primaryForeground }]}>Novo</Text>
                </Pressable>
              </View>
              {limitsLoading ? (
                <Text style={[styles.limitState, { color: colors.mutedForeground }]}>Carregando limites...</Text>
              ) : limitCards.length === 0 ? (
                <View style={[styles.emptyLimitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="target" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.limitState, { color: colors.mutedForeground }]}>Crie um limite para acompanhar seus gastos.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCardsContent}>
                  {limitCards.map(({ limit, categoryName, usage }) => (
                    <LimitCard
                      key={limit.id}
                      limit={limit}
                      categoryName={categoryName}
                      usage={usage}
                      style={styles.dashboardCarouselCard}
                      onPress={() => router.push('/more/limits')}
                      onEdit={() => router.push({ pathname: '/more/limits', params: { editId: limit.id } })}
                      onDelete={() => router.push({ pathname: '/more/limits', params: { deleteId: limit.id } })}
                    />
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Criar novo limite"
                    testID="dashboard-new-limit-card"
                    onPress={() => router.push({ pathname: '/more/limits', params: { openNew: '1' } })}
                    style={({ pressed }) => [styles.dashboardAddCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
                  >
                    <View style={[styles.dashboardAddIcon, { backgroundColor: colors.secondary }]}>
                      <Feather name="plus" size={19} color={colors.foreground} />
                    </View>
                    <Text style={[styles.dashboardAddTitle, { color: colors.foreground }]}>Novo limite</Text>
                    <Text style={[styles.dashboardAddHint, { color: colors.mutedForeground }]}>Controlar gastos</Text>
                  </Pressable>
                </ScrollView>
              )}
            </View> : null}
            {visibility.cards ? <View style={styles.cardsSection}>
              <View style={styles.cardsHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Meus cartões</Text>
                  <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Acompanhe suas faturas e vencimentos.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Gerenciar cartões"
                  onPress={() => router.push('/more/cards')}
                  style={({ pressed }) => [
                    styles.manageWalletButton,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.manageWalletButtonText, { color: colors.foreground }]}>Gerenciar</Text>
                </Pressable>
              </View>
              {cardsLoading ? (
                <Text style={[styles.cardState, { color: colors.mutedForeground }]}>Carregando cartões...</Text>
              ) : cards.length === 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Criar cartão"
                  onPress={() => router.push({ pathname: '/more/cards', params: { openNew: '1' } })}
                  style={({ pressed }) => [styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
                >
                  <Feather name="credit-card" size={20} color={colors.mutedForeground} />
                  <Text style={[styles.cardState, { color: colors.mutedForeground }]}>Cadastre um cartão para acompanhar suas faturas.</Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCardsContent}>
                  {cards.map((card) => (
                    <CreditCardCard
                      key={card.id}
                      card={card}
                      style={styles.dashboardCarouselCard}
                      onPress={() => router.push({ pathname: '/more/card/[id]', params: { id: card.id } })}
                      onPay={() => handlePayCard(card.id, card.name)}
                    />
                  ))}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Criar novo cartão"
                    testID="dashboard-new-card-card"
                    onPress={() => router.push({ pathname: '/more/cards', params: { openNew: '1' } })}
                    style={({ pressed }) => [styles.dashboardAddCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
                  >
                    <View style={[styles.dashboardAddIcon, { backgroundColor: colors.secondary }]}>
                      <Feather name="plus" size={19} color={colors.foreground} />
                    </View>
                    <Text style={[styles.dashboardAddTitle, { color: colors.foreground }]}>Novo cartão</Text>
                    <Text style={[styles.dashboardAddHint, { color: colors.mutedForeground }]}>Cadastrar cartão</Text>
                  </Pressable>
                </ScrollView>
              )}
            </View> : null}
            {isPersonalProfile && visibility.investments ? <View style={styles.investmentsSection}>
              <View style={styles.investmentsHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Investimentos</Text>
                  <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Acompanhe o valor da sua carteira.</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Gerenciar investimentos"
                  onPress={() => router.push('/more/investments')}
                  style={({ pressed }) => [
                    styles.manageWalletButton,
                    { backgroundColor: colors.secondary, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.manageWalletButtonText, { color: colors.foreground }]}>Ver carteira</Text>
                </Pressable>
              </View>
              {investmentsLoading ? (
                <View style={[styles.investmentStateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.investmentState, { color: colors.mutedForeground }]}>Carregando investimentos...</Text>
                </View>
              ) : investmentsError ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Tentar carregar investimentos novamente"
                  onPress={() => void refreshInvestments()}
                  style={({ pressed }) => [styles.investmentStateCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
                >
                  <Feather name="alert-circle" size={19} color={colors.expense} />
                  <Text style={[styles.investmentState, { color: colors.mutedForeground }]}>Não foi possível carregar seus investimentos. Toque para tentar novamente.</Text>
                </Pressable>
              ) : investments.length === 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Adicionar primeiro investimento"
                  onPress={() => router.push('/more/investments')}
                  style={({ pressed }) => [styles.investmentStateCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
                >
                  <Feather name="bar-chart" size={19} color={colors.mutedForeground} />
                  <Text style={[styles.investmentState, { color: colors.mutedForeground }]}>Cadastre um investimento para acompanhar sua carteira.</Text>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir resumo dos investimentos"
                  onPress={() => router.push('/more/investments')}
                  style={({ pressed }) => [styles.investmentSummaryCard, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.pressed]}
                >
                  <View style={[styles.investmentIcon, { backgroundColor: colors.secondary }]}>
                    <Feather name="bar-chart" size={17} color={colors.foreground} />
                  </View>
                  <View style={styles.investmentSummaryValue}>
                    <Text style={[styles.investmentLabel, { color: colors.mutedForeground }]}>Valor atual</Text>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.investmentValue, { color: colors.foreground }]}>
                      {formatCurrency(investmentSummary.currentValue)}
                    </Text>
                  </View>
                  <View style={styles.investmentSummaryResult}>
                    <Text style={[styles.investmentLabel, { color: colors.mutedForeground }]}>Resultado</Text>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.investmentValue, { color: investmentSummary.returnAmount >= 0 ? colors.income : colors.expense }]}>
                      {formatCurrency(investmentSummary.returnAmount)}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View> : null}
            <View style={styles.customizeSection}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Personalizar cards do dashboard"
                testID="customize-dashboard-button"
                onPress={() => router.push('/more/dashboard-cards')}
                style={({ pressed }) => [
                  styles.customizeButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.customizeIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name="sliders" size={17} color={colors.foreground} />
                </View>
                <Text style={[styles.customizeTitle, { color: colors.foreground }]}>Personalizar dashboard</Text>
                <Text style={[styles.customizeHint, { color: colors.mutedForeground }]}>
                  Escolha quais cards deseja visualizar nesta tela.
                </Text>
              </Pressable>
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
  summaryMetrics: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  pendingMetrics: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  monthMetric: { flex: 1, minHeight: 112, borderRadius: 9, borderWidth: 1, padding: 12 },
  metricIcon: { width: 29, height: 29, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  metricValue: { fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 5 },
  walletSection: { marginTop: 0 },
  walletCard: { borderRadius: 9, borderWidth: 1, padding: 14 },
  walletHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  manageWalletButton: { minHeight: 27, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  manageWalletButtonText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  walletState: { fontSize: 11, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
  walletRows: { gap: 0 },
  walletRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  walletName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletNameText: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium' },
  walletValue: { fontSize: 13, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  goalsSection: { marginTop: 24 },
  goalsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  emptyGoalCard: { minHeight: 72, borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalState: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
  limitsSection: { marginTop: 24 },
  limitsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  cardsSection: { marginTop: 24 },
  horizontalCardsContent: { gap: DASHBOARD_CARD_GAP },
  dashboardCarouselCard: { width: 304, marginBottom: 0 },
  dashboardAddCard: { width: 304, minHeight: 132, borderWidth: 1, borderRadius: 10, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', padding: 16 },
  dashboardAddIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  dashboardAddTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  dashboardAddHint: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  businessProfileNotice: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 8, marginTop: -8, marginBottom: 12 },
  businessProfileNoticeCopy: { flexShrink: 1, minWidth: 0 },
  businessProfileNoticeName: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  businessProfileSwitchButton: { minHeight: 28, borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  businessProfileSwitchText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  cardsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  investmentsSection: { marginTop: 24 },
  investmentsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  investmentStateCard: { minHeight: 72, borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  investmentState: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
  investmentSummaryCard: { minHeight: 82, borderWidth: 1, borderRadius: 9, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  investmentIcon: { width: 31, height: 31, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  investmentSummaryValue: { flex: 1, minWidth: 0 },
  investmentSummaryResult: { flex: 0.9, minWidth: 0 },
  investmentLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  investmentValue: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 4 },
  emptyCard: { minHeight: 72, borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardState: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  sectionHint: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  addLimitButton: { minHeight: 30, borderRadius: 7, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  addLimitText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  emptyLimitCard: { minHeight: 72, borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  limitState: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', paddingVertical: 8 },
  pressed: { opacity: 0.72 },
  customizeSection: { alignItems: 'center', marginTop: 24 },
  customizeButton: { width: '100%', minHeight: 98, borderWidth: 1, borderStyle: 'dashed', borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  customizeIcon: { width: 31, height: 31, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  customizeTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  customizeHint: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 3 },
});
