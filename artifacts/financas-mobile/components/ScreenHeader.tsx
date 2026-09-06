import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  showBack?: boolean;
}

export function ScreenHeader({ eyebrow, title, actionLabel, onAction, showBack = false }: ScreenHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.titleGroup}>
        {showBack ? (
          <Pressable
            accessibilityLabel="Voltar"
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
        ) : null}
        <View>
          {eyebrow ? <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text> : null}
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        </View>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, { backgroundColor: colors.accent }, pressed && styles.pressed]}
        >
          <Feather name="plus" size={17} color={colors.accentForeground} />
          <Text style={[styles.actionText, { color: colors.accentForeground }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9EEE9' },
  eyebrow: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 7 },
  title: { fontSize: 28, lineHeight: 33, fontFamily: 'Inter_700Bold', letterSpacing: -0.7 },
  action: { minHeight: 42, borderRadius: 21, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  pressed: { opacity: 0.72 },
});