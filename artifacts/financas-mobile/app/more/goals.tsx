import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { GoalCard } from '@/components/GoalCard';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useFinance } from '@/context/FinanceContext';
import { useGoals } from '@/context/GoalContext';
import { useColors } from '@/hooks/useColors';
import { calculateGoalProgress } from '@/services/goalRules';
import type { Goal } from '@/types/goal';
import { formatAmountInput, formatAmountValue, parseAmountInput } from '@/utils/currency';
import { createLocalIsoDate, formatDate, parseStoredDate } from '@/utils/date';
import { DatePickerModal } from '@/components/DatePickerModal';

function toDateInput(dateString?: string | null): string {
  if (!dateString) return '';
  const date = parseStoredDate(dateString);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12);
  return date.getFullYear() === Number(match[3])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[1])
    ? date
    : null;
}

export default function GoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions } = useFinance();
  const { goals, loading, error, refresh, createGoal, updateGoal, deleteGoal } = useGoals();
  const { openNew, editId, deleteId } = useLocalSearchParams<{ openNew?: string; editId?: string; deleteId?: string }>();
  const handledRouteAction = useRef(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [imageData, setImageData] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  useFocusEffect(React.useCallback(() => {
    void refresh();
  }, [refresh]));

  const openEditor = (goal?: Goal) => {
    setEditingGoal(goal ?? null);
    setTitle(goal?.title ?? '');
    setAmount(goal ? formatAmountValue(goal.targetAmount) : '');
    setDeadline(toDateInput(goal?.deadline));
    setImageData(goal?.imageData ?? null);
    setDatePickerOpen(false);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (!saving) {
      setDatePickerOpen(false);
      setEditorOpen(false);
    }
  };

  useEffect(() => {
    if (loading || handledRouteAction.current) return;
    const editGoal = editId ? goals.find((goal) => goal.id === editId) : undefined;
    const deleteGoalTarget = deleteId ? goals.find((goal) => goal.id === deleteId) : undefined;
    if (openNew === '1') {
      handledRouteAction.current = true;
      openEditor();
    } else if (editGoal) {
      handledRouteAction.current = true;
      openEditor(editGoal);
    } else if (deleteGoalTarget) {
      handledRouteAction.current = true;
      setDeleteTarget(deleteGoalTarget);
    }
  }, [deleteId, editId, goals, loading, openNew]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        base64: true,
        quality: 0.7,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset?.base64) return;
      setImageData(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
    } catch {
      Alert.alert('Não foi possível adicionar a imagem', 'Escolha outra imagem e tente novamente.');
    }
  };

  const saveGoal = async () => {
    const trimmedTitle = title.trim();
    const numericAmount = parseAmountInput(amount);
    const parsedDeadline = deadline ? parseDateInput(deadline) : null;
    if (!trimmedTitle) {
      Alert.alert('Título obrigatório', 'Informe um título para a meta.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero.');
      return;
    }
    if (deadline && !parsedDeadline) {
      Alert.alert('Data inválida', 'Informe a data no formato DD/MM/AAAA.');
      return;
    }

    try {
      setSaving(true);
      const input = {
        title: trimmedTitle,
        targetAmount: numericAmount,
        imageData,
        deadline: parsedDeadline ? createLocalIsoDate(parsedDeadline) : null,
      };
      if (editingGoal) await updateGoal(editingGoal.id, input);
      else await createGoal(input);
      closeEditor();
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGoal(deleteTarget.id);
      setDeleteTarget(null);
    } catch {
      Alert.alert('Não foi possível excluir', 'Tente novamente.');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollContent
        colors={colors}
        insets={insets}
        goals={goals}
        transactions={transactions}
        loading={loading}
        error={error}
        refresh={refresh}
        onNew={() => openEditor()}
        onEdit={openEditor}
        onDelete={setDeleteTarget}
      />
      <Modal animationType="fade" transparent visible={editorOpen} onRequestClose={closeEditor}>
        <View style={styles.editorModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditor} />
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <KeyboardAwareScrollViewCompat
              style={styles.modalFormScroll}
              contentContainerStyle={styles.modalFormContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalEyebrow, { color: colors.mutedForeground }]}>Objetivo financeiro</Text>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingGoal ? 'Editar meta' : 'Nova meta'}</Text>
                </View>
                <Pressable accessibilityLabel="Fechar editor de meta" onPress={closeEditor} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                  <Feather name="x" size={18} color={colors.foreground} />
                </Pressable>
              </View>

              <Text style={[styles.label, { color: colors.foreground }]}>Imagem</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Adicionar imagem à meta" onPress={() => void pickImage()} style={({ pressed }) => [styles.imagePicker, { backgroundColor: colors.secondary, borderColor: colors.border }, pressed && styles.pressed]}>
                {imageData ? <Image source={{ uri: imageData }} style={styles.previewImage} /> : <Feather name="image" size={20} color={colors.mutedForeground} />}
                <View style={styles.imagePickerCopy}>
                  <Text style={[styles.imagePickerTitle, { color: colors.foreground }]}>{imageData ? 'Trocar imagem' : 'Adicionar imagem'}</Text>
                  <Text style={[styles.imagePickerHint, { color: colors.mutedForeground }]}>Opcional</Text>
                </View>
                {imageData ? (
                  <Pressable accessibilityLabel="Remover imagem da meta" onPress={() => setImageData(null)} hitSlop={8}>
                    <Feather name="x-circle" size={18} color={colors.mutedForeground} />
                  </Pressable>
                ) : <Feather name="chevron-right" size={17} color={colors.mutedForeground} />}
              </Pressable>

              <Text style={[styles.label, { color: colors.foreground }]}>Título</Text>
              <TextInput
                accessibilityLabel="Título da meta"
                autoCapitalize="sentences"
                onChangeText={setTitle}
                placeholder="Ex.: Viagem, reserva ou carro novo"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
                value={title}
              />

              <Text style={[styles.label, { color: colors.foreground }]}>Valor da meta</Text>
              <TextInput
                accessibilityLabel="Valor da meta"
                keyboardType="decimal-pad"
                onChangeText={(value) => setAmount(formatAmountInput(value))}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
                value={amount}
              />

              <Text style={[styles.label, { color: colors.foreground }]}>Data final</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Selecionar data final da meta" onPress={() => setDatePickerOpen(true)} style={({ pressed }) => [styles.dateInput, { backgroundColor: colors.card, borderColor: colors.input }, pressed && styles.pressed]}>
                <Feather name="calendar" size={16} color={colors.mutedForeground} />
                <Text style={[styles.dateText, { color: deadline ? colors.foreground : colors.mutedForeground }]}>{deadline || 'Selecionar data (opcional)'}</Text>
                {deadline ? (
                  <Pressable accessibilityLabel="Limpar data final" onPress={() => setDeadline('')} hitSlop={8}>
                    <Feather name="x-circle" size={17} color={colors.mutedForeground} />
                  </Pressable>
                ) : <Feather name="chevron-down" size={16} color={colors.mutedForeground} />}
              </Pressable>

              <Pressable disabled={saving} onPress={() => void saveGoal()} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled, pressed && styles.pressed]}>
                <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{saving ? 'Salvando...' : editingGoal ? 'Salvar alterações' : 'Criar meta'}</Text>
              </Pressable>
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>
      <DatePickerModal
        visible={datePickerOpen}
        value={parseDateInput(deadline) ?? new Date()}
        eyebrow="DATA FINAL"
        onClose={() => setDatePickerOpen(false)}
        onConfirm={(date) => {
          setDeadline(`${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`);
          setDatePickerOpen(false);
        }}
      />
      <ConfirmationModal
        visible={deleteTarget !== null}
        title={deleteTarget ? `Excluir a meta "${deleteTarget.title}"?` : 'Excluir meta?'}
        message="A meta será removida, mas os lançamentos associados continuarão salvos."
        confirmLabel="Excluir"
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
        errorTitle="Não foi possível excluir"
      />
    </View>
  );
}

