import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useInvestments } from '@/context/InvestmentContext';
import { useColors } from '@/hooks/useColors';
import type { Investment, InvestmentAssetType, InvestmentInput, InvestmentUpdate, InvestmentValuationMode } from '@workspace/api-client-react';
import { formatAmountInput, formatAmountValue, formatCurrency, parseAmountInput } from '@/utils/currency';

const ASSET_TYPES: Array<{ value: InvestmentAssetType; label: string }> = [
  { value: 'stock', label: 'Ações' },
  { value: 'fii', label: 'FIIs' },
  { value: 'etf', label: 'ETFs' },
  { value: 'fund', label: 'Fundos' },
  { value: 'fixed_income', label: 'Renda fixa' },
  { value: 'crypto', label: 'Cripto' },
  { value: 'other', label: 'Outros' },
];

type AssetSuggestion = {
  name: string;
  ticker: string;
  assetType: InvestmentAssetType;
};

const ASSET_SUGGESTIONS: AssetSuggestion[] = [
  { name: 'Petrobras PN', ticker: 'PETR4', assetType: 'stock' },
  { name: 'Vale ON', ticker: 'VALE3', assetType: 'stock' },
  { name: 'Itaú Unibanco PN', ticker: 'ITUB4', assetType: 'stock' },
  { name: 'Banco do Brasil ON', ticker: 'BBAS3', assetType: 'stock' },
  { name: 'WEG ON', ticker: 'WEGE3', assetType: 'stock' },
  { name: 'BOVA11', ticker: 'BOVA11', assetType: 'etf' },
  { name: 'IVVB11', ticker: 'IVVB11', assetType: 'etf' },
  { name: 'HGLG11', ticker: 'HGLG11', assetType: 'fii' },
  { name: 'MXRF11', ticker: 'MXRF11', assetType: 'fii' },
  { name: 'KNRI11', ticker: 'KNRI11', assetType: 'fii' },
  { name: 'Tesouro Selic', ticker: 'Tesouro Selic', assetType: 'fixed_income' },
  { name: 'Tesouro IPCA+', ticker: 'Tesouro IPCA+', assetType: 'fixed_income' },
  { name: 'Bitcoin', ticker: 'BTC', assetType: 'crypto' },
];

function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function assetTypeLabel(type: InvestmentAssetType): string {
  return ASSET_TYPES.find((item) => item.value === type)?.label ?? 'Outros';
}

function formatQuantityInput(value: string): string {
  const normalized = value.replace(/\./g, ',').replace(/[^\d,]/g, '');
  const [integer, decimal] = normalized.split(',');
  if (decimal === undefined) return integer;
  return `${integer || '0'},${decimal.slice(0, 8)}`;
}

function parseQuantityInput(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', '.'));
}

