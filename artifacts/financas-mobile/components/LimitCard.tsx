import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Limit } from '@/types/limit';
import type { LimitUsage } from '@/services/limitRules';
import { formatCurrency } from '@/utils/currency';
import { LIMIT_PERIODS } from '@/types/limit';
import { useColors } from '@/hooks/useColors';

interface LimitCardProps {
  limit: Limit;
  categoryName: string;
  usage: LimitUsage;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function LimitCard({ limit, categoryName, usage, onPress, onEdit, onDelete }: LimitCardProps) {
  const colors = useColors();
  const periodLabel = LIMIT_PERIODS.find((period) => period.value === limit.period)?.label ?? 'Período';
  const exceeded = usage.remaining < 0;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
          <Pressable
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={onPress ? `Visualizar limite de ${categoryName}` : undefined}
            onPress={onPress}
            style={({ pressed }) => [styles.titleCopy, pressed && styles.pressed]}
          >
          <View style={styles.titleLine}>
            <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
              <Feather name="target" size={16} color={colors.foreground} />
            </View>
            <View style={styles.titleText}>
              <Text numberOfLines={1} style={[styles.category, { color: colors.foreground }]}>{categoryName}</Text>
              <Text style={[styles.period, { color: colors.mutedForeground }]}>
                {limit.description ? `${limit.description} · ` : ''}{periodLabel}
              </Text>
            </View>
            </View>
          </Pressable>
        <View style={styles.actions}>
          {onEdit ? (
            <Pressable accessibilityLabel={`Editar limite de ${categoryName}`} testID={`edit-limit-${limit.id}`} onPress={onEdit} style={({ pressed }) => [styles.action, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
              <Feather name="edit-2" size={14} color={colors.foreground} />
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable accessibilityLabel={`Excluir limite de ${categoryName}`} testID={`delete-limit-${limit.id}`} onPress={onDelete} style={({ pressed }) => [styles.action, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
              <Feather name="trash-2" size={14} color={colors.expense} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <Pressable
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? `Abrir detalhes do limite de ${categoryName}` : undefined}
        onPress={onPress}
        style={({ pressed }) => [styles.cardBody, pressed && styles.pressed]}
      >
        <View style={styles.amounts}>
          <Text style={[styles.used, { color: exceeded ? colors.expense : colors.foreground }]}>{formatCurrency(usage.used)} usados</Text>
          <Text style={[styles.limitAmount, { color: colors.mutedForeground }]}>de {formatCurrency(limit.amount)}</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
          <View style={[styles.progressBar, { width: `${usage.progress * 100}%`, backgroundColor: exceeded ? colors.expense : colors.accent }]} />
        </View>
        <View style={styles.footer}>
          <Text style={[styles.percentage, { color: exceeded ? colors.expense : colors.mutedForeground }]}>
            {Math.round(usage.percentage)}% usado
          </Text>
          <Text style={[styles.remaining, { color: exceeded ? colors.expense : colors.mutedForeground }]}>
            {exceeded ? `${formatCurrency(Math.abs(usage.remaining))} acima` : `${formatCurrency(usage.remaining)} disponível`}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 9, padding: 13, marginBottom: 9 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  titleCopy: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  titleText: { flex: 1, minWidth: 0 },
  category: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  period: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  actions: { flexDirection: 'row', gap: 6 },
  action: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 14 },
  cardBody: { borderRadius: 6 },
  used: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  limitAmount: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 9 },
  progressBar: { height: '100%', borderRadius: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 7 },
  percentage: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  remaining: { flex: 1, textAlign: 'right', fontSize: 10, fontFamily: 'Inter_500Medium' },
  pressed: { opacity: 0.72 },
});