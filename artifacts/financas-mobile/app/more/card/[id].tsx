import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreditCardCard } from '@/components/CreditCardCard';
import { EmptyState, LoadingState } from '@/components/StateView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { goBackOrReplace } from '@/components/navigation';
import { useCards } from '@/context/CardContext';
import { useFinance } from '@/context/FinanceContext';
import { useColors } from '@/hooks/useColors';
import { formatCurrency } from '@/utils/currency';
import { getCardHistory } from '@/services/cardRepository';
import { formatDate, formatMonthYearLabel, getSaoPauloMonthKey } from '@/utils/date';
import type { CardHistoryItem } from '@/types/card';

export default function CardDetailsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, loading, refresh, deleteCard, payCardInvoice } = useCards();
  const { deleteTransaction } = useFinance();
  const [payingInvoiceMonth, setPayingInvoiceMonth] = useState<string | null>(null);
  const [history, setHistory] = useState<CardHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [selectedHistoryMonth, setSelectedHistoryMonth] = useState(getSaoPauloMonthKey);
  const card = cards.find((item) => item.id === id);

  const loadHistory = useCallback(async () => {
    if (!id) return;
    try {
      setHistoryLoading(true);
      setHistory(await getCardHistory(id));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void refresh();
    void loadHistory();
  }, [loadHistory, refresh]));

  const handlePay = (invoiceMonth: string, amount: number, label: string) => {
    if (!card) return;
    const message = `A ${label.toLocaleLowerCase()} de ${card.name}, no valor de ${formatCurrency(amount)}, será marcada como paga.`;
    const executePayment = () => {
      setPayingInvoiceMonth(invoiceMonth);
      void payCardInvoice(card.id, invoiceMonth)
        .then(() => loadHistory())
        .catch(() => Alert.alert('Não foi possível pagar', 'Tente novamente.'))
        .finally(() => setPayingInvoiceMonth(null));
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Pagar fatura?\n\n${message}`)) {
        executePayment();
      }
      return;
    }

    Alert.alert(
      'Pagar fatura?',
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pagar',
          onPress: executePayment,
        },
      ],
    );
  };

  const currentInvoiceMonth = getSaoPauloMonthKey();
  const historyMonths = useMemo(() => {
    const months = new Set(history.map((item) => item.date.slice(0, 7)));
    months.add(currentInvoiceMonth);
    return Array.from(months).sort().reverse();
  }, [currentInvoiceMonth, history]);
  const filteredHistory = useMemo(
    () => history
      .filter((item) => item.date.slice(0, 7) === selectedHistoryMonth)
      .sort((first, second) => {
        return second.date.localeCompare(first.date);
      }),
    [history, selectedHistoryMonth],
  );
  const selectedHistoryMonthIndex = historyMonths.indexOf(selectedHistoryMonth);
  const previousHistoryMonthDisabled = selectedHistoryMonthIndex < 0 || selectedHistoryMonthIndex >= historyMonths.length - 1;
  const nextHistoryMonthDisabled = selectedHistoryMonthIndex <= 0;

  const handleDeleteHistoryItem = (item: CardHistoryItem) => {
    if (item.kind !== 'transaction') return;
    const executeDelete = () => {
      setDeletingHistoryId(item.id);
      void deleteTransaction(item.id)
        .then(async () => {
          await Promise.all([loadHistory(), refresh()]);
        })
        .catch(() => {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.alert('Não foi possível excluir. Tente novamente.');
          } else {
            Alert.alert('Não foi possível excluir', 'Tente novamente.');
          }
        })
        .finally(() => setDeletingHistoryId(null));
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(
        'Excluir movimentação?\n\nEssa movimentação será removida do cartão e a fatura será recalculada.',
      )) {
        executeDelete();
      }
      return;
    }

    Alert.alert(
      'Excluir movimentação?',
      'Essa movimentação será removida do cartão e a fatura será recalculada.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: executeDelete,
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!card) return;
    const executeDelete = () => {
      void deleteCard(card.id)
        .then(() => goBackOrReplace('/more/cards'))
        .catch(() => {
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.alert('Não foi possível excluir. Tente novamente.');
          } else {
            Alert.alert('Não foi possível excluir', 'Tente novamente.');
          }
        });
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(
        `Excluir ${card.name}?\n\nO cartão e os dados da fatura serão removidos.`,
      )) {
        executeDelete();
      }
      return;
    }

    Alert.alert(
      `Excluir ${card.name}?`,
      'O cartão e os dados da fatura serão removidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: executeDelete,
        },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Organização"
          title={card?.name ?? 'Detalhes do cartão'}
          showBack
          rightContent={card ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Editar cartão ${card.name}`}
              testID="edit-card-button"
              onPress={() => router.push({ pathname: '/more/cards', params: { editId: card.id } })}
              style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
            >
              <Feather name="edit-2" size={16} color={colors.foreground} />
            </Pressable>
          ) : null}
        />
        {loading && !card ? <LoadingState /> : !card ? (
          <EmptyState message="Cartão não encontrado." />
        ) : (
          <>
            <CreditCardCard
              card={card}
              onPay={() => handlePay(currentInvoiceMonth, card.currentInvoiceAmount, 'fatura atual')}
              paying={payingInvoiceMonth === currentInvoiceMonth}
            />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Informações do cartão</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <InfoRow label="Nome" value={card.name} colors={colors} />
              <InfoRow label="Vencimento" value={`Dia ${card.dueDay}`} colors={colors} />
              <InfoRow label="Fechamento" value={`Dia ${card.closingDay}`} colors={colors} />
              <InfoRow label="Fatura atual" value={formatCurrency(card.currentInvoiceAmount)} colors={colors} />
              <InfoRow label="Limite disponível" value={card.availableLimit == null ? 'Não informado' : formatCurrency(card.availableLimit)} colors={colors} />
              <InfoRow
                label="Status da fatura"
                value={card.invoiceStatus === 'paid' ? 'Paga' : card.invoiceStatus === 'overdue' ? 'Atrasada' : card.invoiceStatus === 'closed' ? 'Fechada' : 'Aberta'}
                colors={colors}
                last
              />
            </View>
            {card.overdueInvoices.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Faturas atrasadas</Text>
                <View style={[styles.overdueCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {card.overdueInvoices.map((invoice, index) => (
                    <View
                      key={invoice.invoiceMonth}
                      style={[
                        styles.overdueRow,
                        index < card.overdueInvoices.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                      ]}
                    >
                      <View style={styles.overdueCopy}>
                        <Text style={[styles.overdueTitle, { color: colors.foreground }]}>
                          Fatura de {formatMonthYearLabel(new Date(`${invoice.invoiceMonth}-01T12:00:00`))}
                        </Text>
                        <Text style={[styles.overdueAmount, { color: colors.expense }]}>{formatCurrency(invoice.amount)}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Pagar fatura atrasada de ${invoice.invoiceMonth}`}
                        testID={`pay-overdue-invoice-${invoice.invoiceMonth}`}
                        disabled={payingInvoiceMonth !== null}
                        onStartShouldSetResponder={() => true}
                        onPress={(event) => {
                          event.stopPropagation();
                          handlePay(invoice.invoiceMonth, invoice.amount, 'fatura atrasada');
                        }}
                        style={({ pressed }) => [
                          styles.overdueButton,
                          { backgroundColor: colors.expense },
                          payingInvoiceMonth !== null && styles.disabled,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.overdueButtonText}>Pagar</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Mês do histórico</Text>
            <View
              style={styles.monthSelector}
              accessibilityLabel="Selecionar mês do histórico do cartão"
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mês anterior do histórico do cartão"
                accessibilityState={{ disabled: previousHistoryMonthDisabled }}
                disabled={previousHistoryMonthDisabled}
                hitSlop={8}
                onPress={() => {
                  if (!previousHistoryMonthDisabled) {
                    setSelectedHistoryMonth(historyMonths[selectedHistoryMonthIndex + 1]);
                  }
                }}
                style={({ pressed }) => [
                  styles.monthButton,
                  { borderColor: colors.border },
                  previousHistoryMonthDisabled && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Feather name="chevron-left" size={15} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.monthText, { color: colors.foreground }]} numberOfLines={1}>
                {formatMonthYearLabel(new Date(`${selectedHistoryMonth}-01T12:00:00`))}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Próximo mês do histórico do cartão"
                accessibilityState={{ disabled: nextHistoryMonthDisabled }}
                disabled={nextHistoryMonthDisabled}
                hitSlop={8}
                onPress={() => {
                  if (!nextHistoryMonthDisabled) {
                    setSelectedHistoryMonth(historyMonths[selectedHistoryMonthIndex - 1]);
                  }
                }}
                style={({ pressed }) => [
                  styles.monthButton,
                  { borderColor: colors.border },
                  nextHistoryMonthDisabled && styles.disabled,
                  pressed && styles.pressed,
                ]}
              >
                <Feather name="chevron-right" size={15} color={colors.foreground} />
              </Pressable>
            </View>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Histórico de {formatMonthYearLabel(new Date(`${selectedHistoryMonth}-01T12:00:00`))}
            </Text>
            <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {historyLoading ? (
                <Text style={[styles.historyState, { color: colors.mutedForeground }]}>Carregando histórico...</Text>
              ) : filteredHistory.length === 0 ? (
                <Text style={[styles.historyState, { color: colors.mutedForeground }]}>Nenhuma movimentação neste mês.</Text>
              ) : filteredHistory.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.historyRow,
                    index < filteredHistory.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                  ]}
                >
                  <View style={[styles.historyIcon, { backgroundColor: item.kind === 'closure' ? colors.pendingSoft : colors.secondary }]}>
                    <Feather name={item.kind === 'closure' ? 'lock' : 'file-text'} size={14} color={item.kind === 'closure' ? colors.pending : colors.foreground} />
                  </View>
                  <View style={styles.historyCopy}>
                    <Text style={[styles.historyDescription, { color: colors.foreground }]}>{item.description}</Text>
                    <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                      {formatDate(item.date)}{item.categoryName ? ` · ${item.categoryName}` : ''}
                    </Text>
                  </View>
                  {item.kind === 'closure' ? (
                    <Text style={[styles.closureLabel, { color: colors.pending }]}>Fechada</Text>
                  ) : (
                    <View style={styles.historyAmount}>
                      <Text style={[styles.historyValue, { color: colors.expense }]}>-{formatCurrency(item.amount)}</Text>
                    </View>
                  )}
                  {item.kind === 'transaction' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Excluir ${item.description}`}
                      disabled={deletingHistoryId !== null}
                      onPress={() => handleDeleteHistoryItem(item)}
                      style={({ pressed }) => [
                        styles.historyDeleteButton,
                        { backgroundColor: colors.expenseSoft },
                        deletingHistoryId !== null && styles.disabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Feather name="trash-2" size={14} color={colors.expense} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Excluir cartão ${card.name}`}
              testID="delete-card-button"
              onPress={handleDelete}
              style={({ pressed }) => [styles.deleteButton, { borderColor: colors.expense }, pressed && styles.pressed]}
            >
              <Feather name="trash-2" size={16} color={colors.expense} />
              <Text style={[styles.deleteText, { color: colors.expense }]}>Excluir cartão</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoRow({
  label,
  value,
  colors,
  last = false,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  iconButton: { width: 36, height: 36, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  infoCard: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13 },
  infoRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  infoLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_700Bold' },
  overdueCard: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13 },
  overdueRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10 },
  overdueCopy: { flex: 1, minWidth: 0 },
  overdueTitle: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  overdueAmount: { fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: 4 },
  overdueButton: { minHeight: 34, borderRadius: 7, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  overdueButtonText: { color: '#FFFFFF', fontSize: 10, fontFamily: 'Inter_700Bold' },
  monthSelector: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  monthButton: { width: 30, height: 30, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthText: { flex: 1, textAlign: 'center', fontSize: 12, fontFamily: 'Inter_700Bold' },
  historyCard: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13 },
  historyState: { fontSize: 11, fontFamily: 'Inter_400Regular', paddingVertical: 16, textAlign: 'center' },
  historyRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 9 },
  historyIcon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  historyCopy: { flex: 1, minWidth: 0 },
  historyDescription: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  historyDate: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 3 },
  historyAmount: { alignItems: 'flex-end' },
  historyValue: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  historyDeleteButton: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  closureLabel: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  deleteButton: { minHeight: 44, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18 },
  deleteText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  pressed: { opacity: 0.72 },
});