function ScrollContent({
  colors,
  insets,
  goals,
  transactions,
  loading,
  error,
  refresh,
  onNew,
  onEdit,
  onDelete,
}: {
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
  goals: Goal[];
  transactions: import('@/types/transaction').Transaction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  onNew: () => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
}) {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const goalsWithProgress = goals.map((goal) => ({
    goal,
    ...calculateGoalProgress(goal, transactions),
  }));
  const visibleGoals = goalsWithProgress.filter(({ percentage }) => activeTab === 'completed' ? percentage >= 100 : percentage < 100);

  return (
    <KeyboardAwareScrollViewCompat
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader eyebrow="Planejamento" title="Metas e objetivos" showBack />
      <View style={styles.introRow}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>Acompanhe o dinheiro separado para seus próximos objetivos.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Criar nova meta" onPress={onNew} style={({ pressed }) => [styles.newButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
          <Feather name="plus" size={15} color={colors.primaryForeground} />
          <Text style={[styles.newButtonText, { color: colors.primaryForeground }]}>Nova</Text>
        </Pressable>
      </View>
      <GoalTabs
        activeTab={activeTab}
        activeCount={goals.filter((goal) => calculateGoalProgress(goal, transactions).percentage < 100).length}
        completedCount={goals.filter((goal) => calculateGoalProgress(goal, transactions).percentage >= 100).length}
        onChange={setActiveTab}
        colors={colors}
      />
      {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : visibleGoals.length === 0 ? (
        <EmptyState message={activeTab === 'active' ? 'Você não tem metas ativas.' : 'Você ainda não concluiu nenhuma meta.'} />
      ) : visibleGoals.map(({ goal, ...progress }) => {
        return (
          <GoalCard
            key={goal.id}
            goal={goal}
            {...progress}
            onPress={() => router.push({ pathname: '/more/goal/[id]', params: { id: goal.id } })}
            onEdit={() => onEdit(goal)}
            onDelete={() => onDelete(goal)}
          />
        );
      })}
    </KeyboardAwareScrollViewCompat>
  );
}

