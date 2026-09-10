import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LoadingState } from '@/components/StateView';
import { WalletIconView } from '@/components/WalletIconView';
import { useFinance } from '@/context/FinanceContext';
import { useWallets } from '@/context/WalletContext';
import { useColors } from '@/hooks/useColors';
import { CalculatorModal } from '@/components/CalculatorModal';
import {
  PaymentStatus,
  RecurrenceUnit,
  Transaction,
  TransactionType,
} from '@/types/transaction';
import { formatAmountInput, formatAmountValue, parseAmountInput } from '@/utils/currency';
import { createLocalIsoDate, parseStoredDate } from '@/utils/date';
import { DatePickerModal } from '@/components/DatePickerModal';

const RECURRENCE_UNITS: Array<{ value: RecurrenceUnit; label: string; pluralLabel: string }> = [
  { value: 'day', label: 'Dia', pluralLabel: 'dias' },
  { value: 'week', label: 'Semana', pluralLabel: 'semanas' },
  { value: 'month', label: 'Mês', pluralLabel: 'meses' },
  { value: 'year', label: 'Ano', pluralLabel: 'anos' },
];

function toDateInput(dateString?: string): string {
  const date = dateString ? parseStoredDate(dateString) : new Date();
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export default function NewTransactionScreen() {
  const { id, fromTab } = useLocalSearchParams<{ id?: string; fromTab?: string }>();
  const returnToTabs = fromTab === '1';
  const { transactions, loading } = useFinance();
  const transaction = id ? transactions.find((item) => item.id === id) : undefined;
  const colors = useColors();
  const handleExit = () => returnToTabs ? router.replace('/(tabs)') : router.back();

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
        <Pressable onPress={handleExit} style={[styles.notFoundButton, { backgroundColor: colors.primary }]}>
          <Text style={[styles.notFoundButtonText, { color: colors.primaryForeground }]}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return <TransactionForm transaction={transaction} onExit={handleExit} />;
}

function TransactionForm({ transaction, onExit }: { transaction?: Transaction; onExit: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { createTransaction, updateTransaction } = useFinance();
  const { wallets, loading: walletsLoading } = useWallets();
  const isEditing = Boolean(transaction);
  const defaultWallet = wallets.find((wallet) => wallet.isDefault) ?? wallets[0];
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense');
  const [amount, setAmount] = useState(transaction ? transaction.amount.toFixed(2).replace('.', ',') : '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [walletId, setWalletId] = useState(transaction?.walletId ?? '');
  const [destinationWalletId, setDestinationWalletId] = useState(transaction?.destinationWalletId ?? '');
  const [dueDate, setDueDate] = useState(transaction?.dueDate ? toDateInput(transaction.dueDate) : '');
  const [recurrence, setRecurrence] = useState<'none' | 'recurring'>(transaction?.recurrence.kind ?? 'none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(String(transaction?.recurrence.interval ?? 1));
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>(transaction?.recurrence.unit ?? 'month');
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [walletPickerTarget, setWalletPickerTarget] = useState<'source' | 'destination'>('source');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(transaction?.paymentStatus ?? 'paid');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const amountInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isEditing) return;
    const focusTimer = setTimeout(() => amountInputRef.current?.focus(), 350);
    return () => clearTimeout(focusTimer);
  }, [isEditing]);

  useEffect(() => {
    if (!walletId && defaultWallet) setWalletId(defaultWallet.id);
  }, [defaultWallet, walletId]);

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
    if (!walletId) {
      setError('Selecione uma carteira para o lançamento.');
      return;
    }
    if (type === 'transfer' && (!destinationWalletId || destinationWalletId === walletId)) {
      setError('Selecione uma carteira de destino diferente da origem.');
      return;
    }
    const parsedDueDate = dueDate ? parseDateInput(dueDate) : null;
    if (dueDate && !parsedDueDate) {
      setError('Informe uma data de vencimento válida no formato DD/MM/AAAA.');
      return;
    }
    const numericInterval = Number(recurrenceInterval);
    if (recurrence === 'recurring' && (!Number.isInteger(numericInterval) || numericInterval <= 0)) {
      setError('Informe um intervalo de recorrência válido.');
      return;
    }

    const recurrenceValue = recurrence === 'recurring'
      ? { kind: 'recurring' as const, interval: numericInterval, unit: recurrenceUnit }
      : { kind: 'none' as const };

    try {
      setSaving(true);
      setError('');
      if (transaction) {
        await updateTransaction(transaction.id, {
          type,
          amount: numericAmount,
          description: description.trim(),
          walletId,
           destinationWalletId: type === 'transfer' ? destinationWalletId : null,
          dueDate: parsedDueDate ? createLocalIsoDate(parsedDueDate) : null,
          recurrence: recurrenceValue,
          paymentStatus,
        });
      } else {
        await createTransaction({
          walletId,
          type,
          amount: numericAmount,
          description,
          dueDate: parsedDueDate ? createLocalIsoDate(parsedDueDate) : null,
           destinationWalletId: type === 'transfer' ? destinationWalletId : null,
          recurrence: recurrenceValue,
          paymentStatus,
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onExit();
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
          <Pressable accessibilityLabel="Cancelar" onPress={onExit} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
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
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((option) => {
            const active = type === option;
            const isIncome = option === 'income';
            const isTransfer = option === 'transfer';
            return (
              <Pressable
                key={option}
                testID={`${option}-type-option`}
                onPress={() => {
                  setType(option);
                  if (option === 'transfer' && (!destinationWalletId || destinationWalletId === walletId)) {
                    setDestinationWalletId(wallets.find((wallet) => wallet.id !== walletId)?.id ?? '');
                  }
                }}
                style={[styles.segment, active && { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name={isTransfer ? 'repeat' : isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={active ? (isTransfer ? colors.foreground : isIncome ? colors.income : colors.expense) : colors.mutedForeground} />
                <Text numberOfLines={1} style={[styles.segmentText, { color: active ? colors.foreground : colors.mutedForeground }]}>{isTransfer ? 'Transferência' : isIncome ? 'Receita' : 'Despesa'}</Text>
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
            ref={amountInputRef}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={colors.mutedForeground}
            value={amount}
            onChangeText={(value) => setAmount(formatAmountInput(value))}
            style={[styles.amountInput, { color: colors.foreground }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir calculadora para o valor"
            testID="open-calculator-button"
            onPress={() => {
              amountInputRef.current?.blur();
              setCalculatorOpen(true);
            }}
            style={({ pressed }) => [styles.calculatorButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="calculator" size={18} color={colors.foreground} />
          </Pressable>
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

        <Text style={[styles.label, { color: colors.foreground }]}>{type === 'transfer' ? 'Carteira de origem' : 'Carteira'}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Selecionar carteira"
          testID="wallet-select"
          disabled={walletsLoading || wallets.length === 0}
           onPress={() => {
             setWalletPickerTarget('source');
             setWalletPickerOpen(true);
           }}
          style={({ pressed }) => [
            styles.dateInputShell,
            { backgroundColor: colors.card, borderColor: colors.input },
            (walletsLoading || wallets.length === 0) && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <WalletIconView
            icon={(wallets.find((wallet) => wallet.id === walletId) ?? defaultWallet)?.icon ?? 'wallet-outline'}
            size={17}
            color={colors.mutedForeground}
          />
          <Text style={[styles.dateInput, { color: walletId ? colors.foreground : colors.mutedForeground }]}>
            {walletsLoading
              ? 'Carregando carteiras...'
              : wallets.find((wallet) => wallet.id === walletId)?.title ?? 'Selecione uma carteira'}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>

        {type === 'transfer' ? (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Carteira de destino</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Selecionar carteira de destino"
              testID="destination-wallet-select"
              disabled={walletsLoading || wallets.length < 2}
              onPress={() => {
                setWalletPickerTarget('destination');
                setWalletPickerOpen(true);
              }}
              style={({ pressed }) => [
                styles.dateInputShell,
                { backgroundColor: colors.card, borderColor: colors.input },
                (walletsLoading || wallets.length < 2) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <WalletIconView
                icon={(wallets.find((wallet) => wallet.id === destinationWalletId))?.icon ?? 'wallet-outline'}
                size={17}
                color={colors.mutedForeground}
              />
              <Text style={[styles.dateInput, { color: destinationWalletId ? colors.foreground : colors.mutedForeground }]}>
                {walletsLoading
                  ? 'Carregando carteiras...'
                  : wallets.find((wallet) => wallet.id === destinationWalletId)?.title ?? 'Selecione uma carteira'}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
            {wallets.length < 2 ? (
              <Text style={[styles.intervalHint, { color: colors.mutedForeground }]}>
                Cadastre pelo menos duas carteiras para fazer uma transferência.
              </Text>
            ) : null}
          </>
        ) : null}

        <Text style={[styles.label, { color: colors.foreground }]}>Data de vencimento</Text>
        <Pressable
            accessibilityRole="button"
            accessibilityLabel="Selecionar data de vencimento"
            testID="due-date-picker"
            onPress={() => setDatePickerOpen(true)}
            style={({ pressed }) => [
              styles.dateInputShell,
              { backgroundColor: colors.card, borderColor: colors.input },
              pressed && styles.pressed,
            ]}
        >
          <Feather name="calendar" size={16} color={colors.mutedForeground} />
          <Text style={[styles.dateInput, { color: dueDate ? colors.foreground : colors.mutedForeground }]}>
            {dueDate || 'Selecionar data (opcional)'}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>

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

        {recurrence === 'recurring' ? (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Intervalo da recorrência</Text>
            <View style={styles.intervalRow}>
              <View style={[styles.intervalInputShell, { backgroundColor: colors.card, borderColor: colors.input }]}>
                <TextInput
                  accessibilityLabel="Quantidade do intervalo"
                  testID="recurrence-interval-input"
                  keyboardType="number-pad"
                  maxLength={3}
                  value={recurrenceInterval}
                  onChangeText={(value) => setRecurrenceInterval(value.replace(/\D/g, ''))}
                  style={[styles.intervalInput, { color: colors.foreground }]}
                />
              </View>
              <Pressable
                accessibilityLabel="Selecionar unidade da recorrência"
                testID="recurrence-unit-select"
                onPress={() => setUnitPickerOpen(true)}
                style={({ pressed }) => [
                  styles.unitSelect,
                  { backgroundColor: colors.card, borderColor: colors.input },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.unitSelectText, { color: colors.foreground }]}>
                  {RECURRENCE_UNITS.find((option) => option.value === recurrenceUnit)?.label}
                </Text>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={[styles.intervalHint, { color: colors.mutedForeground }]}>
              O lançamento será repetido a cada {recurrenceInterval || '—'} {
                recurrenceInterval === '1'
                  ? RECURRENCE_UNITS.find((option) => option.value === recurrenceUnit)?.label.toLowerCase()
                  : RECURRENCE_UNITS.find((option) => option.value === recurrenceUnit)?.pluralLabel
              }.
            </Text>
          </>
        ) : null}

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
        <Pressable disabled={saving} onPress={onExit} style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
      <DatePickerModal
        visible={datePickerOpen}
        value={parseDateInput(dueDate) ?? new Date()}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={(date) => {
          setDueDate(`${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`);
          setDatePickerOpen(false);
        }}
      />
      <Modal
        animationType="fade"
        transparent
        visible={unitPickerOpen}
        onRequestClose={() => setUnitPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Fechar seletor" onPress={() => setUnitPickerOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.unitMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.unitMenuTitle, { color: colors.foreground }]}>Repetir por</Text>
            {RECURRENCE_UNITS.map((option) => {
              const active = recurrenceUnit === option.value;
              return (
                <Pressable
                  key={option.value}
                  testID={`recurrence-unit-${option.value}`}
                  onPress={() => {
                    setRecurrenceUnit(option.value);
                    setUnitPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.unitMenuOption,
                    { borderColor: colors.border, backgroundColor: active ? colors.secondary : colors.card },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.unitMenuOptionText, { color: colors.foreground }]}>{option.label}</Text>
                  {active ? <Feather name="check" size={16} color={colors.foreground} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={walletPickerOpen}
        onRequestClose={() => setWalletPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Fechar seletor" onPress={() => setWalletPickerOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.unitMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.unitMenuTitle, { color: colors.foreground }]}>
              {walletPickerTarget === 'destination' ? 'Escolha a carteira de destino' : 'Escolha a carteira de origem'}
            </Text>
            {wallets.map((wallet) => {
              const selectedWalletId = walletPickerTarget === 'destination' ? destinationWalletId : walletId;
              const active = wallet.id === selectedWalletId;
              const disabled = walletPickerTarget === 'destination' && wallet.id === walletId;
              return (
                <Pressable
                  key={wallet.id}
                  testID={`wallet-option-${wallet.id}`}
                  disabled={disabled}
                  onPress={() => {
                    if (walletPickerTarget === 'destination') {
                      setDestinationWalletId(wallet.id);
                    } else {
                      setWalletId(wallet.id);
                      if (type === 'transfer' && wallet.id === destinationWalletId) {
                        setDestinationWalletId(wallets.find((item) => item.id !== wallet.id)?.id ?? '');
                      }
                    }
                    setWalletPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.unitMenuOption,
                    { borderColor: colors.border, backgroundColor: active ? colors.secondary : colors.card, opacity: disabled ? 0.45 : 1 },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.walletMenuIcon}>
                    <MaterialCommunityIcons name={wallet.icon} size={18} color={active ? colors.primary : colors.mutedForeground} />
                  </View>
                  <Text numberOfLines={1} style={[styles.walletMenuOptionText, { color: colors.foreground }]}>{wallet.title}</Text>
                  <View style={styles.walletMenuTrailing}>
                    {wallet.isDefault ? <Text style={[styles.defaultWalletLabel, { color: colors.mutedForeground }]}>Padrão</Text> : null}
                    {active ? <Feather name="check" size={16} color={colors.foreground} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
      {calculatorOpen ? (
        <CalculatorModal
          initialValue={amount}
          onClose={() => setCalculatorOpen(false)}
          onApply={(value) => {
            setAmount(formatAmountValue(value));
            setCalculatorOpen(false);
          }}
        />
      ) : null}
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
  segmented: { borderRadius: 8, padding: 3, flexDirection: 'row', gap: 2 },
  segment: { flex: 1, minWidth: 0, minHeight: 48, borderRadius: 6, borderWidth: 1, borderColor: 'transparent', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  segmentText: { flexShrink: 1, fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  inputShell: { minHeight: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginRight: 6 },
  amountInput: { flex: 1, fontSize: 21, fontFamily: 'Inter_700Bold', paddingVertical: 0 },
  calculatorButton: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  textInput: { minHeight: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 13, fontFamily: 'Inter_400Regular' },
  dateInputShell: { minHeight: 46, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  dateInput: { flex: 1, paddingVertical: 0, fontSize: 13, fontFamily: 'Inter_500Medium' },
  defaultWalletLabel: { marginLeft: 'auto', fontSize: 10, fontFamily: 'Inter_500Medium' },
  recurrenceOptions: { flexDirection: 'row', gap: 8 },
  recurrenceOption: { flex: 1, minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 7, height: 7, borderRadius: 4 },
  recurrenceText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  intervalRow: { flexDirection: 'row', gap: 8 },
  intervalInputShell: { width: 76, minHeight: 42, borderRadius: 7, borderWidth: 1, justifyContent: 'center' },
  intervalInput: { paddingHorizontal: 12, paddingVertical: 0, fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  unitSelect: { flex: 1, minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitSelectText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  intervalHint: { marginTop: 6, fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  unitMenu: { width: '100%', maxWidth: 340, borderRadius: 10, borderWidth: 1, padding: 14, gap: 7 },
  unitMenuTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  unitMenuOption: { minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitMenuOptionText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  walletMenuOption: { minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  walletMenuIcon: { width: 24, alignItems: 'flex-start' },
  walletMenuOptionText: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Inter_500Medium', marginLeft: 7 },
  walletMenuTrailing: { minWidth: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  error: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 9 },
  saveButton: { minHeight: 48, borderRadius: 8, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter_700Bold' },
  cancelButton: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});