import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDividends, type InvestmentDividendFormInput } from '@/context/DividendContext';
import { useFinance } from '@/context/FinanceContext';
import { useInvestments } from '@/context/InvestmentContext';
import { useWallets } from '@/context/WalletContext';
import { useColors } from '@/hooks/useColors';
import type { InvestmentDividend, InvestmentDividendStatus, InvestmentDividendType } from '@workspace/api-client-react';
import { formatAmountInput, formatAmountValue, formatCurrency, parseAmountInput } from '@/utils/currency';
import { KeyboardAwareScrollViewCompat } from './KeyboardAwareScrollViewCompat';

type DividendDraft = {
  investmentId: string;
  type: InvestmentDividendType;
  amount: string;
  paymentDate: string;
  status: InvestmentDividendStatus;
  note: string;
};

function currentDateInput(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')}`;
}

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toApiDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) return null;
  return `${year}-${month}-${day}`;
}

function displayDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR');
}

function typeLabel(type: InvestmentDividendType): string {
  return type === 'jcp' ? 'JCP' : 'Dividendo';
}

function statusLabel(status: InvestmentDividendStatus): string {
  return status === 'received' ? 'Recebido' : 'Previsto';
}

function initialDraft(investmentId: string): DividendDraft {
  return {
    investmentId,
    type: 'dividend',
    amount: '',
    paymentDate: currentDateInput(),
    status: 'expected',
    note: '',
  };
}

