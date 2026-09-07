import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LoadingState } from '@/components/StateView';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';
import { PaymentStatus, Transaction, TransactionType } from '@/types/transaction';
import { formatAmountInput, parseAmountInput } from '@/utils/currency';

export default function NewTransactionScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { transactions, loading } = useFinance();
  const transaction = id ? transactions.find((item) => item.id === id) : undefined;
  const colors = useColors();

  if (id && loading) {
    return (
      <View style={[styles.screen, styles.centered, { backgroundColor: colors.background }]}>
        <LoadingState />
      </View>
    );
  }

  if (id && !transaction) {
    return (
      <View style={[styles.screen, styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>Lançamento não encontrado</Text>
        <Pressable onPress={() => router.back()} style={[styles.notFoundButton, { backgroundColor: colors.primary }]}>
          <Text style={[styles.notFoundButtonText, { color: colors.primaryForeground }]}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return <TransactionForm transaction={transaction} />;
}

function TransactionForm({ transaction }: { transaction?: Transaction }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { createTransaction, updateTransaction } = useFinance();
  const isEditing = Boolean(transaction);
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense');
  const [amount, setAmount] = useState(transaction ? transaction.amount.toFixed(2).replace('.', ',') : '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [recurrence, setRecurrence] = useState<'none' | 'recurring'>(transaction?.recurrence.kind ?? 'none');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(transaction?.paymentStatus ?? 'paid');
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
      if (transaction) {
        await updateTransaction(transaction.id, {
          type,
          amount: numericAmount,
          description: description.trim(),
          recurrence: { kind: recurrence },
          paymentStatus,
        });
      } else {
        await createTransaction({ type, amount: numericAmount, description, recurrence, paymentStatus });
      }
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
          <Text style={[styles.topTitle, { color: colors.foreground }]}>{isEditing ? 'Editar lançamento' : 'Novo lançamento'}</Text>
          <View style={styles.topSpacer} />
        </View>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          {isEditing ? 'Atualize os dados e o status deste lançamento.' : 'Registre uma movimentação para manter seu saldo sempre atualizado.'}
        </Text>

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

        <Text style={[styles.label, { color: colors.foreground }]}>Status do pagamento</Text>
        <View style={styles.recurrenceOptions}>
          {(['paid', 'unpaid'] as PaymentStatus[]).map((option) => {
            const active = paymentStatus === option;
            return (
              <Pressable key={option} testID={`${option}-status-option`} onPress={() => setPaymentStatus(option)} style={[styles.recurrenceOption, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.secondary : colors.card }]}>
                <View style={[styles.radio, { borderColor: active ? colors.primary : colors.input }]}>{active ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}</View>
                <Text style={[styles.recurrenceText, { color: colors.foreground }]}>{option === 'paid' ? 'Pago' : 'Não pago'}</Text>
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
          <Text style={styles.saveText}>{saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar lançamento'}</Text>
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
  centered: { alignItems: 'center', justifyContent: 'center' },
  notFound: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  notFoundTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  notFoundButton: { minHeight: 42, paddingHorizontal: 20, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  notFoundButtonText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  content: { paddingHorizontal: 16 },
  topBar: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  topSpacer: { width: 32 },
  topTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  intro: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 10, marginBottom: 18 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 14 },
  segmented: { borderRadius: 8, padding: 3, flexDirection: 'row', gap: 3 },
  segment: { flex: 1, minHeight: 38, borderRadius: 6, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  segmentText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  inputShell: { minHeight: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginRight: 6 },
  amountInput: { flex: 1, fontSize: 21, fontFamily: 'Inter_700Bold', paddingVertical: 0 },
  textInput: { minHeight: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 13, fontFamily: 'Inter_400Regular' },
  recurrenceOptions: { flexDirection: 'row', gap: 8 },
  recurrenceOption: { flex: 1, minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 7, height: 7, borderRadius: 4 },
  recurrenceText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  error: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 9 },
  saveButton: { minHeight: 48, borderRadius: 8, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  cancelButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});