function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2).replace('.', ',')}%`;
}

function formatQuoteDate(value: string | null): string {
  if (!value) return 'ainda não consultada';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function quoteStatusText(investment: Investment): string {
  if (investment.valuationMode === 'manual') return 'Manual · valor informado por você';
  if (investment.quoteStatus === 'updated') {
    return `${investment.quoteSource ?? 'Fonte de mercado'} · ${formatQuoteDate(investment.lastQuoteAt)}`;
  }
  if (investment.quoteStatus === 'pending') return `${investment.quoteSource ?? 'Fonte de mercado'} · aguardando cotação`;
  if (investment.quoteStatus === 'unavailable') return `${investment.quoteSource ?? 'Fonte de mercado'} · sem cotação`;
  return `${investment.quoteSource ?? 'Fonte de mercado'} · falha em ${formatQuoteDate(investment.lastQuoteAt)}`;
}

function getInitialForm(investment?: Investment) {
  return {
    name: investment?.name ?? '',
    ticker: investment?.ticker ?? '',
    assetType: investment?.assetType ?? 'stock' as InvestmentAssetType,
    institution: investment?.institution ?? '',
    quantity: investment ? formatQuantityInput(String(investment.quantity).replace('.', ',')) : '',
    averagePrice: investment ? formatAmountValue(investment.averagePrice) : '',
    investedAmount: investment ? formatAmountValue(investment.investedAmount) : '',
    currentValue: investment ? formatAmountValue(investment.manualCurrentValue) : '',
    valuationMode: investment?.valuationMode ?? 'manual' as InvestmentValuationMode,
  };
}

export default function InvestmentsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { investments, loading, error, refresh, refreshQuotes, createInvestment, updateInvestment, deleteInvestment } = useInvestments();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [form, setForm] = useState(() => getInitialForm());
  const [nameFocused, setNameFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [investmentToDelete, setInvestmentToDelete] = useState<Investment | null>(null);

  const totals = useMemo(() => investments.reduce((summary, investment) => ({
    invested: summary.invested + investment.investedAmount,
    current: summary.current + investment.currentValue,
    result: summary.result + investment.returnAmount,
  }), { invested: 0, current: 0, result: 0 }), [investments]);
  const totalPercentage = totals.invested > 0 ? (totals.result / totals.invested) * 100 : 0;
  const assetSuggestions = useMemo(() => {
    const query = normalizeSearch(form.name);
    if (!nameFocused || !query) return [];
    return ASSET_SUGGESTIONS
      .filter((suggestion) => (
        normalizeSearch(suggestion.name).includes(query)
        || normalizeSearch(suggestion.ticker).includes(query)
      ))
      .slice(0, 6);
  }, [form.name, nameFocused]);

  const openEditor = (investment?: Investment) => {
    setEditingInvestment(investment ?? null);
    setForm(getInitialForm(investment));
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (!saving) setEditorOpen(false);
  };

  const selectAssetSuggestion = (suggestion: AssetSuggestion) => {
    setForm((current) => ({
      ...current,
      name: suggestion.name,
      ticker: suggestion.ticker,
      assetType: suggestion.assetType,
    }));
    setNameFocused(false);
  };

  const saveInvestment = async () => {
    const name = form.name.trim();
    const quantity = parseQuantityInput(form.quantity);
    const averagePrice = parseAmountInput(form.averagePrice);
    const investedAmount = parseAmountInput(form.investedAmount);
    const currentValue = parseAmountInput(form.currentValue);
    if (!name) {
      Alert.alert('Nome obrigatório', 'Informe o nome ou código do ativo.');
      return;
    }
    if ([quantity, averagePrice, investedAmount, currentValue].some((value) => !Number.isFinite(value) || value < 0)) {
      Alert.alert('Valores inválidos', 'Informe valores numéricos iguais ou maiores que zero.');
      return;
    }

    const input: InvestmentInput = {
      name,
      ticker: form.ticker.trim() || undefined,
      assetType: form.assetType,
      institution: form.institution.trim() || undefined,
      quantity,
      averagePrice,
      investedAmount,
      currentValue,
      valuationMode: form.valuationMode,
    };
    try {
      setSaving(true);
      if (editingInvestment) {
        const updates: InvestmentUpdate = input;
        await updateInvestment(editingInvestment.id, updates);
      } else {
        await createInvestment(input);
      }
      setEditorOpen(false);
      if (form.valuationMode === 'automatic') {
        void refreshQuotes().catch(() => undefined);
      }
    } catch {
      Alert.alert('Não foi possível salvar', 'Confira os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!investmentToDelete) return;
    try {
      setDeleting(true);
      await deleteInvestment(investmentToDelete.id);
      setInvestmentToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Patrimônio"
          title="Investimentos"
          showBack
          actionLabel="Novo"
          actionIcon="plus"
          onAction={() => openEditor()}
        />
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
           Acompanhe sua carteira pessoal com valor manual ou cotações automáticas.
        </Text>
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : (
          <>
            <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
              <Text style={styles.summaryLabel}>Patrimônio investido</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.summaryValue}>{formatCurrency(totals.current)}</Text>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryMetaLabel}>Valor investido</Text>
                  <Text style={styles.summaryMetaValue}>{formatCurrency(totals.invested)}</Text>
                </View>
                <View style={styles.summaryResult}>
                  <Text style={styles.summaryMetaLabel}>Resultado</Text>
                  <Text style={[styles.summaryMetaValue, { color: totals.result >= 0 ? colors.accent : '#FFB4B4' }]}>
                    {formatCurrency(totals.result)}
                  </Text>
                  <Text style={[styles.summaryPercentage, { color: totals.result >= 0 ? colors.accent : '#FFB4B4' }]}>
                    {formatPercentage(totalPercentage)}
                  </Text>
                </View>
              </View>
              {investments.some((investment) => investment.valuationMode === 'automatic') && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Atualizar cotações"
                  onPress={() => void refreshQuotes().catch(() => Alert.alert('Cotação indisponível', 'Os valores atuais foram mantidos. Tente novamente mais tarde.'))}
                  style={({ pressed }) => [styles.quoteRefresh, pressed && styles.pressed]}
                >
                  <Feather name="refresh-cw" size={12} color="#FFFFFF" />
                  <Text style={styles.quoteRefreshText}>Atualizar cotações</Text>
                </Pressable>
              )}
            </View>
            {investments.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState message="Você ainda não cadastrou nenhum investimento." />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cadastrar primeiro investimento"
                  onPress={() => openEditor()}
                  style={({ pressed }) => [styles.emptyAction, { backgroundColor: colors.primary }, pressed && styles.pressed]}
                >
                  <Feather name="plus" size={15} color={colors.primaryForeground} />
                  <Text style={[styles.emptyActionText, { color: colors.primaryForeground }]}>Cadastrar investimento</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.list}>
                {investments.map((investment) => (
                  <View key={investment.id} style={[styles.investmentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.investmentHeader}>
                      <View style={styles.investmentIdentity}>
                        <View style={[styles.investmentIcon, { backgroundColor: colors.secondary }]}>
                          <Feather name="trending-up" size={17} color={colors.foreground} />
                        </View>
                        <View style={styles.investmentCopy}>
                          <Text numberOfLines={1} style={[styles.investmentName, { color: colors.foreground }]}>{investment.name}</Text>
                          <Text style={[styles.investmentMeta, { color: colors.mutedForeground }]}>
                            {investment.ticker ? `${investment.ticker} · ` : ''}{assetTypeLabel(investment.assetType)}
                            {investment.institution ? ` · ${investment.institution}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.investmentActions}>
                        <Pressable accessibilityLabel={`Editar ${investment.name}`} onPress={() => openEditor(investment)} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                          <Feather name="edit-2" size={14} color={colors.foreground} />
                        </Pressable>
                        <Pressable accessibilityLabel={`Excluir ${investment.name}`} onPress={() => setInvestmentToDelete(investment)} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.expenseSoft }, pressed && styles.pressed]}>
                          <Feather name="trash-2" size={14} color={colors.expense} />
                        </Pressable>
                      </View>
                    </View>
                    <View style={[styles.investmentDetails, { borderTopColor: colors.border }]}>
                      <View>
                        <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Quantidade</Text>
                        <Text style={[styles.detailValue, { color: colors.foreground }]}>{investment.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}</Text>
                      </View>
                      <View>
                        <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Preço médio</Text>
                        <Text style={[styles.detailValue, { color: colors.foreground }]}>{formatCurrency(investment.averagePrice)}</Text>
                      </View>
                      <View style={styles.detailRight}>
                        <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Valor atual</Text>
                        <Text style={[styles.detailValue, { color: colors.foreground }]}>{formatCurrency(investment.currentValue)}</Text>
                      </View>
                    </View>
                    <View style={styles.returnRow}>
                      <Text style={[styles.returnLabel, { color: colors.mutedForeground }]}>Rentabilidade</Text>
                      <Text style={[styles.returnValue, { color: investment.returnAmount >= 0 ? colors.income : colors.expense }]}>
                        {formatCurrency(investment.returnAmount)} · {formatPercentage(investment.returnPercentage)}
                      </Text>
                    </View>
                    <View style={[styles.quoteRow, { borderTopColor: colors.border }]}>
                      <Feather
                        name={investment.valuationMode === 'automatic' && investment.quoteStatus === 'updated' ? 'check-circle' : 'info'}
                        size={12}
                        color={investment.quoteStatus === 'error' || investment.quoteStatus === 'unavailable' ? colors.expense : colors.mutedForeground}
                      />
                      <View style={styles.quoteCopy}>
                        <Text style={[styles.quoteText, { color: colors.mutedForeground }]}>{quoteStatusText(investment)}</Text>
                        {investment.quoteError && investment.valuationMode === 'automatic' && (
                          <Text style={[styles.quoteError, { color: colors.expense }]}>{investment.quoteError}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </KeyboardAwareScrollViewCompat>

      <Modal animationType="fade" transparent visible={editorOpen} onRequestClose={closeEditor}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditor} />
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <KeyboardAwareScrollViewCompat
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Carteira pessoal</Text>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingInvestment ? 'Editar investimento' : 'Novo investimento'}</Text>
                </View>
                <Pressable accessibilityLabel="Fechar editor de investimento" onPress={closeEditor} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                  <Feather name="x" size={18} color={colors.foreground} />
                </Pressable>
              </View>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>Escolha como o valor atual deste ativo deve ser calculado.</Text>
              <Text style={[styles.label, { color: colors.foreground }]}>Atualização do valor</Text>
              <View style={styles.modeRow}>
                {([
                  { value: 'manual', label: 'Manual', description: 'Você informa o valor' },
                  { value: 'automatic', label: 'Automática', description: 'BRAPI a cada 15 min' },
                ] as Array<{ value: InvestmentValuationMode; label: string; description: string }>).map((item) => (
                  <Pressable
                    key={item.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: form.valuationMode === item.value }}
                    onPress={() => setForm((current) => ({ ...current, valuationMode: item.value }))}
                    style={({ pressed }) => [
                      styles.modeOption,
                      { backgroundColor: form.valuationMode === item.value ? colors.primary : colors.secondary, borderColor: form.valuationMode === item.value ? colors.primary : colors.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.modeTitle, { color: form.valuationMode === item.value ? colors.primaryForeground : colors.foreground }]}>{item.label}</Text>
                    <Text style={[styles.modeDescription, { color: form.valuationMode === item.value ? colors.primaryForeground : colors.mutedForeground }]}>{item.description}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.label, { color: colors.foreground }]}>Nome ou código do ativo</Text>
              <TextInput
                accessibilityLabel="Nome ou código do ativo"
                autoCapitalize="characters"
                placeholder="Ex.: PETR4 ou Tesouro Selic"
                placeholderTextColor={colors.mutedForeground}
                value={form.name}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setTimeout(() => setNameFocused(false), 120)}
                onChangeText={(name) => {
                  setNameFocused(name.trim().length > 0);
                  setForm((current) => ({ ...current, name }));
                }}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
              {assetSuggestions.length > 0 && (
                <View
                  accessibilityLabel="Sugestões de ativos"
                  style={[styles.suggestionList, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  {assetSuggestions.map((suggestion) => (
                    <Pressable
                      key={suggestion.ticker}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar ${suggestion.name}, código ${suggestion.ticker}`}
                      accessibilityHint="Preenche o nome, o código e o tipo do ativo"
                      onPress={() => selectAssetSuggestion(suggestion)}
                      style={({ pressed }) => [styles.suggestionItem, pressed && styles.pressed]}
                    >
                      <View style={styles.suggestionCopy}>
                        <Text numberOfLines={1} style={[styles.suggestionName, { color: colors.foreground }]}>{suggestion.name}</Text>
                        <Text style={[styles.suggestionMeta, { color: colors.mutedForeground }]}>{suggestion.ticker}</Text>
                      </View>
                      <Text style={[styles.suggestionType, { color: colors.mutedForeground }]}>{assetTypeLabel(suggestion.assetType)}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={styles.fieldsRow}>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Ticker opcional</Text>
                  <TextInput
                    accessibilityLabel="Ticker opcional"
                    autoCapitalize="characters"
                    placeholder="PETR4"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.ticker}
                    onChangeText={(ticker) => setForm((current) => ({ ...current, ticker }))}
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Instituição opcional</Text>
                  <TextInput
                    accessibilityLabel="Instituição opcional"
                    placeholder="Corretora ou banco"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.institution}
                    onChangeText={(institution) => setForm((current) => ({ ...current, institution }))}
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
                  />
                </View>
              </View>
              <Text style={[styles.label, { color: colors.foreground }]}>Tipo de ativo</Text>
              <KeyboardAwareScrollViewCompat horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assetTypeList}>
                {ASSET_TYPES.map((item) => (
                  <Pressable
                    key={item.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: form.assetType === item.value }}
                    onPress={() => setForm((current) => ({ ...current, assetType: item.value }))}
                    style={({ pressed }) => [
                      styles.assetTypeChip,
                      { backgroundColor: form.assetType === item.value ? colors.primary : colors.secondary, borderColor: form.assetType === item.value ? colors.primary : colors.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={{ color: form.assetType === item.value ? colors.primaryForeground : colors.foreground, fontSize: 11, fontFamily: 'Inter_600SemiBold' }}>{item.label}</Text>
                  </Pressable>
                ))}
              </KeyboardAwareScrollViewCompat>
              <View style={styles.fieldsRow}>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Quantidade</Text>
                  <TextInput
                    accessibilityLabel="Quantidade"
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.quantity}
                    onChangeText={(quantity) => setForm((current) => ({ ...current, quantity: formatQuantityInput(quantity) }))}
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Preço médio</Text>
                  <TextInput
                    accessibilityLabel="Preço médio"
                    keyboardType="decimal-pad"
                    placeholder="R$ 0,00"
                    placeholderTextColor={colors.mutedForeground}
                    value={form.averagePrice}
                    onChangeText={(averagePrice) => setForm((current) => ({ ...current, averagePrice: formatAmountInput(averagePrice) }))}
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
                  />
                </View>
              </View>
              <Text style={[styles.label, { color: colors.foreground }]}>Valor investido</Text>
              <TextInput
                accessibilityLabel="Valor investido"
                keyboardType="decimal-pad"
                placeholder="R$ 0,00"
                placeholderTextColor={colors.mutedForeground}
                value={form.investedAmount}
                onChangeText={(investedAmount) => setForm((current) => ({ ...current, investedAmount: formatAmountInput(investedAmount) }))}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
               <Text style={[styles.label, { color: colors.foreground }]}>
                 {form.valuationMode === 'automatic' ? 'Valor manual de segurança' : 'Valor atual'}
               </Text>
              <TextInput
                 accessibilityLabel={form.valuationMode === 'automatic' ? 'Valor manual de segurança' : 'Valor atual'}
                keyboardType="decimal-pad"
                placeholder="R$ 0,00"
                placeholderTextColor={colors.mutedForeground}
                value={form.currentValue}
                onChangeText={(currentValue) => setForm((current) => ({ ...current, currentValue: formatAmountInput(currentValue) }))}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
               {form.valuationMode === 'automatic' && (
                 <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                   Mantido caso a fonte não encontre uma cotação. O último valor válido nunca é apagado automaticamente.
                 </Text>
               )}
              <Pressable disabled={saving} onPress={() => void saveInvestment()} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled, pressed && styles.pressed]}>
                <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{saving ? 'Salvando...' : editingInvestment ? 'Salvar alterações' : 'Cadastrar investimento'}</Text>
              </Pressable>
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>

      <ConfirmationModal
        visible={investmentToDelete !== null}
        title="Excluir investimento?"
        message={investmentToDelete ? `O ativo ${investmentToDelete.name} será removido da sua carteira. Essa ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir investimento"
        onConfirm={confirmDelete}
        onClose={() => !deleting && setInvestmentToDelete(null)}
        errorTitle="Não foi possível excluir"
        errorMessage="O investimento não foi excluído. Tente novamente."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16 },
  intro: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: -7, marginBottom: 18 },
  summaryCard: { minHeight: 166, borderRadius: 9, padding: 17, justifyContent: 'space-between' },
  summaryLabel: { color: '#D4D4D4', fontSize: 12, fontFamily: 'Inter_500Medium' },
  summaryValue: { color: '#FFFFFF', fontSize: 29, lineHeight: 35, fontFamily: 'Inter_700Bold', marginTop: 13 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, marginTop: 16 },
  summaryResult: { alignItems: 'flex-end' },
  summaryMetaLabel: { color: '#AFAFAF', fontSize: 10, fontFamily: 'Inter_400Regular' },
  summaryMetaValue: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 3 },
  summaryPercentage: { fontSize: 10, fontFamily: 'Inter_700Bold', marginTop: 2 },
  quoteRefresh: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 13, paddingVertical: 4 },
  quoteRefreshText: { color: '#FFFFFF', fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  emptyWrap: { marginTop: 12, gap: 10 },
  emptyAction: { minHeight: 42, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  emptyActionText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  list: { gap: 10, marginTop: 12 },
  investmentCard: { borderWidth: 1, borderRadius: 9, padding: 13 },
  investmentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  investmentIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 9 },
  investmentIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  investmentCopy: { flex: 1, minWidth: 0 },
  investmentName: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  investmentMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  investmentActions: { flexDirection: 'row', gap: 5 },
  iconButton: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  investmentDetails: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, borderTopWidth: 1, marginTop: 12, paddingTop: 11 },
  detailRight: { alignItems: 'flex-end' },
  detailLabel: { fontSize: 9, fontFamily: 'Inter_400Regular' },
  detailValue: { fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 3 },
  returnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12 },
  returnLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  returnValue: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  quoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderTopWidth: 1, marginTop: 10, paddingTop: 9 },
  quoteCopy: { flex: 1, minWidth: 0 },
  quoteText: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  quoteError: { fontSize: 9, lineHeight: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  modalCard: { width: '100%', maxWidth: 360, maxHeight: '90%', borderRadius: 10, borderWidth: 1, padding: 14, flexShrink: 1 },
  modalScroll: { flexShrink: 1 },
  modalContent: { paddingBottom: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.1, textTransform: 'uppercase' },
  modalTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 4 },
  closeButton: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  helper: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 7, marginTop: 14 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeOption: { flex: 1, minHeight: 56, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, justifyContent: 'center' },
  modeTitle: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  modeDescription: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 4 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 13, fontFamily: 'Inter_400Regular' },
  suggestionList: { borderWidth: 1, borderRadius: 8, marginTop: 6, overflow: 'hidden' },
  suggestionItem: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 11, paddingVertical: 7 },
  suggestionCopy: { flex: 1, minWidth: 0 },
  suggestionName: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  suggestionMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  suggestionType: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  fieldsRow: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1, minWidth: 0 },
  assetTypeList: { gap: 7, paddingBottom: 2 },
  assetTypeChip: { minHeight: 34, borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  saveButton: { minHeight: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  saveText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});