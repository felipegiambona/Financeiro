import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export interface ConfirmationModalOption {
  label: string;
  onConfirm: () => Promise<void>;
  destructive?: boolean;
}

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm?: () => Promise<void>;
  options?: ConfirmationModalOption[];
  onClose: () => void;
  errorTitle?: string;
  errorMessage?: string;
}

export function ConfirmationModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  onConfirm,
  options,
  onClose,
  errorTitle = 'Não foi possível concluir',
  errorMessage = 'Tente novamente.',
}: ConfirmationModalProps) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  const execute = async (action: (() => Promise<void>) | undefined) => {
    if (!action) return;
    try {
      setBusy(true);
      await action();
      onClose();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={() => !busy && onClose()}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Fechar confirmação"
          disabled={busy}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.confirmationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.confirmationIcon, { backgroundColor: colors.expenseSoft }]}>
            <Feather name="trash-2" size={18} color={colors.expense} />
          </View>
          <Text style={[styles.confirmationTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.confirmationMessage, { color: colors.mutedForeground }]}>{message}</Text>
          {options ? (
            <View style={styles.confirmationOptionStack}>
              {options.map((option) => (
                <Pressable
                  key={option.label}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void execute(option.onConfirm)}
                  style={({ pressed }) => [
                    styles.confirmationOption,
                    option.destructive
                      ? { backgroundColor: colors.expense, borderColor: colors.expense }
                      : { backgroundColor: colors.card, borderColor: colors.border },
                    busy && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.confirmationOptionLabel, { color: option.destructive ? '#FFFFFF' : colors.foreground }]}>
                    {busy ? 'Excluindo...' : option.label}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onClose}
                style={({ pressed }) => [styles.confirmationCancel, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Text style={[styles.confirmationCancelLabel, { color: colors.foreground }]}>Cancelar</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.confirmationActions}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onClose}
                style={({ pressed }) => [styles.confirmationCancel, { borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Text style={[styles.confirmationCancelLabel, { color: colors.foreground }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void execute(onConfirm)}
                style={({ pressed }) => [styles.confirmationDelete, { backgroundColor: colors.expense }, busy && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.confirmationDeleteLabel}>{busy ? 'Excluindo...' : confirmLabel}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.76)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  confirmationCard: { width: '100%', maxWidth: 350, borderRadius: 12, borderWidth: 1, padding: 18, alignItems: 'center' },
  confirmationIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  confirmationTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  confirmationMessage: { marginTop: 7, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  confirmationActions: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 18 },
  confirmationOptionStack: { width: '100%', gap: 8, marginTop: 18 },
  confirmationOption: { minHeight: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  confirmationOptionLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  confirmationCancel: { flex: 1, minHeight: 40, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  confirmationCancelLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  confirmationDelete: { flex: 1.35, minHeight: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  confirmationDeleteLabel: { color: '#FFFFFF', fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.72 },
});