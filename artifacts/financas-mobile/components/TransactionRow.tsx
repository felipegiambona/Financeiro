import { Feather } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { TransactionOccurrence } from '@/types/transaction';
import { formatCurrency } from '@/utils/currency';

interface TransactionRowProps {
  transaction: TransactionOccurrence;
  onPress?: () => void;
  onTogglePaymentStatus?: () => void;
  onDelete?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelection?: () => void;
  paymentStatusUpdating?: boolean;
  swipeOpen?: boolean;
  onSwipeOpen?: () => void;
  onSwipeClose?: () => void;
}

const SWIPE_ACTION_WIDTH = 168;

export function TransactionRow({
  transaction,
  onPress,
  onTogglePaymentStatus,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelection,
  paymentStatusUpdating = false,
  swipeOpen = false,
  onSwipeOpen,
  onSwipeClose,
}: TransactionRowProps) {
  const colors = useColors();
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const tone = isTransfer ? colors.transfer : isIncome ? colors.income : colors.expense;
  const softTone = isTransfer ? colors.transferSoft : isIncome ? colors.incomeSoft : colors.expenseSoft;
  const isPaid = transaction.paymentStatus === 'paid';
  const translateX = useRef(new Animated.Value(0)).current;
  const position = useRef(0);
  const panStart = useRef(0);
  const clampedTranslateX = useMemo(
    () => translateX.interpolate({
      inputRange: [-SWIPE_ACTION_WIDTH, 0],
      outputRange: [-SWIPE_ACTION_WIDTH, 0],
      extrapolate: 'clamp',
    }),
    [translateX],
  );

  const animateTo = (target: number) => {
    translateX.flattenOffset();
    position.current = target;
    Animated.spring(translateX, {
      toValue: target,
      friction: 8,
      tension: 70,
      useNativeDriver: true,
    }).start();
  };

  useEffect(() => {
    animateTo(swipeOpen ? -SWIPE_ACTION_WIDTH : 0);
  }, [swipeOpen, translateX]);

  const closeSwipe = () => {
    onSwipeClose?.();
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => (
        !selectionMode
        && Math.abs(gestureState.dx) > 8
        && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
      ),
      onPanResponderGrant: () => {
        translateX.stopAnimation((currentValue) => {
          const current = Math.max(-SWIPE_ACTION_WIDTH, Math.min(0, currentValue));
          panStart.current = current;
          position.current = current;
          translateX.setValue(current);
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const nextPosition = Math.max(
          -SWIPE_ACTION_WIDTH,
          Math.min(0, panStart.current + gestureState.dx),
        );
        position.current = nextPosition;
        translateX.setValue(nextPosition);
      },
      onPanResponderRelease: (_, gestureState) => {
        const current = Math.max(
          -SWIPE_ACTION_WIDTH,
          Math.min(0, panStart.current + gestureState.dx),
        );
        const shouldOpen = current < -(SWIPE_ACTION_WIDTH * 0.42) || gestureState.vx < -0.5;
        const target = shouldOpen ? -SWIPE_ACTION_WIDTH : 0;
        animateTo(target);
        if (shouldOpen) {
          onSwipeOpen?.();
        } else {
          onSwipeClose?.();
        }
      },
      onPanResponderTerminate: (_, gestureState) => {
        const current = Math.max(
          -SWIPE_ACTION_WIDTH,
          Math.min(0, panStart.current + gestureState.dx),
        );
        const shouldOpen = current < -(SWIPE_ACTION_WIDTH * 0.42);
        animateTo(shouldOpen ? -SWIPE_ACTION_WIDTH : 0);
        if (shouldOpen) {
          onSwipeOpen?.();
        } else {
          onSwipeClose?.();
        }
      },
    }),
    [onSwipeClose, onSwipeOpen, selectionMode, translateX],
  );

  const handleEdit = () => {
    if (swipeOpen) {
      closeSwipe();
    }
    onPress?.();
  };

  const handlePaymentStatus = () => {
    closeSwipe();
    onTogglePaymentStatus?.();
  };

  const handleDelete = () => {
    closeSwipe();
    onDelete?.();
  };

  return (
    <View {...panResponder.panHandlers} style={styles.swipeContainer}>
      {!selectionMode ? (
        <View
          pointerEvents={swipeOpen ? 'auto' : 'none'}
          style={[styles.swipeActions, { backgroundColor: colors.card }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${isPaid ? 'Marcar' : 'Marcar'} ${transaction.description} como ${isPaid ? 'não pago' : 'pago'}`}
            testID={`swipe-toggle-payment-${transaction.occurrenceKey}`}
            disabled={!onTogglePaymentStatus || paymentStatusUpdating}
            onPress={handlePaymentStatus}
            style={({ pressed }) => [styles.swipeAction, { backgroundColor: colors.muted }, pressed && styles.pressed]}
          >
            <Feather name={isPaid ? 'check-circle' : 'clock'} size={21} color={isPaid ? colors.paid : colors.pending} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Editar ${transaction.description}`}
            testID={`swipe-edit-${transaction.occurrenceKey}`}
            disabled={!onPress}
            onPress={handleEdit}
            style={({ pressed }) => [styles.swipeAction, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
          >
            <Feather name="edit-2" size={20} color={colors.foreground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Excluir ${transaction.description}`}
            testID={`swipe-delete-${transaction.occurrenceKey}`}
            disabled={!onDelete}
            onPress={handleDelete}
            style={({ pressed }) => [styles.swipeAction, { backgroundColor: colors.expense }, pressed && styles.pressed]}
          >
            <Feather name="trash-2" size={20} color={colors.primaryForeground} />
          </Pressable>
        </View>
      ) : null}
      <Animated.View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }, { transform: [{ translateX: clampedTranslateX }] }]}>
        {selectionMode ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${selected ? 'Desmarcar' : 'Selecionar'} ${transaction.description}`}
            onPress={onToggleSelection}
            style={[
              styles.checkbox,
              { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card },
            ]}
          >
            {selected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={selectionMode ? `${selected ? 'Desmarcar' : 'Selecionar'} ${transaction.description}` : onPress ? `Editar ${transaction.description}` : undefined}
          disabled={selectionMode ? !onToggleSelection : !onPress}
          onPress={selectionMode ? onToggleSelection : handleEdit}
          style={({ pressed }) => [styles.editArea, pressed && styles.pressed]}
        >
          <View style={[styles.typeIcon, { backgroundColor: softTone }]}>
            <Feather name={isTransfer ? 'repeat' : isIncome ? 'arrow-down-left' : 'arrow-up-right'} size={18} color={tone} />
          </View>
          <View style={styles.details}>
            <Text numberOfLines={1} style={[styles.description, { color: colors.foreground }]}>{transaction.description}</Text>
            <View style={styles.meta}>
              {transaction.recurrence.kind !== 'none' ? (
                <View style={[styles.recurrence, { backgroundColor: colors.secondary }]}>
                  <Feather name="repeat" size={10} color={colors.secondaryForeground} />
                  <Text style={[styles.recurrenceText, { color: colors.secondaryForeground }]}>
                    {transaction.recurrence.kind === 'installment' ? 'Parcelado' : 'Recorrente'}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
        <View style={styles.trailing}>
          <Text style={[styles.amount, { color: tone }]}>{isTransfer ? '' : isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Marcar ${transaction.description} como ${isPaid ? 'não pago' : 'pago'}`}
            testID={`toggle-payment-status-${transaction.occurrenceKey}`}
            disabled={!onTogglePaymentStatus || paymentStatusUpdating}
            onPress={handlePaymentStatus}
            style={({ pressed }) => [
              styles.status,
              { backgroundColor: isPaid ? colors.paidSoft : colors.pendingSoft },
              paymentStatusUpdating && styles.updating,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.statusText, { color: isPaid ? colors.paid : colors.pending }]}>
              {paymentStatusUpdating ? 'Salvando...' : isPaid ? 'Pago' : 'Não pago'}
            </Text>
          </Pressable>
        </View>
        {!selectionMode && onDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Excluir ${transaction.description}`}
            hitSlop={6}
            onPress={handleDelete}
            style={({ pressed }) => [styles.deleteButton, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Feather name="trash-2" size={14} color={colors.expense} />
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  swipeContainer: { position: 'relative', overflow: 'hidden', borderRadius: 8, marginBottom: 5 },
  swipeActions: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'flex-end' },
  swipeAction: { width: SWIPE_ACTION_WIDTH / 3, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 52, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 8 },
  editArea: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeIcon: { width: 29, height: 29, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, minWidth: 0, gap: 3 },
  description: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  recurrence: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  recurrenceText: { fontSize: 8, fontFamily: 'Inter_500Medium' },
  status: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  statusText: { fontSize: 8, fontFamily: 'Inter_600SemiBold' },
  amount: { fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  trailing: { alignItems: 'flex-end', gap: 5 },
  updating: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});