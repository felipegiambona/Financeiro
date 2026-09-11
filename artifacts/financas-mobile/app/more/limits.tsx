import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LimitCard } from '@/components/LimitCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useCategories } from '@/context/CategoryContext';
import { useFinance } from '@/context/FinanceContext';
import { useLimits } from '@/context/LimitContext';
import { useColors } from '@/hooks/useColors';
import { calculateLimitUsage } from '@/services/limitRules';
import { formatAmountValue, parseAmountInput } from '@/utils/currency';
import type { Limit, LimitPeriod } from '@/types/limit';
import { LIMIT_PERIODS } from '@/types/limit';

export default function LimitsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions } = useFinance();
  const { categories } = useCategories();
  const { limits, loading, error, refresh, createLimit, updateLimit, deleteLimit } = useLimits();
  const { openNew, editId, deleteId } = useLocalSearchParams<{ openNew?: string; editId?: string; deleteId?: string }>();
  const handledRouteAction = useRef(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [periodPickerOpen, setPeriodPickerOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<Limit | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<LimitPeriod>('monthly');
  const [saving, setSaving] = useState(false);

  const openEditor = (limit?: Limit) => {
    setEditingLimit(limit ?? null);
    setCategoryId(limit?.categoryId ?? '');
    setDescription(limit?.description ?? '');
    setAmount(limit ? formatAmountValue(limit.amount) : '');
    setPeriod(limit?.period ?? 'monthly');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (!saving) {
      setCategoryPickerOpen(false);
      setPeriodPickerOpen(false);
      setEditorOpen(false);
    }
  };

  useEffect(() => {
    if (loading || handledRouteAction.current) return;
    const editLimit = editId ? limits.find((limit) => limit.id === editId) : undefined;
    const deleteLimitTarget = deleteId ? limits.find((limit) => limit.id === deleteId) : undefined;
    if (openNew === '1') {
      handledRouteAction.current = true;
      openEditor();
    } else if (editLimit) {
      handledRouteAction.current = true;
      openEditor(editLimit);
    } else if (deleteLimitTarget) {
      handledRouteAction.current = true;
      confirmDelete(deleteLimitTarget);
    }
  }, [deleteId, editId, limits, loading, openNew]);

  const saveLimit = async () => {
    const numericAmount = parseAmountInput(amount);
    if (!categoryId) {
      Alert.alert('Categoria obrigatória', 'Selecione uma categoria para o limite.');
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor maior que zero.');
      return;
    }
    try {
      setSaving(true);
      const input = {
        categoryId,
        description: description.trim() || null,
        amount: numericAmount,
        period,
      };
      if (editingLimit) {
        await updateLimit(editingLimit.id, input);
      } else {
        await createLimit(input);
      }
      setEditorOpen(false);
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  function confirmDelete(limit: Limit) {
    const categoryName = categories.find((category) => category.id === limit.categoryId)?.name ?? 'este limite';
    Alert.alert(
      `Excluir limite de ${categoryName}?`,
      'O limite será removido, mas os lançamentos continuarão salvos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void deleteLimit(limit.id).catch(() => {
              Alert.alert('Não foi possível excluir', 'Tente novamente.');
            });
          },
        },
      ],
    );
  }

  const selectedCategory = categories.find((category) => category.id === categoryId);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Organização"
          title="Meus limites"
          showBack
          actionLabel="Novo"
          actionIcon="plus"
          onAction={() => openEditor()}
        />
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Defina quanto pode gastar em cada categoria e acompanhe o uso no período escolhido.
        </Text>
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : limits.length === 0 ? (
          <EmptyState message="Você ainda não criou nenhum limite." />
        ) : (
          limits.map((limit) => (
            <LimitCard
              key={limit.id}
              limit={limit}
              categoryName={categories.find((category) => category.id === limit.categoryId)?.name ?? 'Categoria'}
              usage={calculateLimitUsage(limit, transactions)}
              onEdit={() => openEditor(limit)}
              onDelete={() => confirmDelete(limit)}
            />
          ))
        )}
      </KeyboardAwareScrollViewCompat>

      <Modal animationType="fade" transparent visible={editorOpen} onRequestClose={closeEditor}>
        <View style={styles.editorModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditor} />
          <KeyboardAwareScrollViewCompat
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalEyebrow, { color: colors.mutedForeground }]}>Limite de gastos</Text>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                    {editingLimit ? 'Editar limite' : 'Novo limite'}
                  </Text>
                </View>
                <Pressable accessibilityLabel="Fechar" onPress={closeEditor} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                  <Feather name="x" size={18} color={colors.foreground} />
                </Pressable>
              </View>

              <Text style={[styles.label, { color: colors.foreground }]}>Categoria *</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Selecionar categoria do limite"
                testID="limit-category-picker"
                onPress={() => setCategoryPickerOpen(true)}
                style={({ pressed }) => [styles.select, { backgroundColor: colors.background, borderColor: colors.input }, pressed && styles.pressed]}
              >
                <Text style={[styles.selectText, { color: selectedCategory ? colors.foreground : colors.mutedForeground }]}>
                  {selectedCategory?.name ?? 'Selecione uma categoria'}
                </Text>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </Pressable>

              <Text style={[styles.label, { color: colors.foreground }]}>Nome do lançamento (opcional)</Text>
              <TextInput
                accessibilityLabel="Nome do lançamento do limite"
                testID="limit-description-input"
                placeholder="Ex.: Mercado, Uber ou aluguel"
                placeholderTextColor={colors.mutedForeground}
                value={description}
                onChangeText={setDescription}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
              />

              <Text style={[styles.label, { color: colors.foreground }]}>Valor do limite *</Text>
              <TextInput
                accessibilityLabel="Valor do limite"
                testID="limit-amount-input"
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                value={amount}
                onChangeText={setAmount}
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
              />

               <Text style={[styles.label, { color: colors.foreground }]}>Recorrência *</Text>
               <Pressable
                 accessibilityRole="button"
                 accessibilityLabel="Selecionar recorrência do limite"
                 testID="limit-period-picker"
                 onPress={() => setPeriodPickerOpen(true)}
                 style={({ pressed }) => [styles.select, { backgroundColor: colors.background, borderColor: colors.input }, pressed && styles.pressed]}
               >
                 <Text style={[styles.selectText, { color: colors.foreground }]}>
                   {LIMIT_PERIODS.find((option) => option.value === period)?.label ?? 'Selecione uma recorrência'}
                 </Text>
                 <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
               </Pressable>

              <View style={styles.modalActions}>
                <Pressable disabled={saving} onPress={closeEditor} style={({ pressed }) => [styles.cancelButton, { borderColor: colors.border }, pressed && styles.pressed]}>
                  <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancelar</Text>
                </Pressable>
                <Pressable disabled={saving} onPress={() => void saveLimit()} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled, pressed && styles.pressed]}>
                  <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{saving ? 'Salvando...' : 'Salvar'}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={categoryPickerOpen} onRequestClose={() => setCategoryPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCategoryPickerOpen(false)} />
          <View style={[styles.pickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Escolha a categoria</Text>
              <Pressable accessibilityLabel="Fechar seleção de categoria" onPress={() => setCategoryPickerOpen(false)} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            {categories.length === 0 ? (
              <Text style={[styles.pickerEmpty, { color: colors.mutedForeground }]}>Crie uma categoria antes de configurar um limite.</Text>
            ) : (
              categories.map((category) => (
                <Pressable
                  key={category.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: category.id === categoryId }}
                  accessibilityLabel={`Selecionar categoria ${category.name}`}
                  onPress={() => {
                    setCategoryId(category.id);
                    setCategoryPickerOpen(false);
                  }}
                  style={({ pressed }) => [styles.categoryOption, { borderBottomColor: colors.border }, pressed && styles.pressed]}
                >
                  <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                  <Text style={[styles.categoryName, { color: colors.foreground }]}>{category.name}</Text>
                  {category.id === categoryId ? <Feather name="check" size={17} color={colors.primary} /> : null}
                </Pressable>
              ))
            )}
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={periodPickerOpen} onRequestClose={() => setPeriodPickerOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPeriodPickerOpen(false)} />
          <View style={[styles.pickerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Escolha a recorrência</Text>
              <Pressable accessibilityLabel="Fechar seleção de recorrência" onPress={() => setPeriodPickerOpen(false)} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                <Feather name="x" size={18} color={colors.foreground} />
              </Pressable>
            </View>
            {LIMIT_PERIODS.map((option) => (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: option.value === period }}
                accessibilityLabel={`Selecionar recorrência ${option.label}`}
                onPress={() => {
                  setPeriod(option.value);
                  setPeriodPickerOpen(false);
                }}
                style={({ pressed }) => [styles.categoryOption, { borderBottomColor: colors.border }, pressed && styles.pressed]}
              >
                <Text style={[styles.categoryName, { color: colors.foreground }]}>{option.label}</Text>
                {option.value === period ? <Feather name="check" size={17} color={colors.accent} /> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  intro: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: -7, marginBottom: 22 },
  editorModalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', padding: 10 },
  modalScrollContent: { flexGrow: 1, width: '100%', alignItems: 'stretch', justifyContent: 'center', paddingVertical: 18 },
  modalCard: { width: '100%', maxWidth: 340, maxHeight: '82%', borderRadius: 12, borderWidth: 1, padding: 14, flexShrink: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalEyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.1, textTransform: 'uppercase' },
  modalTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 4 },
  closeButton: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 7 },
  select: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  selectText: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular' },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 8 },
  cancelButton: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveButton: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  saveText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  pickerCard: { width: '100%', maxWidth: 390, maxHeight: '75%', borderRadius: 12, borderWidth: 1, padding: 18 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  pickerEmpty: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', paddingVertical: 16 },
  categoryOption: { minHeight: 48, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryDot: { width: 13, height: 13, borderRadius: 7 },
  categoryName: { flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});