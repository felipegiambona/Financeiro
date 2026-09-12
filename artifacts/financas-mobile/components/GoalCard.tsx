import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { formatCurrency } from '@/utils/currency';
import { formatDate } from '@/utils/date';
import type { Goal } from '@/types/goal';

interface GoalCardProps {
  goal: Goal;
  savedAmount: number;
  percentage: number;
  progress: number;
  remaining: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function GoalCard({ goal, savedAmount, percentage, progress, remaining, onEdit, onDelete }: GoalCardProps) {
  const colors = useColors();
  const completed = percentage >= 100;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        {goal.imageData ? (
          <Image source={{ uri: goal.imageData }} style={styles.image} />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.secondary }]}>
            <Feather name="target" size={19} color={colors.foreground} />
          </View>
        )}
        <View style={styles.titleCopy}>
          <Text numberOfLines={2} style={[styles.title, { color: colors.foreground }]}>{goal.title}</Text>
          <Text style={[styles.deadline, { color: colors.mutedForeground }]}>
            {goal.deadline ? `Até ${formatDate(goal.deadline)}` : 'Sem data final'}
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityLabel={`Editar meta ${goal.title}`} onPress={onEdit} style={({ pressed }) => [styles.action, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
            <Feather name="edit-2" size={14} color={colors.foreground} />
          </Pressable>
          <Pressable accessibilityLabel={`Excluir meta ${goal.title}`} onPress={onDelete} style={({ pressed }) => [styles.action, { backgroundColor: colors.secondary }, pressed && styles.pressed]}>
            <Feather name="trash-2" size={14} color={colors.expense} />
          </Pressable>
        </View>
      </View>
      <View style={styles.amounts}>
        <Text style={[styles.saved, { color: completed ? colors.income : colors.foreground }]}>{formatCurrency(savedAmount)}</Text>
        <Text style={[styles.target, { color: colors.mutedForeground }]}>de {formatCurrency(goal.targetAmount)}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
        <View style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: completed ? colors.income : colors.accent }]} />
      </View>
      <View style={styles.footer}>
        <Text style={[styles.percentage, { color: completed ? colors.income : colors.mutedForeground }]}>
          {Math.round(percentage)}% concluído
        </Text>
        <Text style={[styles.remaining, { color: colors.mutedForeground }]}>
          {completed ? 'Meta alcançada' : `${formatCurrency(remaining)} restante`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 9, padding: 13, marginBottom: 9 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  image: { width: 42, height: 42, borderRadius: 9 },
  imagePlaceholder: { width: 42, height: 42, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  deadline: { fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 3 },
  actions: { flexDirection: 'row', gap: 6 },
  action: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 14 },
  saved: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  target: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 9 },
  progressBar: { height: '100%', borderRadius: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 7 },
  percentage: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  remaining: { flex: 1, textAlign: 'right', fontSize: 10, fontFamily: 'Inter_500Medium' },
  pressed: { opacity: 0.72 },
});