function GoalTabs({
  activeTab,
  activeCount,
  completedCount,
  onChange,
  colors,
}: {
  activeTab: 'active' | 'completed';
  activeCount: number;
  completedCount: number;
  onChange: (tab: 'active' | 'completed') => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.tabs, { backgroundColor: colors.secondary }]}>
      {[
        { key: 'active' as const, label: 'Metas ativas', count: activeCount },
        { key: 'completed' as const, label: 'Concluídas', count: completedCount },
      ].map((tab) => {
        const selected = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${tab.label}, ${tab.count} ${tab.count === 1 ? 'meta' : 'metas'}`}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              selected && { backgroundColor: colors.card, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tabText, { color: selected ? colors.foreground : colors.mutedForeground }]}>{tab.label}</Text>
            <View style={[styles.tabCount, { backgroundColor: selected ? colors.primary : colors.background }]}>
              <Text style={[styles.tabCountText, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>{tab.count}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  introRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: -7, marginBottom: 22 },
  intro: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  newButton: { minHeight: 34, borderRadius: 7, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  newButtonText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  tabs: { flexDirection: 'row', borderRadius: 8, padding: 3, gap: 3, marginBottom: 14 },
  tab: { flex: 1, minHeight: 38, borderRadius: 6, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  tabText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  tabCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  tabCountText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  editorModalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  modalCard: { width: '100%', maxWidth: 340, maxHeight: '82%', borderRadius: 10, borderWidth: 1, padding: 14, flexShrink: 1 },
  modalFormScroll: { flexShrink: 1 },
  modalFormContent: { paddingBottom: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  modalEyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.1, textTransform: 'uppercase' },
  modalTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 4 },
  closeButton: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 7, marginTop: 14 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 13, fontFamily: 'Inter_400Regular' },
  imagePicker: { minHeight: 58, borderRadius: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  previewImage: { width: 42, height: 42, borderRadius: 7 },
  imagePickerCopy: { flex: 1 },
  imagePickerTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  imagePickerHint: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  dateInput: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  saveButton: { minHeight: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  saveText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});