import { Feather } from '@expo/vector-icons';
import { type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { goBackOrReplace } from '@/components/navigation';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ComponentProps<typeof Feather>['name'];
  notificationCount?: number;
  onNotificationPress?: () => void;
  showBack?: boolean;
  backFallback?: Href;
  onBack?: () => void;
  rightContent?: React.ReactNode;
}

export function ScreenHeader({
  eyebrow,
  title,
  actionLabel,
  onAction,
  actionIcon = 'plus',
  notificationCount = 0,
  onNotificationPress,
  showBack = false,
  backFallback = '/(tabs)',
  onBack,
  rightContent,
}: ScreenHeaderProps) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <View style={styles.titleGroup}>
        {showBack ? (
          <Pressable
            accessibilityLabel="Voltar"
            hitSlop={12}
            onPress={onBack ?? (() => goBackOrReplace(backFallback))}
            style={({ pressed }) => [styles.backButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
        ) : null}
        <View>
          {eyebrow ? <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text> : null}
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {rightContent}
        {onNotificationPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={notificationCount > 0 ? `Abrir notificações, ${notificationCount} pendências` : 'Abrir notificações'}
            testID="notifications-button"
            onPress={onNotificationPress}
            style={({ pressed }) => [styles.notificationButton, { backgroundColor: colors.secondary, borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Feather name="bell" size={17} color={colors.foreground} />
            {notificationCount > 0 ? (
              <View style={[styles.notificationBadge, { backgroundColor: colors.expense }]}>
                <Text style={[styles.notificationBadgeText, { color: colors.destructiveForeground }]}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : null}
        {actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            style={({ pressed }) => [styles.action, { backgroundColor: colors.accent }, pressed && styles.pressed]}
          >
            <Feather name={actionIcon} size={17} color={colors.accentForeground} />
            <Text style={[styles.actionText, { color: colors.accentForeground }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  backButton: { width: 34, height: 34, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5 },
  title: { fontSize: 24, lineHeight: 29, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  notificationButton: { width: 36, height: 36, borderRadius: 7, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: { position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { fontSize: 8, lineHeight: 10, fontFamily: 'Inter_700Bold' },
  action: { minHeight: 36, borderRadius: 7, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pressed: { opacity: 0.72 },
});