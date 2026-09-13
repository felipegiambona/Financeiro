import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { LoadingState } from '@/components/StateView';
import { WalletIconView } from '@/components/WalletIconView';
import { useFinance } from '@/context/FinanceContext';
import { useCategories } from '@/context/CategoryContext';
import { useWallets } from '@/context/WalletContext';
import { useGoals } from '@/context/GoalContext';
import { useCards } from '@/context/CardContext';
import { useColors } from '@/hooks/useColors';
import { CalculatorModal } from '@/components/CalculatorModal';
import {
  InstallmentAmountMode,
  PaymentStatus,
  RECURRENCE_PERIODS,
  RecurrenceKind,
  RecurrenceLimitMode,
  RecurrencePeriod,
  Transaction,
  TransactionType,
} from '@/types/transaction';
import { formatAmountInput, formatAmountValue, parseAmountInput } from '@/utils/currency';
import { createLocalIsoDate, parseStoredDate } from '@/utils/date';
import { DatePickerModal } from '@/components/DatePickerModal';
import { CATEGORY_COLORS } from '@/types/category';

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

function getInitialPeriod(transaction?: Transaction): RecurrencePeriod {
  if (transaction?.recurrence.period && transaction.recurrence.period !== 'fixed') return transaction.recurrence.period;
  if (transaction?.recurrence.unit === 'week') return 'weekly';
  if (transaction?.recurrence.unit === 'year') return 'annual';
  return 'monthly';
}

function getInitialLimitMode(transaction?: Transaction): RecurrenceLimitMode {
  if (transaction?.recurrence.kind !== 'recurring') return 'limited';
  return transaction.recurrence.period === 'fixed' || transaction.recurrence.occurrences == null ? 'fixed' : 'limited';
}

