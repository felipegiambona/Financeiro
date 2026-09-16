import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { useCards } from '@/context/CardContext';
import { useFinance } from '@/context/FinanceContext';
import { useNotificationAutomation } from '@/context/NotificationAutomationContext';
import { useColors } from '@/hooks/useColors';
import type { AndroidNotificationEvent } from '@/services/notificationListener';
import { getCardInvoiceNotificationSections, getPendingTransactionOccurrences, formatPendingTransactionDate } from '@/services/pendingNotifications';
import { parseNotificationTransaction } from '@/services/notificationTransactionParser';
import { formatCurrency } from '@/utils/currency';
import { formatDate, formatMonthYearLabel, getSaoPauloDateKey } from '@/utils/date';
import { TransactionOccurrence } from '@/types/transaction';

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transactions, loading, error, refresh, updateTransaction, updateTransactionOccurrencePaymentStatus } = useFinance();
  const { cards, loading: cardsLoading, error: cardsError, refresh: refreshCards, payCardInvoice } = useCards();
  const automation = useNotificationAutomation();
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [rejectingNotification, setRejectingNotification] = useState<AndroidNotificationEvent | null>(null);
  const hasLoadedFinance = useRef(false);
  const hasLoadedCards = useRef(false);
  const pendingTransactions = useMemo(() => getPendingTransactionOccurrences(transactions), [transactions]);
  const pendingBankNotifications = useMemo(
    () => automation.pendingNotifications.map((event) => ({
      event,
      parsed: parseNotificationTransaction(event),
    })),
    [automation.pendingNotifications],
  );
  const cardInvoiceSections = useMemo(() => getCardInvoiceNotificationSections(cards), [cards]);
  const { closed: closedCardInvoices, overdue: overdueCardInvoices } = cardInvoiceSections;
  const totalPending = pendingBankNotifications.length + pendingTransactions.length + cardInvoiceSections.total;
  const showInitialLoading = (!hasLoadedFinance.current && loading) || (!hasLoadedCards.current && cardsLoading);

  useEffect(() => {
    if (!loading) hasLoadedFinance.current = true;
  }, [loading]);

  useEffect(() => {
    if (!cardsLoading) hasLoadedCards.current = true;
  }, [cardsLoading]);

  useFocusEffect(useCallback(() => {
    void refreshCards();
  }, [refreshCards]));

  const markAsPaid = async (transaction: TransactionOccurrence) => {
    try {
      setUpdatingKey(transaction.occurrenceKey);
      if (transaction.recurrence.kind !== 'none') {
        await updateTransactionOccurrencePaymentStatus(transaction.sourceId, transaction.date, 'paid');
      } else {
        await updateTransaction(transaction.sourceId, { paymentStatus: 'paid' });
      }
    } catch {
      Alert.alert('Não foi possível atualizar', 'Tente marcar o lançamento como pago novamente.');
    } finally {
      setUpdatingKey(null);
    }
  };

  const payInvoice = async (cardId: string, invoiceMonth: string) => {
    const key = `invoice:${cardId}:${invoiceMonth}`;
    try {
      setUpdatingKey(key);
      await payCardInvoice(cardId, invoiceMonth);
    } catch {
      Alert.alert('Não foi possível pagar', 'Tente pagar a fatura novamente.');
    } finally {
      setUpdatingKey(null);
    }
  };

  const approveBankNotification = async (event: AndroidNotificationEvent) => {
    try {
      setUpdatingKey(`notification:${event.eventId}`);
      const result = await automation.approveNotification(event.eventId);
      if (result === 'unrecognized') {
        Alert.alert('Notificação não reconhecida', 'Esse aviso não contém um movimento financeiro que possa ser lançado. Você pode rejeitá-lo para removê-lo.');
      } else if (result === 'missing-profile') {
        Alert.alert('Perfil necessário', 'Selecione um perfil financeiro antes de aprovar a notificação.');
      } else if (result === 'missing-wallet') {
        Alert.alert('Carteira necessária', 'Crie ou carregue uma carteira antes de aprovar a notificação.');
      } else if (result === 'unauthorized') {
        Alert.alert('Aplicativo não autorizado', 'Esse pacote não está mais na lista de aplicativos autorizados.');
      } else if (result === 'error') {
        Alert.alert('Não foi possível aprovar', 'A notificação continua pendente. Tente novamente.');
      }
    } finally {
      setUpdatingKey(null);
    }
  };

  const confirmRejectNotification = async () => {
    if (!rejectingNotification) return;
    setUpdatingKey(`notification:${rejectingNotification.eventId}`);
    try {
      await automation.rejectNotification(rejectingNotification.eventId);
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Atenção" title="Notificações" showBack />
        {showInitialLoading ? <LoadingState /> : error || cardsError ? <ErrorState onRetry={() => void Promise.all([refresh(), refreshCards()])} /> : totalPending === 0 ? (
          <EmptyState message="Você não tem pendências a analisar." />
        ) : (
          <>
            <View style={[styles.summaryCard, { backgroundColor: colors.pendingSoft, borderColor: colors.pending }]}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.pending }]}>
                <Feather name="bell" size={17} color={colors.background} />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Você tem pendências a analisar</Text>
                <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
                  {totalPending} {totalPending === 1 ? 'pendência precisa' : 'pendências precisam'} da sua atenção.
                </Text>
              </View>
            </View>
            {pendingBankNotifications.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Notificações bancárias</Text>
                <Text style={[styles.sectionHelper, { color: colors.mutedForeground }]}>
                  Aprove para criar o lançamento ou rejeite para excluir a notificação.
                </Text>
                <View style={styles.pendingList}>
                  {pendingBankNotifications.map(({ event, parsed }) => {
                    const isIncome = parsed?.type === 'income';
                    const tone = parsed ? (isIncome ? colors.income : colors.expense) : colors.pending;
                    const softTone = parsed ? (isIncome ? colors.incomeSoft : colors.expenseSoft) : colors.pendingSoft;
                    const icon = parsed ? (isIncome ? 'arrow-down-left' : 'arrow-up-right') : 'bell';
                    const actionKey = `notification:${event.eventId}`;
                    const isUpdating = updatingKey === actionKey;
                    const date = getSaoPauloDateKey(new Date(event.postedAt));

                    return (
                      <View key={event.eventId} style={[styles.pendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.pendingTop}>
                          <View style={[styles.transactionIcon, { backgroundColor: softTone }]}>
                            <Feather name={icon} size={17} color={tone} />
                          </View>
                          <View style={styles.transactionCopy}>
                            <Text numberOfLines={1} style={[styles.description, { color: colors.foreground }]}>
                              {parsed?.description ?? (event.title || 'Notificação bancária')}
                            </Text>
                            <Text numberOfLines={2} style={[styles.notificationText, { color: colors.mutedForeground }]}>
                              {event.text || event.title}
                            </Text>
                            <Text style={[styles.date, { color: colors.pending }]}>
                              {event.packageName} · {formatDate(date)}
                            </Text>
                          </View>
                          {parsed ? (
                            <Text style={[styles.amount, { color: tone }]}>
                              {isIncome ? '+' : '-'} {formatCurrency(parsed.amount)}
                            </Text>
                          ) : null}
                        </View>
                        <View style={[styles.notificationActions, { borderTopColor: colors.border }]}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Rejeitar ${event.title || 'notificação bancária'}`}
                            testID={`notification-reject-${event.eventId}`}
                            disabled={isUpdating}
                            onPress={() => setRejectingNotification(event)}
                            style={({ pressed }) => [
                              styles.rejectButton,
                              { borderColor: colors.border },
                              isUpdating && styles.updating,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={[styles.rejectButtonText, { color: colors.foreground }]}>Rejeitar</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Aprovar ${event.title || 'notificação bancária'}`}
                            testID={`notification-approve-${event.eventId}`}
                            disabled={isUpdating || !parsed}
                            onPress={() => void approveBankNotification(event)}
                            style={({ pressed }) => [
                              styles.payButton,
                              styles.approveNotificationButton,
                              { backgroundColor: parsed ? colors.primary : colors.border },
                              isUpdating && styles.updating,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={[styles.payButtonText, { color: parsed ? colors.primaryForeground : colors.mutedForeground }]}>
                              {isUpdating ? 'Salvando...' : parsed ? 'Aprovar e lançar' : 'Não reconhecida'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
            {pendingTransactions.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, pendingBankNotifications.length > 0 && styles.sectionLabelSpaced, { color: colors.mutedForeground }]}>Lançamentos pendentes</Text>
                <View style={styles.pendingList}>
                  {pendingTransactions.map((transaction) => {
                const isIncome = transaction.type === 'income';
                const isTransfer = transaction.type === 'transfer';
                const tone = isTransfer ? colors.primaryForeground : isIncome ? colors.income : colors.expense;
                const softTone = isTransfer ? colors.secondary : isIncome ? colors.incomeSoft : colors.expenseSoft;
                const icon = isTransfer ? 'repeat' : isIncome ? 'arrow-down-left' : 'arrow-up-right';
                const isUpdating = updatingKey === transaction.occurrenceKey;

                    return (
                      <View key={transaction.occurrenceKey} style={[styles.pendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.pendingTop}>
                          <View style={[styles.transactionIcon, { backgroundColor: softTone }]}>
                            <Feather name={icon} size={17} color={tone} />
                          </View>
                          <View style={styles.transactionCopy}>
                            <Text numberOfLines={1} style={[styles.description, { color: colors.foreground }]}>{transaction.description}</Text>
                            <Text style={[styles.date, { color: colors.pending }]}>
                              {formatPendingTransactionDate(transaction.date)}
                              {transaction.recurrence.kind === 'installment'
                                ? ' · Parcelado'
                                : transaction.recurrence.kind === 'recurring' ? ' · Recorrente' : ''}
                            </Text>
                          </View>
                          <Text style={[styles.amount, { color: tone }]}>
                            {isTransfer ? '' : isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}
                          </Text>
                        </View>
                        <View style={[styles.pendingBottom, { borderTopColor: colors.border }]}>
                          <Text style={[styles.status, { color: colors.pending }]}>Não pago</Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Marcar ${transaction.description} como pago`}
                            testID={`notification-pay-${transaction.occurrenceKey}`}
                            disabled={isUpdating}
                            onPress={() => void markAsPaid(transaction)}
                            style={({ pressed }) => [
                              styles.payButton,
                              { backgroundColor: colors.primary },
                              isUpdating && styles.updating,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={[styles.payButtonText, { color: colors.primaryForeground }]}>
                              {isUpdating ? 'Salvando...' : 'Marcar como pago'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
            {closedCardInvoices.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, pendingTransactions.length > 0 && styles.sectionLabelSpaced, { color: colors.mutedForeground }]}>Faturas fechadas em dia</Text>
                <View style={styles.pendingList}>
                  {closedCardInvoices.map(({ card, invoice }) => {
                    const key = `invoice:${card.id}:${invoice.invoiceMonth}`;
                    const isUpdating = updatingKey === key;
                    return (
                      <View key={key} style={[styles.pendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.pendingTop}>
                          <View style={[styles.transactionIcon, { backgroundColor: colors.transferSoft }]}>
                            <Feather name="credit-card" size={17} color={colors.transfer} />
                          </View>
                          <View style={styles.transactionCopy}>
                            <Text numberOfLines={1} style={[styles.description, { color: colors.foreground }]}>{card.name}</Text>
                            <Text style={[styles.date, { color: colors.transfer }]}>
                              Fatura de {formatMonthYearLabel(new Date(`${invoice.invoiceMonth}-01T12:00:00`))}
                            </Text>
                          </View>
                          <Text style={[styles.amount, { color: colors.transfer }]}>{formatCurrency(invoice.amount)}</Text>
                        </View>
                        <View style={[styles.pendingBottom, { borderTopColor: colors.border }]}>
                          <Text style={[styles.status, { color: colors.transfer }]}>Fechada em dia</Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Pagar fatura fechada do cartão ${card.name}`}
                            testID={`notification-pay-closed-invoice-${card.id}-${invoice.invoiceMonth}`}
                            disabled={isUpdating}
                            onPress={() => void payInvoice(card.id, invoice.invoiceMonth)}
                            style={({ pressed }) => [
                              styles.payButton,
                              { backgroundColor: colors.transfer },
                              isUpdating && styles.updating,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={[styles.payButtonText, { color: colors.background }]}>
                              {isUpdating ? 'Salvando...' : 'Pagar fatura'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
            {overdueCardInvoices.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, (pendingTransactions.length > 0 || closedCardInvoices.length > 0) && styles.sectionLabelSpaced, { color: colors.mutedForeground }]}>Faturas atrasadas</Text>
                <View style={styles.pendingList}>
                  {overdueCardInvoices.map(({ card, invoice }) => {
                    const key = `invoice:${card.id}:${invoice.invoiceMonth}`;
                    const isUpdating = updatingKey === key;
                    return (
                      <View key={key} style={[styles.pendingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.pendingTop}>
                          <View style={[styles.transactionIcon, { backgroundColor: colors.expenseSoft }]}>
                            <Feather name="credit-card" size={17} color={colors.expense} />
                          </View>
                          <View style={styles.transactionCopy}>
                            <Text numberOfLines={1} style={[styles.description, { color: colors.foreground }]}>{card.name}</Text>
                            <Text style={[styles.date, { color: colors.expense }]}>
                              Fatura de {formatMonthYearLabel(new Date(`${invoice.invoiceMonth}-01T12:00:00`))}
                            </Text>
                          </View>
                          <Text style={[styles.amount, { color: colors.expense }]}>{formatCurrency(invoice.amount)}</Text>
                        </View>
                        <View style={[styles.pendingBottom, { borderTopColor: colors.border }]}>
                          <Text style={[styles.status, { color: colors.expense }]}>Atrasada</Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Pagar fatura atrasada do cartão ${card.name}`}
                            testID={`notification-pay-invoice-${card.id}-${invoice.invoiceMonth}`}
                            disabled={isUpdating}
                            onPress={() => void payInvoice(card.id, invoice.invoiceMonth)}
                            style={({ pressed }) => [
                              styles.payButton,
                              { backgroundColor: colors.expense },
                              isUpdating && styles.updating,
                              pressed && styles.pressed,
                            ]}
                          >
                            <Text style={[styles.payButtonText, { color: colors.destructiveForeground }]}>
                              {isUpdating ? 'Salvando...' : 'Pagar fatura'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <ConfirmationModal
        visible={Boolean(rejectingNotification)}
        title="Excluir notificação?"
        message={`O aviso "${rejectingNotification?.title || 'bancário'}" será removido e nenhum lançamento será criado.`}
        confirmLabel="Excluir notificação"
        onConfirm={confirmRejectNotification}
        onClose={() => setRejectingNotification(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  summaryCard: { borderWidth: 1, borderRadius: 9, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20 },
  summaryIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  summaryText: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 3 },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  sectionLabelSpaced: { marginTop: 20 },
  sectionHelper: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: -3, marginBottom: 8 },
  pendingList: { gap: 8 },
  pendingCard: { borderWidth: 1, borderRadius: 9, padding: 11 },
  pendingTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  transactionIcon: { width: 31, height: 31, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  transactionCopy: { flex: 1, minWidth: 0 },
  description: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  notificationText: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular', marginTop: 3 },
  date: { fontSize: 10, fontFamily: 'Inter_500Medium', marginTop: 3 },
  amount: { fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  pendingBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 9, borderTopWidth: 1 },
  notificationActions: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 9, borderTopWidth: 1 },
  status: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  payButton: { minHeight: 28, borderRadius: 6, paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  payButtonText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  rejectButton: { flex: 1, minHeight: 28, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  approveNotificationButton: { flex: 1 },
  rejectButtonText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  updating: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
});