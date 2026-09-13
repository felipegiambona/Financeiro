import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreditCardCard } from '@/components/CreditCardCard';
import { EmptyState, LoadingState } from '@/components/StateView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useCards } from '@/context/CardContext';
import { useColors } from '@/hooks/useColors';
import { formatCurrency } from '@/utils/currency';
import { getCardHistory } from '@/services/cardRepository';
import { formatDate, formatMonthYearLabel } from '@/utils/date';
import type { CardHistoryItem } from '@/types/card';

export default function CardDetailsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, loading, refresh, deleteCard, payCardInvoice } = useCards();
  const [paying, setPaying] = useState(false);
  const [history, setHistory] = useState<CardHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
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

  const handlePay = () => {
    if (!card) return;
    Alert.alert(
      'Pagar fatura?',
      `A fatura atual de ${card.name} será marcada como paga e zerada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Pagar',
          onPress: () => {
            setPaying(true);
            void payCardInvoice(card.id)
              .then(() => loadHistory())
              .catch(() => Alert.alert('Não foi possível pagar', 'Tente novamente.'))
              .finally(() => setPaying(false));
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!card) return;
    Alert.alert(
      `Excluir ${card.name}?`,
      'O cartão e os dados da fatura serão removidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void deleteCard(card.id)
              .then(() => router.back())
              .catch(() => Alert.alert('Não foi possível excluir', 'Tente novamente.'));
          },
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
            <CreditCardCard card={card} onPay={handlePay} paying={paying} />
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Informações do cartão</Text>
            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <InfoRow label="Nome" value={card.name} colors={colors} />
              <InfoRow label="Vencimento" value={`Dia ${card.dueDay}`} colors={colors} />
              <InfoRow label="Fechamento" value={`Dia ${card.closingDay}`} colors={colors} />
              <InfoRow label="Fatura atual" value={formatCurrency(card.currentInvoiceAmount)} colors={colors} />
              <InfoRow label="Limite disponível" value={card.availableLimit == null ? 'Não informado' : formatCurrency(card.availableLimit)} colors={colors} />
              <InfoRow label="Status da fatura" value={card.invoiceStatus === 'closed' ? 'Fechada' : 'Aberta'} colors={colors} last />
            </View>
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Histórico de {formatMonthYearLabel(new Date())}
            </Text>
            <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {historyLoading ? (
                <Text style={[styles.historyState, { color: colors.mutedForeground }]}>Carregando histórico...</Text>
              ) : history.length === 0 ? (
                <Text style={[styles.historyState, { color: colors.mutedForeground }]}>Nenhum lançamento nesta fatura.</Text>
              ) : history.map((item, index) => (
                <View
                  key={item.id}
                  style={[
                    styles.historyRow,
                    index < history.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 },
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
                      <Text style={[styles.historyStatus, { color: item.paymentStatus === 'paid' ? colors.paid : colors.pending }]}>
                        {item.paymentStatus === 'paid' ? 'Pago' : 'Não pago'}
                      </Text>
                    </View>
                  )}
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
  content: { flex: 1, paddingHorizontal: 16 },
  iconButton: { width: 36, height: 36, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.1, textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  infoCard: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13 },
  infoRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  infoLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 12, fontFamily: 'Inter_700Bold' },
  historyCard: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13 },
  historyState: { fontSize: 11, fontFamily: 'Inter_400Regular', paddingVertical: 16, textAlign: 'center' },
  historyRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 9 },
  historyIcon: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  historyCopy: { flex: 1, minWidth: 0 },
  historyDescription: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  historyDate: { fontSize: 9, fontFamily: 'Inter_400Regular', marginTop: 3 },
  historyAmount: { alignItems: 'flex-end' },
  historyValue: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  historyStatus: { fontSize: 9, fontFamily: 'Inter_600SemiBold', marginTop: 3 },
  closureLabel: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  deleteButton: { minHeight: 44, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18 },
  deleteText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  pressed: { opacity: 0.72 },
});