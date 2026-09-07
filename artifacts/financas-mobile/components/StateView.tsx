import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function LoadingState() {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="small" />
      <Text style={[styles.stateText, { color: colors.mutedForeground }]}>Carregando seus lançamentos...</Text>
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <View style={[styles.iconCircle, { backgroundColor: colors.expenseSoft }]}>
        <Feather name="alert-circle" size={22} color={colors.expense} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.foreground }]}>Algo deu errado</Text>
      <Text style={[styles.stateText, { color: colors.mutedForeground }]}>Não conseguimos acessar seus lançamentos.</Text>
      <Pressable onPress={onRetry} style={({ pressed }) => [styles.retry, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
        <Text style={styles.retryText}>Tentar novamente</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
        <Feather name="inbox" size={22} color={colors.secondaryForeground} />
      </View>
      <Text style={[styles.stateTitle, { color: colors.foreground }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 20 },
  empty: { minHeight: 126, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 16 },
  iconCircle: { width: 36, height: 36, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  stateText: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  retry: { borderRadius: 6, paddingHorizontal: 14, paddingVertical: 8, marginTop: 3 },
  retryText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  pressed: { opacity: 0.72 },
});