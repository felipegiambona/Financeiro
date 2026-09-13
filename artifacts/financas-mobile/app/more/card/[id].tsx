import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreditCardCard } from '@/components/CreditCardCard';
import { EmptyState, LoadingState } from '@/components/StateView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useCards } from '@/context/CardContext';
import { useColors } from '@/hooks/useColors';
import { formatCurrency } from '@/utils/currency';

export default function CardDetailsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, loading, refresh, deleteCard, payCardInvoice } = useCards();
  const [paying, setPaying] = useState(false);
  const card = cards.find((item) => item.id === id);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

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
      <View style={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}>
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
      </View>
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
  deleteButton: { minHeight: 44, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18 },
  deleteText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  pressed: { opacity: 0.72 },
});