function selectedPeriodLabel(period: RecurrencePeriod): string {
  return RECURRENCE_PERIODS.find((option) => option.value === period)?.label ?? 'Mensal';
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
  const { categories, loading: categoriesLoading, createCategory } = useCategories();
  const { wallets, loading: walletsLoading } = useWallets();
  const { goals, refresh: refreshGoals } = useGoals();
  const { cards, loading: cardsLoading } = useCards();
  const isEditing = Boolean(transaction);
  const defaultWallet = wallets.find((wallet) => wallet.isDefault) ?? wallets[0];
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense');
  const [amount, setAmount] = useState(transaction ? transaction.amount.toFixed(2).replace('.', ',') : '');
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [walletId, setWalletId] = useState(transaction?.walletId ?? '');
  const [cardId, setCardId] = useState<string | null>(transaction?.cardId ?? null);
  const [destinationWalletId, setDestinationWalletId] = useState(transaction?.destinationWalletId ?? '');
  const [dueDate, setDueDate] = useState(transaction?.dueDate ? toDateInput(transaction.dueDate) : '');
  const [recurrence, setRecurrence] = useState<RecurrenceKind>(transaction?.recurrence.kind ?? 'none');
  const [recurrenceCount, setRecurrenceCount] = useState(String(transaction?.recurrence.occurrences ?? ''));
  const [recurrencePeriod, setRecurrencePeriod] = useState<RecurrencePeriod>(getInitialPeriod(transaction));
  const [recurrenceLimitMode, setRecurrenceLimitMode] = useState<RecurrenceLimitMode>(getInitialLimitMode(transaction));
  const [installmentCount, setInstallmentCount] = useState(
    transaction?.recurrence.kind === 'installment' ? String(transaction.recurrence.occurrences ?? '') : '',
  );
  const [amountMode, setAmountMode] = useState<InstallmentAmountMode>(transaction?.recurrence.amountMode ?? 'installment');
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);
  const [cardPickerOpen, setCardPickerOpen] = useState(false);
  const [walletPickerTarget, setWalletPickerTarget] = useState<'source' | 'destination'>('source');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(transaction?.paymentStatus ?? 'paid');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null);
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(transaction?.goalId ?? null);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [categoryCreationOpen, setCategoryCreationOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>(CATEGORY_COLORS[0]);
  const [categorySaving, setCategorySaving] = useState(false);
  const amountInputRef = useRef<TextInput>(null);
  const isFixedRecurrence = recurrence === 'recurring' && recurrenceLimitMode === 'fixed';

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
    const selectedPeriod = RECURRENCE_PERIODS.find((option) => option.value === recurrencePeriod) ?? RECURRENCE_PERIODS[2];
    const numericRecurrenceCount = Number(recurrenceCount);
    if (recurrence === 'recurring' && !isFixedRecurrence && (!Number.isInteger(numericRecurrenceCount) || numericRecurrenceCount <= 0)) {
      setError('Informe uma recorrência válida.');
      return;
    }
    const numericInstallmentCount = Number(installmentCount);
    if (recurrence === 'installment' && (!Number.isInteger(numericInstallmentCount) || numericInstallmentCount <= 0)) {
      setError('Informe uma quantidade de parcelas válida.');
      return;
    }

    const recurrenceValue = recurrence === 'recurring'
      ? {
        kind: 'recurring' as const,
        interval: 1,
        unit: selectedPeriod.unit,
        period: selectedPeriod.value,
        ...(isFixedRecurrence ? {} : { occurrences: numericRecurrenceCount }),
      }
      : recurrence === 'installment'
        ? {
          kind: 'installment' as const,
          interval: 1,
          unit: selectedPeriod.unit,
          period: selectedPeriod.value,
          occurrences: numericInstallmentCount,
          amountMode,
        }
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
          cardId: type === 'expense' ? cardId : null,
          categoryId,
          goalId: type === 'expense' || type === 'income' ? goalId : null,
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
          cardId: type === 'expense' ? cardId : null,
          categoryId,
          goalId: type === 'expense' || type === 'income' ? goalId : null,
          dueDate: parsedDueDate ? createLocalIsoDate(parsedDueDate) : null,
          destinationWalletId: type === 'transfer' ? destinationWalletId : null,
          recurrence: recurrenceValue,
          paymentStatus,
        });
      }
      await refreshGoals();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onExit();
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateCategory = async () => {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      Alert.alert('Nome obrigatório', 'Informe um nome para a categoria.');
      return;
    }

    try {
      setCategorySaving(true);
      const category = await createCategory({ name: trimmedName, color: newCategoryColor });
      setCategoryId(category.id);
      setNewCategoryName('');
      setNewCategoryColor(CATEGORY_COLORS[0]);
      setCategoryCreationOpen(false);
    } catch {
      Alert.alert('Não foi possível salvar', 'Verifique se já existe uma categoria com esse nome.');
    } finally {
      setCategorySaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <Pressable accessibilityLabel="Cancelar" onPress={onExit} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
          <Feather name="x" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>{isEditing ? 'Editar lançamento' : 'Novo lançamento'}</Text>
        <Pressable
          testID="save-transaction-button"
          accessibilityLabel={saving ? 'Salvando lançamento' : isEditing ? 'Salvar alterações' : 'Salvar lançamento'}
          disabled={saving}
          onPress={() => void handleSave()}
          style={({ pressed }) => [styles.topSaveButton, { backgroundColor: colors.primary }, saving && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.topSaveText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
          {!saving ? <Feather name="check" size={16} color="#FFFFFF" /> : null}
        </Pressable>
      </View>
      <KeyboardAwareScrollViewCompat
        bottomOffset={24}
        contentContainerStyle={[styles.content, { paddingTop: 8, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          {isEditing ? 'Atualize os dados e o status deste lançamento.' : 'Registre uma movimentação para manter seu saldo sempre atualizado.'}
        </Text>

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
                  if (option === 'transfer') setGoalId(null);
                  if (option !== 'expense') setCardId(null);
                  if (option === 'transfer' && (!destinationWalletId || destinationWalletId === walletId)) {
                    setDestinationWalletId(wallets.find((wallet) => wallet.id !== walletId)?.id ?? '');
                  }
                }}
                style={[styles.segment, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Feather name={isTransfer ? 'repeat' : isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={16} color={active ? colors.primaryForeground : colors.mutedForeground} />
                <Text numberOfLines={1} style={[styles.segmentText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{isTransfer ? 'Transferência' : isIncome ? 'Receita' : 'Despesa'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.foreground }]}>Quanto você gastou?</Text>
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

        <Text style={[styles.label, { color: colors.foreground }]}>Quando?</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Selecionar data"
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

        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>O que foi?</Text>
          <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Descreva e organize este lançamento.</Text>

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

        <Text style={[styles.label, { color: colors.foreground }]}>Categoria</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Selecionar categoria"
          testID="category-select"
          disabled={categoriesLoading}
          onPress={() => setCategoryPickerOpen(true)}
          style={({ pressed }) => [
            styles.dateInputShell,
            { backgroundColor: colors.card, borderColor: colors.input },
            categoriesLoading && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Feather name="tag" size={17} color={categoryId ? (categories.find((item) => item.id === categoryId)?.color ?? colors.mutedForeground) : colors.mutedForeground} />
          <Text style={[styles.dateInput, { color: categoryId ? colors.foreground : colors.mutedForeground }]}>
            {categoriesLoading
              ? 'Carregando categorias...'
              : categories.find((item) => item.id === categoryId)?.name ?? 'Sem categoria'}
          </Text>
          <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
        </Pressable>

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

        {type === 'expense' ? (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Cartão</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Selecionar cartão para a despesa"
              testID="card-select"
              disabled={cardsLoading}
              onPress={() => setCardPickerOpen(true)}
              style={({ pressed }) => [
                styles.dateInputShell,
                { backgroundColor: colors.card, borderColor: colors.input },
                cardsLoading && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Feather name="credit-card" size={17} color={cardId ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.dateInput, { color: cardId ? colors.foreground : colors.mutedForeground }]}>
                {cardsLoading ? 'Carregando cartões...' : cards.find((card) => card.id === cardId)?.name ?? 'Não usar cartão'}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
          </>
        ) : null}

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
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOptionsOpen }}
          testID="more-options-toggle"
          onPress={() => setMoreOptionsOpen((current) => !current)}
          style={({ pressed }) => [
            styles.sectionHeader,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Mais opções</Text>
            <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>Metas, recorrência e status do pagamento.</Text>
          </View>
          <Feather name={moreOptionsOpen ? 'chevron-up' : 'chevron-down'} size={19} color={colors.foreground} />
        </Pressable>

        {moreOptionsOpen ? (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {type === 'expense' || type === 'income' ? (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Meta</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Selecionar meta para esta ${type === 'income' ? 'receita' : 'despesa'}`}
              testID="goal-select"
              onPress={() => setGoalPickerOpen(true)}
              style={({ pressed }) => [styles.dateInputShell, { backgroundColor: colors.card, borderColor: colors.input }, pressed && styles.pressed]}
            >
              <Feather name="target" size={17} color={goalId ? colors.accent : colors.mutedForeground} />
              <Text style={[styles.dateInput, { color: goalId ? colors.foreground : colors.mutedForeground }]}>
                {goals.find((goal) => goal.id === goalId)?.title ?? 'Sem meta associada'}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
            </Pressable>
            <Text style={[styles.intervalHint, { color: colors.mutedForeground }]}>
              {type === 'income'
                ? 'Receitas pagas associadas a uma meta registram uma retirada do valor guardado.'
                : 'Despesas pagas associadas a uma meta entram automaticamente no valor guardado.'}
            </Text>
          </>
        ) : null}

        <Text style={[styles.label, { color: colors.foreground }]}>Recorrência</Text>
        <View style={styles.recurrenceTypeOptions}>
          {(['none', 'recurring', 'installment'] as const).map((option) => {
            const active = recurrence === option;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  if (option === 'recurring' && recurrence !== 'recurring') {
                    setRecurrenceLimitMode('fixed');
                    setRecurrenceCount('');
                  }
                  setRecurrence(option);
                  if (option === 'installment' && recurrencePeriod === 'fixed') setRecurrencePeriod('monthly');
                }}
                style={[styles.recurrenceTypeOption, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card }]}
              >
                <View style={[styles.radio, { borderColor: active ? colors.radio : colors.input }]}>{active ? <View style={[styles.radioDot, { backgroundColor: colors.radio }]} /> : null}</View>
                <Text style={[styles.recurrenceText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                  {option === 'none' ? 'Única' : option === 'recurring' ? 'Recorrente' : 'Parcelado'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {recurrence === 'recurring' || recurrence === 'installment' ? (
          <View style={[styles.schedulePanel, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.scheduleTitle, { color: colors.foreground }]}>
              {recurrence === 'recurring' ? 'Configuração da recorrência' : 'Configuração das parcelas'}
            </Text>
            {recurrence === 'recurring' ? (
              <>
                <Text style={[styles.compactLabel, { color: colors.mutedForeground }]}>Limite da recorrência</Text>
                <View style={styles.recurrenceOptions}>
                  {(['fixed', 'limited'] as RecurrenceLimitMode[]).map((option) => {
                    const active = recurrenceLimitMode === option;
                    return (
                      <Pressable
                        key={option}
                        testID={`recurrence-limit-${option}`}
                        accessibilityLabel={option === 'fixed' ? 'Recorrência fixa' : 'Recorrência com limite'}
                        onPress={() => {
                          setRecurrenceLimitMode(option);
                          if (option === 'fixed') setRecurrenceCount('');
                        }}
                        style={[styles.recurrenceOption, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card }]}
                      >
                        <View style={[styles.radio, { borderColor: active ? colors.radio : colors.input }]}>{active ? <View style={[styles.radioDot, { backgroundColor: colors.radio }]} /> : null}</View>
                        <Text style={[styles.recurrenceText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                          {option === 'fixed' ? 'Fixo' : 'Com limite'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
            <View style={styles.scheduleRow}>
              <View style={styles.scheduleFieldWide}>
                <Text style={[styles.compactLabel, { color: colors.mutedForeground }]}>Intervalo</Text>
                <Pressable
                  accessibilityLabel={`Selecionar intervalo ${recurrence === 'recurring' ? 'da recorrência' : 'das parcelas'}`}
                  testID={recurrence === 'recurring' ? 'recurrence-unit-select' : 'installment-unit-select'}
                  onPress={() => setUnitPickerOpen(true)}
                  style={({ pressed }) => [
                    styles.unitSelect,
                    { backgroundColor: colors.card, borderColor: colors.input },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.unitSelectText, { color: colors.foreground }]}>
                    {selectedPeriodLabel(recurrencePeriod)}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
              {recurrence === 'installment' || !isFixedRecurrence ? (
                <View style={styles.scheduleFieldNarrow}>
                  <Text style={[styles.compactLabel, { color: colors.mutedForeground }]}>
                    {recurrence === 'recurring' ? 'Recorrência' : 'Parcelas'}
                  </Text>
                  <View style={[styles.intervalInputShell, { backgroundColor: colors.card, borderColor: colors.input }]}>
                    <TextInput
                      accessibilityLabel={recurrence === 'recurring' ? 'Recorrência' : 'Quantidade de parcelas'}
                      testID={recurrence === 'recurring' ? 'recurrence-interval-input' : 'installment-count-input'}
                      keyboardType="number-pad"
                      placeholder={recurrence === 'recurring' ? '1' : '0'}
                      placeholderTextColor={colors.mutedForeground}
                      value={recurrence === 'recurring' ? recurrenceCount : installmentCount}
                      onChangeText={(value) => {
                        const sanitized = value.replace(/\D/g, '');
                        if (recurrence === 'recurring') setRecurrenceCount(sanitized);
                        else setInstallmentCount(sanitized);
                      }}
                      style={[styles.intervalInput, { color: colors.foreground }]}
                    />
                  </View>
                </View>
              ) : null}
            </View>
            <Text style={[styles.intervalHint, { color: colors.mutedForeground }]}>
              {isFixedRecurrence
                ? `O lançamento acontecerá continuamente, com intervalo ${selectedPeriodLabel(recurrencePeriod).toLowerCase()}.`
                : recurrence === 'recurring'
                ? `O lançamento acontecerá ${recurrenceCount || '1'} vez(es), com intervalo ${selectedPeriodLabel(recurrencePeriod).toLowerCase()}.`
                : `Serão geradas ${installmentCount || '0'} parcela(s) com intervalo ${selectedPeriodLabel(recurrencePeriod).toLowerCase()}.`}
            </Text>
            {recurrence === 'installment' ? (
              <>
                <Text style={[styles.compactLabel, { color: colors.mutedForeground }]}>Valor considerado</Text>
                <View style={styles.amountModeOptions}>
                  {(['installment', 'total'] as InstallmentAmountMode[]).map((option) => {
                    const active = amountMode === option;
                    return (
                      <Pressable
                        key={option}
                        testID={`amount-mode-${option}`}
                        onPress={() => setAmountMode(option)}
                        style={[styles.amountModeOption, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card }]}
                      >
                        <View style={[styles.radio, { borderColor: active ? colors.radio : colors.input }]}>{active ? <View style={[styles.radioDot, { backgroundColor: colors.radio }]} /> : null}</View>
                        <Text style={[styles.recurrenceText, { color: active ? colors.primaryForeground : colors.foreground }]}>
                          {option === 'installment' ? 'Valor da parcela' : 'Valor total'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.intervalHint, { color: colors.mutedForeground }]}>
                  {amountMode === 'total'
                    ? 'O valor total será dividido pela quantidade de parcelas.'
                    : 'O valor informado será usado em cada parcela.'}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={[styles.label, { color: colors.foreground }]}>Status do pagamento</Text>
        <View style={styles.recurrenceOptions}>
          {(['paid', 'unpaid'] as PaymentStatus[]).map((option) => {
            const active = paymentStatus === option;
            return (
              <Pressable key={option} testID={`${option}-status-option`} onPress={() => setPaymentStatus(option)} style={[styles.recurrenceOption, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card }]}>
                <View style={[styles.radio, { borderColor: active ? colors.radio : colors.input }]}>{active ? <View style={[styles.radioDot, { backgroundColor: colors.radio }]} /> : null}</View>
                <Text style={[styles.recurrenceText, { color: active ? colors.primaryForeground : colors.foreground }]}>{option === 'paid' ? 'Pago' : 'Não pago'}</Text>
              </Pressable>
            );
          })}
        </View>
          </View>
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.expense }]}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saving ? 'Salvando lançamento' : isEditing ? 'Salvar alterações' : 'Salvar lançamento'}
          testID="save-transaction-bottom-button"
          disabled={saving}
          onPress={() => void handleSave()}
          style={({ pressed }) => [
            styles.bottomSaveButton,
            { backgroundColor: colors.primary },
            saving && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.bottomSaveText, { color: colors.primaryForeground }]}>
            {saving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Salvar lançamento'}
          </Text>
          {!saving ? <Feather name="check" size={17} color={colors.primaryForeground} /> : null}
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
        visible={categoryPickerOpen}
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Fechar seletor de categoria" onPress={() => setCategoryPickerOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.unitMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.unitMenuTitle, { color: colors.foreground }]}>Categoria</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Criar nova categoria"
              testID="create-category-from-transaction"
              onPress={() => {
                setCategoryPickerOpen(false);
                setNewCategoryName('');
                setNewCategoryColor(CATEGORY_COLORS[0]);
                setCategoryCreationOpen(true);
              }}
              style={({ pressed }) => [
                styles.createCategoryButton,
                { borderColor: colors.primary, backgroundColor: colors.card },
                pressed && styles.pressed,
              ]}
            >
              <Feather name="plus" size={16} color={colors.income} />
              <Text style={[styles.createCategoryButtonText, { color: colors.income }]}>Criar nova categoria</Text>
            </Pressable>
            <Pressable
              testID="category-option-none"
              onPress={() => {
                setCategoryId(null);
                setCategoryPickerOpen(false);
              }}
              style={({ pressed }) => [
                styles.unitMenuOption,
                { borderColor: categoryId === null ? colors.primary : colors.border, backgroundColor: categoryId === null ? colors.primary : colors.card },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.unitMenuOptionText, { color: categoryId === null ? colors.primaryForeground : colors.foreground }]}>Sem categoria</Text>
              {categoryId === null ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
            </Pressable>
            {categories.map((category) => {
              const active = category.id === categoryId;
              return (
                <Pressable
                  key={category.id}
                  testID={`category-option-${category.id}`}
                  onPress={() => {
                    setCategoryId(category.id);
                    setCategoryPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.unitMenuOption,
                    { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.categoryMenuLabel}>
                    <View style={[styles.categoryMenuDot, { backgroundColor: category.color }]} />
                    <Text numberOfLines={1} style={[styles.unitMenuOptionText, styles.categoryMenuText, { color: active ? colors.primaryForeground : colors.foreground }]}>{category.name}</Text>
                  </View>
                  {active ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
                </Pressable>
              );
            })}
            {categories.length === 0 ? (
              <Text style={[styles.intervalHint, { color: colors.mutedForeground }]}>Crie categorias em Configurações para usá-las aqui.</Text>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={goalPickerOpen}
        onRequestClose={() => setGoalPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Fechar seletor de meta" onPress={() => setGoalPickerOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.unitMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.unitMenuTitle, { color: colors.foreground }]}>Meta do lançamento</Text>
            <Pressable
              testID="goal-option-none"
              onPress={() => {
                setGoalId(null);
                setGoalPickerOpen(false);
              }}
              style={({ pressed }) => [
                styles.unitMenuOption,
                { borderColor: goalId === null ? colors.primary : colors.border, backgroundColor: goalId === null ? colors.primary : colors.card },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.unitMenuOptionText, { color: goalId === null ? colors.primaryForeground : colors.foreground }]}>Sem meta associada</Text>
              {goalId === null ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
            </Pressable>
            {goals.map((goal) => {
              const active = goal.id === goalId;
              return (
                <Pressable
                  key={goal.id}
                  testID={`goal-option-${goal.id}`}
                  onPress={() => {
                    setGoalId(goal.id);
                    setGoalPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.unitMenuOption,
                    { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.categoryMenuLabel}>
                    <Feather name="target" size={16} color={active ? colors.primaryForeground : colors.mutedForeground} />
                    <Text numberOfLines={1} style={[styles.unitMenuOptionText, styles.categoryMenuText, { color: active ? colors.primaryForeground : colors.foreground }]}>{goal.title}</Text>
                  </View>
                  {active ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
                </Pressable>
              );
            })}
            {goals.length === 0 ? (
              <Text style={[styles.intervalHint, { color: colors.mutedForeground }]}>Crie uma meta em Mais para associá-la a este lançamento.</Text>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={categoryCreationOpen}
        onRequestClose={() => {
          if (!categorySaving) setCategoryCreationOpen(false);
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar criação de categoria"
            onPress={() => {
              if (!categorySaving) setCategoryCreationOpen(false);
            }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.unitMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.unitMenuTitle, { color: colors.foreground }]}>Nova categoria</Text>
            <TextInput
              accessibilityLabel="Nome da nova categoria"
              testID="new-category-name-input"
              autoFocus
              placeholder="Ex.: Alimentação"
              placeholderTextColor={colors.mutedForeground}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              style={[styles.categoryInput, { backgroundColor: colors.background, borderColor: colors.input, color: colors.foreground }]}
            />
            <Text style={[styles.categoryColorLabel, { color: colors.foreground }]}>Cor</Text>
            <View style={styles.categoryColorOptions}>
              {CATEGORY_COLORS.map((option) => {
                const selected = newCategoryColor === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Selecionar cor ${option}`}
                    onPress={() => setNewCategoryColor(option)}
                    style={[styles.categoryColorOption, { backgroundColor: option, borderColor: selected ? colors.foreground : 'transparent' }]}
                  >
                    {selected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.categoryModalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={categorySaving}
                onPress={() => setCategoryCreationOpen(false)}
                style={({ pressed }) => [styles.categoryCancelButton, { borderColor: colors.border }, categorySaving && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.categoryCancelText, { color: colors.foreground }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID="save-new-category"
                disabled={categorySaving}
                onPress={() => void handleCreateCategory()}
                style={({ pressed }) => [styles.categorySaveButton, { backgroundColor: colors.primary }, categorySaving && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.categorySaveText, { color: colors.primaryForeground }]}>
                  {categorySaving ? 'Salvando...' : 'Salvar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={unitPickerOpen}
        onRequestClose={() => setUnitPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Fechar seletor" onPress={() => setUnitPickerOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.unitMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.unitMenuTitle, { color: colors.foreground }]}>Intervalo</Text>
            {RECURRENCE_PERIODS.map((option) => {
              const active = recurrencePeriod === option.value;
              return (
                <Pressable
                  key={option.value}
                  testID={`recurrence-period-${option.value}`}
                  onPress={() => {
                    setRecurrencePeriod(option.value);
                    setUnitPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.unitMenuOption,
                    { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.unitMenuOptionText, { color: active ? colors.primaryForeground : colors.foreground }]}>{option.label}</Text>
                  {active ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
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
                    { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card, opacity: disabled ? 0.45 : 1 },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.walletMenuIcon}>
                    <WalletIconView icon={wallet.icon} size={18} color={active ? colors.primaryForeground : colors.mutedForeground} />
                  </View>
                  <Text numberOfLines={1} style={[styles.walletMenuOptionText, { color: active ? colors.primaryForeground : colors.foreground }]}>{wallet.title}</Text>
                  <View style={styles.walletMenuTrailing}>
                    {wallet.isDefault ? <Text style={[styles.defaultWalletLabel, { color: colors.mutedForeground }]}>Padrão</Text> : null}
                    {active ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        transparent
        visible={cardPickerOpen}
        onRequestClose={() => setCardPickerOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable accessibilityLabel="Fechar seletor de cartão" onPress={() => setCardPickerOpen(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.unitMenu, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.unitMenuTitle, { color: colors.foreground }]}>Cartão da despesa</Text>
            <Pressable
              testID="card-option-none"
              onPress={() => {
                setCardId(null);
                setCardPickerOpen(false);
              }}
              style={({ pressed }) => [
                styles.unitMenuOption,
                { borderColor: cardId === null ? colors.primary : colors.border, backgroundColor: cardId === null ? colors.primary : colors.card },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.unitMenuOptionText, { color: cardId === null ? colors.primaryForeground : colors.foreground }]}>Não usar cartão</Text>
              {cardId === null ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
            </Pressable>
            {cards.map((card) => {
              const active = card.id === cardId;
              return (
                <Pressable
                  key={card.id}
                  testID={`card-option-${card.id}`}
                  onPress={() => {
                    setCardId(card.id);
                    setCardPickerOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.unitMenuOption,
                    { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.card },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.categoryMenuLabel}>
                    <Feather name="credit-card" size={16} color={active ? colors.primaryForeground : colors.mutedForeground} />
                    <Text numberOfLines={1} style={[styles.unitMenuOptionText, styles.categoryMenuText, { color: active ? colors.primaryForeground : colors.foreground }]}>{card.name}</Text>
                  </View>
                  {active ? <Feather name="check" size={16} color={colors.primaryForeground} /> : null}
                </Pressable>
              );
            })}
            {cards.length === 0 ? (
              <Text style={[styles.intervalHint, { color: colors.mutedForeground }]}>Cadastre um cartão em Mais para associá-lo a esta despesa.</Text>
            ) : null}
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
  topBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  closeButton: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, minWidth: 0, fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  topSaveButton: { minHeight: 34, maxWidth: 154, borderRadius: 7, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  topSaveText: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_700Bold', flexShrink: 1 },
  bottomSaveButton: { minHeight: 46, borderRadius: 8, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  bottomSaveText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  intro: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: 10, marginBottom: 18 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 6, marginTop: 14 },
  sectionCard: { borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 16 },
  sectionHeader: { minHeight: 62, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  sectionTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  sectionHint: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular', marginTop: 3 },
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
  recurrenceOption: { flex: 1, minWidth: 140, minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  recurrenceTypeOptions: { flexDirection: 'row', gap: 6 },
  recurrenceTypeOption: { flex: 1, minWidth: 0, minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 5 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 7, height: 7, borderRadius: 4 },
  recurrenceText: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  schedulePanel: { borderRadius: 9, borderWidth: 1, padding: 10, marginTop: 10, gap: 8 },
  scheduleTitle: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  scheduleRow: { flexDirection: 'row', gap: 8 },
  scheduleFieldWide: { flex: 1, minWidth: 0, gap: 5 },
  scheduleFieldNarrow: { width: 104, gap: 5 },
  compactLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  amountModeOptions: { flexDirection: 'row', gap: 8 },
  amountModeOption: { flex: 1, minHeight: 38, borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  intervalInputShell: { width: '100%', minHeight: 42, borderRadius: 7, borderWidth: 1, justifyContent: 'center' },
  intervalInput: { paddingHorizontal: 12, paddingVertical: 0, fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  unitSelect: { flex: 1, minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitSelectText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  intervalHint: { marginTop: 6, fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  unitMenu: { width: '100%', maxWidth: 340, borderRadius: 10, borderWidth: 1, padding: 14, gap: 7 },
  unitMenuTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  createCategoryButton: { minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  createCategoryButtonText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  unitMenuOption: { minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  unitMenuOptionText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  walletMenuOption: { minHeight: 42, borderRadius: 7, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  walletMenuIcon: { width: 24, alignItems: 'flex-start' },
  walletMenuOptionText: { flex: 1, minWidth: 0, fontSize: 13, fontFamily: 'Inter_500Medium', marginLeft: 7 },
  walletMenuTrailing: { minWidth: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  categoryMenuLabel: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  categoryMenuDot: { width: 10, height: 10, borderRadius: 5 },
  categoryMenuText: { flex: 1, minWidth: 0 },
  categoryInput: { minHeight: 46, borderRadius: 7, borderWidth: 1, paddingHorizontal: 12, fontSize: 13, fontFamily: 'Inter_400Regular' },
  categoryColorLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 9 },
  categoryColorOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 7, marginBottom: 8 },
  categoryColorOption: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  categoryModalActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  categoryCancelButton: { flex: 1, minHeight: 40, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  categorySaveButton: { flex: 1, minHeight: 40, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  categoryCancelText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  categorySaveText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  error: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 9 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});