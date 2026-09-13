import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ErrorState } from '@/components/StateView';
import { useGoals } from '@/context/GoalContext';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';
import { createGoalMovement, getGoal } from '@/services/goalRepository';
import { calculateGoalProgress } from '@/services/goalRules';
import type { Goal, GoalDetail, GoalHistoryEntry, GoalMovementInput } from '@/types/goal';
import { formatAmountInput, formatCurrency, parseAmountInput } from '@/utils/currency';
import { createLocalIsoDate, formatDate, parseStoredDate } from '@/utils/date';

function formatTimeRemaining(deadline: string | null, savedAmount: number, targetAmount: number): string {
  if (savedAmount >= targetAmount) return 'Meta alcançada';
  if (!deadline) return 'Sem data final definida';
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const deadlineDate = parseStoredDate(deadline);
  const days = Math.ceil((deadlineDate.getTime() - startOfToday.getTime()) / 86400000);
  if (days === 0) return 'Prazo termina hoje';
  if (days > 0) return `${days} ${days === 1 ? 'dia' : 'dias'} restantes`;
  const elapsed = Math.abs(days);
  return `Prazo encerrado há ${elapsed} ${elapsed === 1 ? 'dia' : 'dias'}`;
}

function historyTitle(entry: GoalHistoryEntry): string {
  if (entry.source === 'manual') {
    return entry.type === 'contribution' ? 'Inclusão manual' : 'Retirada manual';
  }
  return entry.type === 'contribution' ? 'Despesa vinculada' : 'Receita vinculada';
}

