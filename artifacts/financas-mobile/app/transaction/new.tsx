import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';
import { TransactionType } from '@/types/transaction';
import { formatAmountInput, parseAmountInput } from '@/utils/currency';

export default function NewTransactionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { createTransaction } = useFinance();
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'recurring'>('none');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const numericAmount = parseAmountInput(amount);
    if (!type || !numericAmount || numericAmount <= 0) {
      setError('Informe um valor maior que zero.');
      return;
    }
    if (!description.trim()) {
      setError('Informe uma descrição para o lançamento.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await createTransaction({ type, amount: numericAmount, description, recurrence });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        bottomOffset={24}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <Pressable accessibilityLabel="Cancelar" onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
            <Feather name="x" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.topTitle, { color: colors.foreground }]}>Novo lançamento</Text>
          <View style={styles.topSpacer} />
        </View>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>Registre uma movimentação para manter seu saldo sempre atualizado.</Text>

        <Text style={[styles.label, { color: colors.foreground }]}>Tipo</Text>
        <View style={[styles.segmented, { backgroundColor: colors.secondary }]}>
          {(['expense', 'income'] as TransactionType[]).map((option) => {
            const active = type === option;
            const isIncome = option === 'income';
            return (
              <Pressable
                key={option}
                testID={`${option}-type-option`}
                onPress={() => setType(option)}
                style={[styles.segment, active && { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name={isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={active ? (isIncome ? colors.income : colors.expense) : colors.mutedForeground} />
                <Text style={[styles.segmentText, { color: active ? colors.foreground : colors.mutedForeground }]}>{isIncome ? 'Receita' : 'Despesa'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Valor</Text>
        <View style={[styles.inputShell, { backgroundColor: colors.card, borderColor: error && !parseAmountInput(amount) ? colors.expense : colors.input }]}>
          <Text style={[styles.currencyPrefix, { color: colors.mutedForeground }]}>R$</Text>
          <TextInput
            accessibilityLabel="Valor"
            testID="amount-input"
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={colors.mutedForeground}
            value={amount}
            onChangeText={(value) => setAmount(formatAmountInput(value))}
            style={[styles.amountInput, { color: colors.foreground }]}
          />
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Descrição</Text>
        <TextInput
          accessibilityLabel="Descrição"
          testID="description-input"
          placeholder="Ex.: Mercado, salário, aluguel..."
          placeholderTextColor={colors.mutedForeground}
          value={description}
          onChangeText={setDescription}
          returnKeyType="done"
          style={[styles.textInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.input }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Recorrência</Text>
        <View style={styles.recurrenceOptions}>
          {(['none', 'recurring'] as const).map((option) => {
            const active = recurrence === option;
            return (
              <Pressable key={option} onPress={() => setRecurrence(option)} style={[styles.recurrenceOption, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.secondary : colors.card }]}>
                <View style={[styles.radio, { borderColor: active ? colors.primary : colors.input }]}>{active ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}</View>
                <Text style={[styles.recurrenceText, { color: colors.foreground }]}>{option === 'none' ? 'Não recorrente' : 'Recorrente'}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={[styles.error, { color: colors.expense }]}>{error}</Text> : null}
        <Pressable
          testID="save-transaction-button"
          disabled={saving}
          onPress={() => void handleSave()}
          style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.saveText}>{saving ? 'Salvando...' : 'Salvar lançamento'}</Text>
          {!saving ? <Feather name="check" size={18} color="#FFFFFF" /> : null}
        </Pressable>
        <Pressable disabled={saving} onPress={() => router.back()} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20 },
  topBar: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  topSpacer: { width: 40 },
  topTitle: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  intro: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_400Regular', marginTop: 16, marginBottom: 27 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 9, marginTop: 19 },
  segmented: { borderRadius: 16, padding: 4, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, minHeight: 47, borderRadius: 13, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  inputShell: { minHeight: 62, borderRadius: 17, borderWidth: 1, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { fontSize: 17, fontFamily: 'Inter_600SemiBold', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 26, fontFamily: 'Inter_700Bold', paddingVertical: 0 },
  textInput: { minHeight: 58, borderRadius: 17, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, fontFamily: 'Inter_400Regular' },
  recurrenceOptions: { gap: 9 },
  recurrenceOption: { minHeight: 54, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  recurrenceText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 13 },
  saveButton: { minHeight: 58, borderRadius: 18, marginTop: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Inter_700Bold' },
  cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});