export function InvestmentDividends() {
  const colors = useColors();
  const { investments } = useInvestments();
  const { dividends, loading, error, refresh, createDividend, updateDividend, deleteDividend } = useDividends();
  const { refresh: refreshFinance } = useFinance();
  const { refresh: refreshWallets } = useWallets();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentDividend | null>(null);
  const [draft, setDraft] = useState<DividendDraft>(() => initialDraft(investments[0]?.id ?? ''));
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => dividends.reduce((summary, dividend) => ({
    received: summary.received + (dividend.status === 'received' ? dividend.amount : 0),
    expected: summary.expected + (dividend.status === 'expected' ? dividend.amount : 0),
  }), { received: 0, expected: 0 }), [dividends]);

  const grouped = useMemo(() => {
    const groups = new Map<string, InvestmentDividend[]>();
    for (const dividend of dividends) {
      const group = groups.get(dividend.investmentId) ?? [];
      group.push(dividend);
      groups.set(dividend.investmentId, group);
    }
    return [...groups.values()];
  }, [dividends]);

  const openNew = () => {
    setEditing(null);
    setDraft(initialDraft(investments[0]?.id ?? ''));
    setEditorOpen(true);
  };

  const openEdit = (dividend: InvestmentDividend) => {
    setEditing(dividend);
    setDraft({
      investmentId: dividend.investmentId,
      type: dividend.type,
      amount: formatAmountValue(dividend.amount),
      paymentDate: displayDate(dividend.paymentDate),
      status: dividend.status,
      note: dividend.note ?? '',
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (!saving) setEditorOpen(false);
  };

  const save = async () => {
    const amount = parseAmountInput(draft.amount);
    const paymentDate = toApiDate(draft.paymentDate);
    if (!draft.investmentId || !investments.some((investment) => investment.id === draft.investmentId)) {
      Alert.alert('Ativo obrigatório', 'Selecione um investimento da carteira.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Valor inválido', 'Informe um valor de provento maior que zero.');
      return;
    }
    if (!paymentDate) {
      Alert.alert('Data inválida', 'Informe a data no formato DD/MM/AAAA.');
      return;
    }
    try {
      setSaving(true);
      const input = {
        investmentId: draft.investmentId,
        type: draft.type,
        amount,
        paymentDate,
        status: draft.status,
      };
      if (editing) {
        await updateDividend(editing.id, {
          ...input,
          note: draft.note.trim() || null,
        });
      } else {
        await createDividend({
          ...input,
          note: draft.note.trim() || undefined,
        } satisfies InvestmentDividendFormInput);
      }
      setEditorOpen(false);
      if (draft.status === 'received') await Promise.all([refreshFinance(), refreshWallets()]);
    } catch {
      Alert.alert('Não foi possível salvar', 'Confira os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const markReceived = async (dividend: InvestmentDividend) => {
    try {
      await updateDividend(dividend.id, { status: 'received' });
      await Promise.all([refreshFinance(), refreshWallets()]);
    } catch {
      Alert.alert('Não foi possível marcar como recebido', 'Tente novamente.');
    }
  };

  const remove = (dividend: InvestmentDividend) => {
    Alert.alert(
      'Excluir provento?',
      'O evento será removido. Se já tiver gerado uma receita, ela continuará no histórico financeiro.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDividend(dividend.id);
            } catch {
              Alert.alert('Não foi possível excluir', 'Tente novamente.');
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: colors.foreground }]}>Proventos</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Dividendos e JCP registrados na sua carteira</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adicionar provento"
            testID="add-investment-dividend"
            onPress={openNew}
            style={({ pressed }) => [styles.addButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <Feather name="plus" size={15} color={colors.primaryForeground} />
            <Text style={[styles.addButtonText, { color: colors.primaryForeground }]}>Adicionar</Text>
          </Pressable>
        </View>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryItem, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Recebidos</Text>
            <Text style={[styles.summaryValue, { color: colors.income }]}>{formatCurrency(totals.received)}</Text>
          </View>
          <View style={[styles.summaryItem, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Previstos</Text>
            <Text style={[styles.summaryValue, { color: colors.pending }]}>{formatCurrency(totals.expected)}</Text>
          </View>
        </View>

        {loading ? (
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>Carregando histórico...</Text>
        ) : error ? (
          <Pressable onPress={() => void refresh()} style={styles.errorRow}>
            <Text style={[styles.helper, { color: colors.expense }]}>{error}</Text>
            <Text style={[styles.retry, { color: colors.primary }]}>Tentar novamente</Text>
          </Pressable>
        ) : dividends.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.secondary }]}>
            <Feather name="calendar" size={18} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhum provento registrado</Text>
            <Text style={[styles.helper, { color: colors.mutedForeground }]}>Adicione dividendos ou JCP para acompanhar seus recebimentos.</Text>
          </View>
        ) : grouped.map((group) => (
          <View key={group[0].investmentId} style={styles.group}>
            <Text style={[styles.groupTitle, { color: colors.foreground }]}>{group[0].investmentName}</Text>
            {group.map((dividend) => (
              <View key={dividend.id} style={[styles.item, { borderTopColor: colors.border }]}>
                <View style={styles.itemMain}>
                  <View style={styles.itemTitleRow}>
                    <Text style={[styles.itemTitle, { color: colors.foreground }]}>{typeLabel(dividend.type)}</Text>
                    <Text style={[styles.itemStatus, { color: dividend.status === 'received' ? colors.income : colors.pending }]}>
                      {statusLabel(dividend.status)}
                    </Text>
                  </View>
                  <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                    Pagamento em {displayDate(dividend.paymentDate)}{dividend.note ? ` · ${dividend.note}` : ''}
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  <Text style={[styles.itemAmount, { color: colors.foreground }]}>{formatCurrency(dividend.amount)}</Text>
                  <View style={styles.actionRow}>
                    {dividend.status === 'expected' ? (
                      <Pressable
                        accessibilityLabel={`Marcar ${typeLabel(dividend.type)} como recebido`}
                        onPress={() => void markReceived(dividend)}
                        hitSlop={6}
                        style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
                      >
                        <Feather name="check" size={14} color={colors.income} />
                      </Pressable>
                    ) : null}
                    <Pressable
                      accessibilityLabel={`Editar ${typeLabel(dividend.type)}`}
                      onPress={() => openEdit(dividend)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
                    >
                      <Feather name="edit-2" size={13} color={colors.foreground} />
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Excluir ${typeLabel(dividend.type)}`}
                      onPress={() => remove(dividend)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
                    >
                      <Feather name="trash-2" size={13} color={colors.expense} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>

      <Modal animationType="fade" transparent visible={editorOpen} onRequestClose={closeEditor}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeEditor} />
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <KeyboardAwareScrollViewCompat
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <View style={styles.headerCopy}>
                  <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Carteira pessoal</Text>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editing ? 'Editar provento' : 'Novo provento'}</Text>
                </View>
                <Pressable accessibilityLabel="Fechar editor de provento" onPress={closeEditor} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                  <Feather name="x" size={18} color={colors.foreground} />
                </Pressable>
              </View>
              <Text style={[styles.label, { color: colors.foreground }]}>Ativo</Text>
              <View style={styles.choiceList}>
                {investments.map((investment) => (
                  <Pressable
                    key={investment.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: draft.investmentId === investment.id }}
                    onPress={() => setDraft((current) => ({ ...current, investmentId: investment.id }))}
                    style={({ pressed }) => [
                      styles.choice,
                      { backgroundColor: draft.investmentId === investment.id ? colors.primary : colors.secondary, borderColor: draft.investmentId === investment.id ? colors.primary : colors.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text numberOfLines={1} style={[styles.choiceText, { color: draft.investmentId === investment.id ? colors.primaryForeground : colors.foreground }]}>{investment.name}</Text>
                    {draft.investmentId === investment.id ? <Feather name="check" size={14} color={colors.primaryForeground} /> : null}
                  </Pressable>
                ))}
              </View>
              <View style={styles.fieldsRow}>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Tipo</Text>
                  <View style={styles.fieldsRow}>
                    {(['dividend', 'jcp'] as InvestmentDividendType[]).map((type) => (
                      <Pressable
                        key={type}
                        onPress={() => setDraft((current) => ({ ...current, type }))}
                        style={({ pressed }) => [
                          styles.typeChoice,
                          { backgroundColor: draft.type === type ? colors.primary : colors.secondary, borderColor: draft.type === type ? colors.primary : colors.border },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.typeChoiceText, { color: draft.type === type ? colors.primaryForeground : colors.foreground }]}>{typeLabel(type)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={[styles.label, { color: colors.foreground }]}>Valor</Text>
              <TextInput
                accessibilityLabel="Valor do provento"
                keyboardType="decimal-pad"
                value={draft.amount}
                onChangeText={(amount) => setDraft((current) => ({ ...current, amount: formatAmountInput(amount) }))}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
              <View style={styles.fieldsRow}>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Data de pagamento</Text>
                  <TextInput
                    accessibilityLabel="Data de pagamento"
                    keyboardType="number-pad"
                    value={draft.paymentDate}
                    onChangeText={(paymentDate) => setDraft((current) => ({ ...current, paymentDate: formatDateInput(paymentDate) }))}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
                  />
                </View>
                <View style={styles.halfField}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Status</Text>
                  <View style={styles.fieldsRow}>
                    {(['expected', 'received'] as InvestmentDividendStatus[]).map((status) => (
                      <Pressable
                        key={status}
                        onPress={() => setDraft((current) => ({ ...current, status }))}
                        style={({ pressed }) => [
                          styles.statusChoice,
                          { backgroundColor: draft.status === status ? colors.primary : colors.secondary, borderColor: draft.status === status ? colors.primary : colors.border },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.typeChoiceText, { color: draft.status === status ? colors.primaryForeground : colors.foreground }]}>{statusLabel(status)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={[styles.label, { color: colors.foreground }]}>Observação (opcional)</Text>
              <TextInput
                accessibilityLabel="Observação do provento"
                value={draft.note}
                onChangeText={(note) => setDraft((current) => ({ ...current, note }))}
                placeholder="Ex.: 2º trimestre"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, styles.noteInput, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={editing ? 'Salvar alterações do provento' : 'Salvar provento'}
                onPress={() => void save()}
                disabled={saving}
                style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar provento'}</Text>
              </Pressable>
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: 10, padding: 13, marginTop: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 3 },
  addButton: { minHeight: 34, borderRadius: 7, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addButtonText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  summaryItem: { flex: 1, borderRadius: 8, padding: 10 },
  summaryLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 3 },
  helper: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  errorRow: { marginTop: 14, gap: 4 },
  retry: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  empty: { alignItems: 'center', borderRadius: 8, padding: 16, marginTop: 12, gap: 5 },
  emptyTitle: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  group: { marginTop: 14 },
  groupTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  item: { minHeight: 63, borderTopWidth: 1, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemMain: { flex: 1, minWidth: 0 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemTitle: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  itemStatus: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  itemMeta: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 3 },
  itemActions: { alignItems: 'flex-end', gap: 6 },
  itemAmount: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  actionRow: { flexDirection: 'row', gap: 5 },
  iconButton: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.46)', justifyContent: 'center', padding: 16 },
  modalCard: { maxHeight: '92%', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  modalContent: { padding: 16, paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 18 },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.7 },
  modalTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 3 },
  closeButton: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', marginBottom: 7, marginTop: 13 },
  choiceList: { gap: 7 },
  choice: { minHeight: 40, borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  choiceText: { flex: 1, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  fieldsRow: { flexDirection: 'row', gap: 7 },
  halfField: { flex: 1, minWidth: 0 },
  typeChoice: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  statusChoice: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  typeChoiceText: { fontSize: 10, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 7, paddingHorizontal: 11, fontSize: 13, fontFamily: 'Inter_400Regular' },
  noteInput: { minHeight: 44 },
  saveButton: { minHeight: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  saveText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});