export default function GoalDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { goals, refresh: refreshGoals } = useGoals();
  const { refresh: refreshTransactions } = useFinance();
  const [detail, setDetail] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movementType, setMovementType] = useState<GoalMovementInput['type'] | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      setDetail(await getGoal(id));
    } catch {
      setError('Não foi possível carregar os detalhes da meta.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void loadDetail();
  }, [loadDetail]));

  const goal = detail?.goal ?? goals.find((item) => item.id === id);
  const progress = goal ? calculateGoalProgress(goal, []) : null;

  const openMovement = (type: GoalMovementInput['type']) => {
    setMovementType(type);
    setAmount('');
    setDescription('');
    setFormError('');
  };

  const saveMovement = async () => {
    if (!id || !movementType || !progress) return;
    const numericAmount = parseAmountInput(amount);
    if (!numericAmount || numericAmount <= 0) {
      setFormError('Informe um valor maior que zero.');
      return;
    }
    if (movementType === 'withdrawal' && numericAmount > progress.savedAmount) {
      setFormError('A retirada não pode ser maior que o valor guardado.');
      return;
    }
    try {
      setSaving(true);
      setFormError('');
      await createGoalMovement(id, {
        type: movementType,
        amount: numericAmount,
        ...(description.trim() ? { description: description.trim() } : {}),
        date: createLocalIsoDate(),
      });
      await Promise.all([refreshGoals(), refreshTransactions()]);
      setMovementType(null);
      await loadDetail();
    } catch {
      setFormError('Não foi possível salvar este movimento.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !goal) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.foreground} />
      </View>
    );
  }

  if (error || !goal || !progress) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ErrorState onRetry={() => void loadDetail()} />
      </View>
    );
  }

  const history = detail?.history ?? [];
  const completed = progress.percentage >= 100;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <ScreenHeader eyebrow="Planejamento" title="Detalhes da meta" showBack />
          <View style={[styles.goalHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {goal.imageData ? (
              <Image source={{ uri: goal.imageData }} style={styles.image} />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.secondary }]}>
                <Feather name="target" size={24} color={colors.foreground} />
              </View>
            )}
            <View style={styles.goalCopy}>
              <Text style={[styles.goalTitle, { color: colors.foreground }]}>{goal.title}</Text>
              <Text style={[styles.goalDeadline, { color: colors.mutedForeground }]}>
                {goal.deadline ? `Até ${formatDate(goal.deadline)}` : 'Sem data final'}
              </Text>
            </View>
          </View>

          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryTop}>
              <View>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Valor guardado</Text>
                <Text style={[styles.savedAmount, { color: completed ? colors.income : colors.foreground }]}>{formatCurrency(progress.savedAmount)}</Text>
              </View>
              <View style={[styles.percentBadge, { backgroundColor: completed ? colors.income : colors.secondary }]}>
                <Text style={[styles.percentText, { color: completed ? colors.primaryForeground : colors.foreground }]}>{Math.round(progress.percentage)}%</Text>
              </View>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
              <View style={[styles.progressBar, { width: `${progress.progress * 100}%`, backgroundColor: completed ? colors.income : colors.accent }]} />
            </View>
            <View style={styles.summaryFooter}>
              <Text style={[styles.remaining, { color: colors.mutedForeground }]}>
                {completed ? 'Objetivo concluído' : `${formatCurrency(progress.remaining)} restante`}
              </Text>
              <Text style={[styles.remaining, { color: colors.mutedForeground }]}>
                {formatTimeRemaining(goal.deadline, progress.savedAmount, goal.targetAmount)}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Incluir valor na meta"
              testID="goal-add-value-button"
              onPress={() => openMovement('contribution')}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.income }, pressed && styles.pressed]}
            >
              <Feather name="plus" size={17} color={colors.accentForeground} />
              <Text style={[styles.actionText, { color: colors.accentForeground }]}>Incluir valor</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retirar valor da meta"
              testID="goal-withdraw-value-button"
              disabled={progress.savedAmount <= 0}
              onPress={() => openMovement('withdrawal')}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: colors.secondary, borderColor: colors.border }, progress.savedAmount <= 0 && styles.disabled, pressed && styles.pressed]}
            >
              <Feather name="minus" size={17} color={colors.foreground} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>Retirar valor</Text>
            </Pressable>
          </View>

          <View style={styles.historyHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Histórico</Text>
              <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Lançamentos e ajustes ligados a esta meta.</Text>
            </View>
          </View>
          {history.length === 0 ? (
            <View style={[styles.emptyHistory, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="inbox" size={20} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Ainda não há lançamentos para esta meta.</Text>
            </View>
          ) : history.map((entry) => {
            const contribution = entry.type === 'contribution';
            return (
              <View key={`${entry.source}-${entry.id}`} style={[styles.historyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.historyIcon, { backgroundColor: contribution ? colors.income : colors.secondary }]}>
                  <Feather name={contribution ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={contribution ? colors.primaryForeground : colors.foreground} />
                </View>
                <View style={styles.historyCopy}>
                  <Text style={[styles.historyTitle, { color: colors.foreground }]}>{historyTitle(entry)}</Text>
                  <Text numberOfLines={1} style={[styles.historyDescription, { color: colors.mutedForeground }]}>{entry.description}</Text>
                  <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                    {formatDate(entry.date)}{entry.paymentStatus === 'unpaid' ? ' · pendente' : ''}
                  </Text>
                </View>
                <Text style={[styles.historyAmount, { color: contribution ? colors.income : colors.expense }]}>
                  {contribution ? '+' : '-'}{formatCurrency(entry.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      </KeyboardAwareScrollViewCompat>

      <Modal visible={movementType !== null} transparent animationType="fade" onRequestClose={() => !saving && setMovementType(null)}>
        <View style={styles.modalRoot}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalEyebrow, { color: colors.mutedForeground }]}>META</Text>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {movementType === 'contribution' ? 'Incluir valor' : 'Retirar valor'}
                </Text>
              </View>
              <Pressable accessibilityLabel="Fechar movimento" disabled={saving} onPress={() => setMovementType(null)} style={[styles.closeButton, { backgroundColor: colors.secondary }]}>
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            <Text style={[styles.label, { color: colors.foreground }]}>Valor</Text>
            <TextInput
              accessibilityLabel="Valor do movimento"
              keyboardType="decimal-pad"
              onChangeText={(value) => setAmount(formatAmountInput(value))}
              placeholder="0,00"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              value={amount}
            />
            <Text style={[styles.label, { color: colors.foreground }]}>Descrição (opcional)</Text>
            <TextInput
              accessibilityLabel="Descrição do movimento"
              onChangeText={setDescription}
              placeholder={movementType === 'contribution' ? 'Ex.: dinheiro separado' : 'Ex.: valor utilizado'}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              value={description}
            />
            {formError ? <Text style={[styles.formError, { color: colors.expense }]}>{formError}</Text> : null}
            <Pressable disabled={saving} onPress={() => void saveMovement()} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled, pressed && styles.pressed]}>
              <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{saving ? 'Salvando...' : 'Salvar movimento'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  content: { paddingHorizontal: 16 },
  goalHeader: { borderWidth: 1, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: -3 },
  image: { width: 56, height: 56, borderRadius: 10 },
  imagePlaceholder: { width: 56, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  goalCopy: { flex: 1 },
  goalTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  goalDeadline: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 4 },
  summaryCard: { borderWidth: 1, borderRadius: 10, padding: 15, marginTop: 10 },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  savedAmount: { fontSize: 27, fontFamily: 'Inter_700Bold', marginTop: 4 },
  percentBadge: { minWidth: 48, minHeight: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  percentText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 14 },
  progressBar: { height: '100%', borderRadius: 4 },
  summaryFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 9 },
  remaining: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  historyHeader: { marginTop: 26, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  sectionHint: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  historyRow: { minHeight: 72, borderWidth: 1, borderRadius: 9, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  historyIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  historyCopy: { flex: 1, minWidth: 0 },
  historyTitle: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  historyDescription: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  historyDate: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 4 },
  historyAmount: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  emptyHistory: { minHeight: 84, borderWidth: 1, borderRadius: 9, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  emptyText: { flex: 1, fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  modalCard: { width: '100%', maxWidth: 350, borderWidth: 1, borderRadius: 11, padding: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  modalEyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2 },
  modalTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 4 },
  closeButton: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 7, marginTop: 13 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 13, fontFamily: 'Inter_400Regular' },
  formError: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_500Medium', marginTop: 8 },
  saveButton: { minHeight: 45, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  saveText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});