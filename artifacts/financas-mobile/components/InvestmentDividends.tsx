import { Feather } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useDividends, type InvestmentDividendFormInput } from '@/context/DividendContext';
import { useFinance } from '@/context/FinanceContext';
import { useInvestments } from '@/context/InvestmentContext';
import { useWallets } from '@/context/WalletContext';
import { useColors } from '@/hooks/useColors';
import type {
  InvestmentDividend,
  InvestmentDividendCalendar,
  InvestmentDividendCalendarEvent,
  InvestmentDividendStatus,
  InvestmentDividendType,
} from '@workspace/api-client-react';
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

function typeLabel(type: InvestmentDividendType | InvestmentDividendCalendarEvent['type']): string {
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
  const {
    dividends,
    loading,
    error,
    refresh,
    getCalendar,
    importEvents,
    createDividend,
    updateDividend,
    deleteDividend,
  } = useDividends();
  const { refresh: refreshFinance } = useFinance();
  const { refresh: refreshWallets } = useWallets();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<InvestmentDividend | null>(null);
  const [draft, setDraft] = useState<DividendDraft>(() => initialDraft(investments[0]?.id ?? ''));
  const [investmentPickerOpen, setInvestmentPickerOpen] = useState(false);
  const [investmentSearch, setInvestmentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendar, setCalendar] = useState<InvestmentDividendCalendar | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

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

  const selectedInvestment = useMemo(
    () => investments.find((investment) => investment.id === draft.investmentId) ?? null,
    [draft.investmentId, investments],
  );
  const filteredInvestments = useMemo(() => {
    const query = investmentSearch.trim().toLocaleLowerCase('pt-BR');
    if (!query) return investments;
    return investments.filter((investment) => (
      investment.name.toLocaleLowerCase('pt-BR').includes(query)
      || investment.ticker?.toLocaleLowerCase('pt-BR').includes(query)
    ));
  }, [investmentSearch, investments]);

  const openCalendar = async () => {
    setCalendarOpen(true);
    setCalendarLoading(true);
    setCalendarError(null);
    try {
      const result = await getCalendar();
      setCalendar(result);
      setSelectedCalendarIds(new Set(
        result.events.filter((event) => !event.alreadyImported).map((event) => event.sourceEventId),
      ));
    } catch {
      setCalendar(null);
      setCalendarError('Não foi possível consultar o calendário agora.');
    } finally {
      setCalendarLoading(false);
    }
  };

  const toggleCalendarEvent = (event: InvestmentDividendCalendarEvent) => {
    if (event.alreadyImported) return;
    setSelectedCalendarIds((current) => {
      const next = new Set(current);
      if (next.has(event.sourceEventId)) next.delete(event.sourceEventId);
      else next.add(event.sourceEventId);
      return next;
    });
  };

  const importSelected = async () => {
    const events = calendar?.events.filter((event) => selectedCalendarIds.has(event.sourceEventId)) ?? [];
    if (events.length === 0) {
      Alert.alert('Nenhum evento selecionado', 'Selecione pelo menos um evento para importar.');
      return;
    }
    try {
      setImporting(true);
      const result = await importEvents(events.map((event) => ({
        sourceEventId: event.sourceEventId,
        investmentId: event.investmentId,
        type: event.type,
        amount: event.amount,
        paymentDate: event.paymentDate,
      })));
      setCalendarOpen(false);
      setCalendar(null);
      const createdMessage = result.created.length === 1
        ? '1 evento foi importado com sucesso.'
        : `${result.created.length} eventos foram importados com sucesso.`;
      const skippedMessage = result.skipped > 0
        ? ` ${result.skipped} já existia(m) e foi(ram) ignorado(s).`
        : '';
      Alert.alert('Importação concluída', `${createdMessage}${skippedMessage}`);
    } catch {
      Alert.alert('Não foi possível importar', 'Os proventos manuais continuam disponíveis. Tente novamente.');
    } finally {
      setImporting(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setDraft(initialDraft(investments[0]?.id ?? ''));
    setInvestmentPickerOpen(false);
    setInvestmentSearch('');
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
    setInvestmentPickerOpen(false);
    setInvestmentSearch('');
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (!saving) {
      setInvestmentPickerOpen(false);
      setInvestmentSearch('');
      setEditorOpen(false);
    }
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
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Importar calendário de proventos"
              onPress={() => void openCalendar()}
              disabled={calendarLoading}
              style={({ pressed }) => [styles.importButton, { backgroundColor: colors.secondary, borderColor: colors.border }, calendarLoading && styles.disabled, pressed && styles.pressed]}
            >
              <Feather name="download" size={14} color={colors.foreground} />
              <Text style={[styles.addButtonText, { color: colors.foreground }]}>Importar</Text>
            </Pressable>
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

      <Modal
        animationType="fade"
        transparent
        visible={calendarOpen}
        onRequestClose={() => {
          if (!importing) setCalendarOpen(false);
        }}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            disabled={importing}
            onPress={() => setCalendarOpen(false)}
          />
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <KeyboardAwareScrollViewCompat
              contentContainerStyle={styles.modalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalHeader}>
                <View style={styles.headerCopy}>
                  <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Fonte BRAPI</Text>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Importar calendário</Text>
                </View>
                <Pressable
                  accessibilityLabel="Fechar importação de proventos"
                  disabled={importing}
                  onPress={() => setCalendarOpen(false)}
                  style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
                >
                  <Feather name="x" size={18} color={colors.foreground} />
                </Pressable>
              </View>
              <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                Ações e FIIs com ticker B3. O valor considera a quantidade na carteira. Revise antes de salvar.
              </Text>
              {calendarLoading ? (
                <Text style={[styles.calendarState, { color: colors.mutedForeground }]}>Consultando eventos previstos...</Text>
              ) : calendarError ? (
                <View style={styles.calendarState}>
                  <Text style={[styles.helper, { color: colors.expense }]}>{calendarError}</Text>
                  <Pressable onPress={() => void openCalendar()}>
                    <Text style={[styles.retry, { color: colors.primary }]}>Tentar novamente</Text>
                  </Pressable>
                </View>
              ) : calendar ? (
                <>
                  {calendar.events.length === 0 ? (
                    <View style={[styles.empty, { backgroundColor: colors.secondary }]}>
                      <Feather name={calendar.failures.length > 0 ? 'alert-circle' : 'calendar'} size={18} color={colors.mutedForeground} />
                      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                        {calendar.failures.length > 0 ? 'Calendário temporariamente indisponível' : 'Nenhum evento novo encontrado'}
                      </Text>
                      <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                        {calendar.failures.length > 0
                          ? 'Não foi possível consultar os proventos agora. Tente novamente ou cadastre o evento manualmente.'
                          : 'Os eventos previstos da sua carteira aparecerão aqui para revisão.'}
                      </Text>
                      {calendar.failures.length > 0 ? (
                        <Pressable onPress={() => void openCalendar()}>
                          <Text style={[styles.retry, { color: colors.primary }]}>Tentar novamente</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <>
                      {calendar.failures.length > 0 ? (
                        <View style={[styles.calendarWarning, { backgroundColor: colors.secondary }]}>
                          <Text style={[styles.calendarWarningTitle, { color: colors.foreground }]}>Alguns eventos não puderam ser consultados</Text>
                          <Text style={[styles.helper, { color: colors.mutedForeground }]}>Os eventos disponíveis continuam abaixo. Você pode tentar novamente mais tarde ou cadastrar os demais manualmente.</Text>
                        </View>
                      ) : null}
                      <View style={styles.calendarList}>
                        {calendar.events.map((event) => {
                          const selected = selectedCalendarIds.has(event.sourceEventId);
                          return (
                            <Pressable
                              key={event.sourceEventId}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: selected, disabled: event.alreadyImported }}
                              disabled={event.alreadyImported || importing}
                              onPress={() => toggleCalendarEvent(event)}
                              style={({ pressed }) => [
                                styles.calendarItem,
                                { borderColor: colors.border, backgroundColor: selected ? colors.secondary : colors.card },
                                event.alreadyImported && styles.disabled,
                                pressed && styles.pressed,
                              ]}
                            >
                              <View style={[styles.checkbox, { borderColor: selected ? colors.primary : colors.input, backgroundColor: selected ? colors.primary : colors.card }]}>
                                {selected ? <Feather name="check" size={12} color={colors.primaryForeground} /> : null}
                              </View>
                              <View style={styles.itemMain}>
                                <View style={styles.itemTitleRow}>
                                  <Text style={[styles.itemTitle, { color: colors.foreground }]}>{event.investmentTicker ?? event.investmentName}</Text>
                                  <Text style={[styles.itemStatus, { color: colors.pending }]}>{typeLabel(event.type)}</Text>
                                </View>
                                <Text style={[styles.itemMeta, { color: colors.mutedForeground }]}>
                                  Pagamento em {displayDate(event.paymentDate)} · {event.alreadyImported ? 'Já importado' : 'Previsto'}
                                </Text>
                              </View>
                              <Text style={[styles.itemAmount, { color: colors.foreground }]}>{formatCurrency(event.amount)}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </>
                  )}
                  {calendar.events.some((event) => !event.alreadyImported) ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Importar eventos selecionados"
                      disabled={importing}
                      onPress={() => void importSelected()}
                      style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, importing && styles.disabled, pressed && styles.pressed]}
                    >
                      <Text style={[styles.saveText, { color: colors.primaryForeground }]}>
                        {importing ? 'Importando...' : `Importar selecionados (${selectedCalendarIds.size})`}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>

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
              <Pressable
                accessibilityRole="combobox"
                accessibilityLabel="Selecionar ativo do provento"
                accessibilityState={{ expanded: investmentPickerOpen }}
                testID="investment-dividend-combobox"
                disabled={investments.length === 0}
                onPress={() => setInvestmentPickerOpen((open) => !open)}
                style={({ pressed }) => [
                  styles.combobox,
                  { backgroundColor: colors.card, borderColor: investmentPickerOpen ? colors.primary : colors.input },
                  pressed && styles.pressed,
                  investments.length === 0 && styles.disabled,
                ]}
              >
                <View style={styles.comboboxCopy}>
                  <Text numberOfLines={1} style={[styles.comboboxValue, { color: selectedInvestment ? colors.foreground : colors.mutedForeground }]}>
                    {selectedInvestment?.name ?? 'Nenhum investimento disponível'}
                  </Text>
                  {selectedInvestment?.ticker ? (
                    <Text numberOfLines={1} style={[styles.comboboxMeta, { color: colors.mutedForeground }]}>{selectedInvestment.ticker}</Text>
                  ) : null}
                </View>
                <Feather name={investmentPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
              </Pressable>
              {investmentPickerOpen ? (
                <View style={[styles.comboboxDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.comboboxSearch, { backgroundColor: colors.secondary, borderColor: colors.input }]}>
                    <Feather name="search" size={14} color={colors.mutedForeground} />
                    <TextInput
                      accessibilityLabel="Buscar ativo do provento"
                      testID="investment-dividend-combobox-search"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                      value={investmentSearch}
                      onChangeText={setInvestmentSearch}
                      placeholder="Buscar por nome ou ticker"
                      placeholderTextColor={colors.mutedForeground}
                      style={[styles.comboboxSearchInput, { color: colors.foreground }]}
                    />
                    {investmentSearch ? (
                      <Pressable
                        accessibilityLabel="Limpar busca de ativo"
                        onPress={() => setInvestmentSearch('')}
                        hitSlop={8}
                      >
                        <Feather name="x" size={14} color={colors.mutedForeground} />
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.comboboxOptions}>
                    {filteredInvestments.length === 0 ? (
                      <Text style={[styles.comboboxEmpty, { color: colors.mutedForeground }]}>Nenhum ativo encontrado.</Text>
                    ) : filteredInvestments.map((investment) => (
                      <Pressable
                        key={investment.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: draft.investmentId === investment.id }}
                        onPress={() => {
                          setDraft((current) => ({ ...current, investmentId: investment.id }));
                          setInvestmentPickerOpen(false);
                          setInvestmentSearch('');
                        }}
                        style={({ pressed }) => [
                          styles.comboboxOption,
                          { backgroundColor: draft.investmentId === investment.id ? colors.secondary : colors.card },
                          pressed && styles.pressed,
                        ]}
                      >
                        <View style={styles.comboboxCopy}>
                          <Text numberOfLines={1} style={[styles.comboboxValue, { color: colors.foreground }]}>{investment.name}</Text>
                          {investment.ticker ? <Text style={[styles.comboboxMeta, { color: colors.mutedForeground }]}>{investment.ticker}</Text> : null}
                        </View>
                        {draft.investmentId === investment.id ? <Feather name="check" size={14} color={colors.primary} /> : null}
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  subtitle: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', marginTop: 3 },
  addButton: { minHeight: 34, borderRadius: 7, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  importButton: { minHeight: 34, borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addButtonText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  summaryRow: { flexDirection: 'row', gap: 8, marginTop: 13 },
  summaryItem: { flex: 1, borderRadius: 8, padding: 10 },
  summaryLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },
  summaryValue: { fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 3 },
  helper: { fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular' },
  errorRow: { marginTop: 14, gap: 4 },
  retry: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  calendarState: { marginTop: 16, gap: 5 },
  calendarWarning: { borderRadius: 8, padding: 10, marginTop: 14, gap: 4 },
  calendarWarningTitle: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  calendarList: { marginTop: 14, gap: 7 },
  calendarItem: { minHeight: 62, borderWidth: 1, borderRadius: 8, padding: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
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
  combobox: { minHeight: 52, borderWidth: 1, borderRadius: 7, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  comboboxCopy: { flex: 1, minWidth: 0 },
  comboboxValue: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  comboboxMeta: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 2 },
  comboboxDropdown: { borderWidth: 1, borderRadius: 8, marginTop: 6, padding: 8 },
  comboboxSearch: { minHeight: 38, borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  comboboxSearchInput: { flex: 1, minWidth: 0, paddingVertical: 0, fontSize: 12, fontFamily: 'Inter_400Regular' },
  comboboxOptions: { gap: 3, marginTop: 7 },
  comboboxOption: { minHeight: 43, borderRadius: 6, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  comboboxEmpty: { fontSize: 11, fontFamily: 'Inter_400Regular', paddingVertical: 9, paddingHorizontal: 3 },
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