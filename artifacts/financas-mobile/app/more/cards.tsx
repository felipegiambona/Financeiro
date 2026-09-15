import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreditCardCard } from '@/components/CreditCardCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/StateView';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useCards } from '@/context/CardContext';
import { useColors } from '@/hooks/useColors';
import type { Card } from '@/types/card';
import { formatAmountInput, formatAmountValue, parseAmountInput } from '@/utils/currency';

export default function CardsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cards, loading, error, refresh, createCard, updateCard, payCardInvoice } = useCards();
  const { openNew, editId } = useLocalSearchParams<{ openNew?: string; editId?: string }>();
  const handledRouteAction = useRef(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [name, setName] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [availableLimit, setAvailableLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [payingCardId, setPayingCardId] = useState<string | null>(null);

  useFocusEffect(React.useCallback(() => {
    void refresh();
  }, [refresh]));

  useEffect(() => {
    if (handledRouteAction.current) return;
    const cardToEdit = editId ? cards.find((card) => card.id === editId) : undefined;
    if (cardToEdit) {
      handledRouteAction.current = true;
      openEditor(cardToEdit);
      return;
    }
    if (openNew !== '1') return;
    handledRouteAction.current = true;
    openEditor();
  }, [cards, editId, openNew]);

  const openEditor = (card?: Card) => {
    setEditingCard(card ?? null);
    setName(card?.name ?? '');
    setDueDay(card ? String(card.dueDay) : '');
    setClosingDay(card ? String(card.closingDay) : '');
    setAvailableLimit(card?.availableLimit == null ? '' : formatAmountValue(card.availableLimit));
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (!saving) setEditorOpen(false);
  };

  const saveCard = async () => {
    const trimmedName = name.trim();
    const parsedDueDay = Number(dueDay);
    const parsedClosingDay = Number(closingDay);
    const limitAmount = availableLimit.trim() ? parseAmountInput(availableLimit) : null;

    if (!trimmedName) {
      Alert.alert('Nome obrigatório', 'Informe um nome para o cartão.');
      return;
    }
    if (!Number.isInteger(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) {
      Alert.alert('Vencimento inválido', 'Informe um dia entre 1 e 31.');
      return;
    }
    if (!Number.isInteger(parsedClosingDay) || parsedClosingDay < 1 || parsedClosingDay > 31) {
      Alert.alert('Fechamento inválido', 'Informe um dia entre 1 e 31.');
      return;
    }
    if (limitAmount !== null && (!Number.isFinite(limitAmount) || limitAmount < 0)) {
      Alert.alert('Valor inválido', 'Confira os valores informados.');
      return;
    }

    try {
      setSaving(true);
      const input = {
        name: trimmedName,
        dueDay: parsedDueDay,
        closingDay: parsedClosingDay,
        availableLimit: limitAmount,
      };
      if (editingCard) await updateCard(editingCard.id, input);
      else await createCard(input);
      setEditorOpen(false);
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handlePay = (card: Card) => {
    const message = `A fatura atual de ${card.name} será marcada como paga e zerada.`;
    const executePayment = () => {
      setPayingCardId(card.id);
      void payCardInvoice(card.id)
        .catch(() => Alert.alert('Não foi possível pagar', 'Tente novamente.'))
        .finally(() => setPayingCardId(null));
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Organização"
          title="Cartões"
          showBack
          actionLabel="Novo"
          actionIcon="plus"
          onAction={() => openEditor()}
        />
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Controle seus cartões, faturas e datas importantes em um só lugar.
        </Text>
        {loading ? <LoadingState /> : error ? <ErrorState onRetry={() => void refresh()} /> : cards.length === 0 ? (
          <EmptyState message="Você ainda não cadastrou nenhum cartão." />
        ) : cards.map((card) => (
          <CreditCardCard
            key={card.id}
            card={card}
            onPress={() => router.push({ pathname: '/more/card/[id]', params: { id: card.id } })}
            onPay={() => handlePay(card)}
            paying={payingCardId === card.id}
          />
        ))}
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
                  <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>Cartão de crédito</Text>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingCard ? 'Editar cartão' : 'Novo cartão'}</Text>
                </View>
                <Pressable accessibilityLabel="Fechar editor de cartão" onPress={closeEditor} style={({ pressed }) => [styles.closeButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
                  <Feather name="x" size={18} color={colors.foreground} />
                </Pressable>
              </View>

              <Text style={[styles.label, { color: colors.foreground }]}>Nome</Text>
              <TextInput
                accessibilityLabel="Nome do cartão"
                autoCapitalize="words"
                placeholder="Ex.: Nubank, Visa principal..."
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />

              <View style={styles.fieldsRow}>
                <View style={styles.dayField}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Dia de vencimento</Text>
                  <TextInput
                    accessibilityLabel="Dia de vencimento"
                    keyboardType="number-pad"
                    placeholder="10"
                    placeholderTextColor={colors.mutedForeground}
                    value={dueDay}
                    onChangeText={(value) => setDueDay(value.replace(/\D/g, '').slice(0, 2))}
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
                  />
                </View>
                <View style={styles.dayField}>
                  <Text style={[styles.label, { color: colors.foreground }]}>Dia de fechamento</Text>
                  <TextInput
                    accessibilityLabel="Dia de fechamento"
                    keyboardType="number-pad"
                    placeholder="3"
                    placeholderTextColor={colors.mutedForeground}
                    value={closingDay}
                    onChangeText={(value) => setClosingDay(value.replace(/\D/g, '').slice(0, 2))}
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
                  />
                </View>
              </View>

              <Text style={[styles.label, { color: colors.foreground }]}>Limite disponível</Text>
              <TextInput
                accessibilityLabel="Limite disponível"
                keyboardType="decimal-pad"
                placeholder="Opcional"
                placeholderTextColor={colors.mutedForeground}
                value={availableLimit}
                onChangeText={(value) => setAvailableLimit(formatAmountInput(value))}
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
              />

              <Pressable disabled={saving} onPress={() => void saveCard()} style={({ pressed }) => [styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled, pressed && styles.pressed]}>
                <Text style={[styles.saveText, { color: colors.primaryForeground }]}>{saving ? 'Salvando...' : editingCard ? 'Salvar alterações' : 'Criar cartão'}</Text>
              </Pressable>
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  intro: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: -7, marginBottom: 20 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  modalCard: { width: '100%', maxWidth: 350, maxHeight: '88%', borderRadius: 10, borderWidth: 1, padding: 14, flexShrink: 1 },
  modalScroll: { flexShrink: 1 },
  modalContent: { paddingBottom: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.1, textTransform: 'uppercase' },
  modalTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginTop: 4 },
  closeButton: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginBottom: 7, marginTop: 14 },
  input: { minHeight: 45, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 13, fontFamily: 'Inter_400Regular' },
  fieldsRow: { flexDirection: 'row', gap: 10 },
  dayField: { flex: 1 },
  saveButton: { minHeight: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  saveText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});