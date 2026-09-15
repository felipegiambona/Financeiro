import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { goBackOrReplace } from '@/components/navigation';
import {
  DASHBOARD_CARD_OPTIONS,
  useDashboardPreferences,
} from '@/context/DashboardPreferencesContext';
import { useColors } from '@/hooks/useColors';

export default function DashboardCardsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { visibility, loaded, toggleCard, resetVisibility } = useDashboardPreferences();
  const visibleCount = DASHBOARD_CARD_OPTIONS.filter((option) => visibility[option.id]).length;

  const handleReset = () => {
    Alert.alert(
      'Restaurar cards?',
      'Todos os cards voltarão a aparecer no dashboard.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Restaurar', onPress: () => void resetVisibility() },
      ],
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Visão geral" title="Personalizar dashboard" showBack />
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Escolha quais cards deseja visualizar no seu dashboard. Você pode alterar essa seleção quando quiser.
        </Text>

        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="sliders" size={17} color={colors.foreground} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Cards visíveis</Text>
            <Text style={[styles.summaryDescription, { color: colors.mutedForeground }]}>
              {loaded ? `${visibleCount} de ${DASHBOARD_CARD_OPTIONS.length} cards ativos` : 'Carregando preferências...'}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Cards do dashboard</Text>
        <View style={[styles.optionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {DASHBOARD_CARD_OPTIONS.map((option, index) => {
            const selected = visibility[option.id];
            return (
              <React.Fragment key={option.id}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${option.title}: ${selected ? 'visível' : 'oculto'}`}
                  testID={`dashboard-card-option-${option.id}`}
                  onPress={() => void toggleCard(option.id)}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <View style={[styles.optionIcon, { backgroundColor: selected ? colors.primary : colors.secondary }]}>
                    <Feather name={option.icon} size={17} color={selected ? colors.primaryForeground : colors.foreground} />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: colors.foreground }]}>{option.title}</Text>
                    <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>{option.description}</Text>
                  </View>
                  <View pointerEvents="none">
                    <Switch
                      value={selected}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor={selected ? colors.primaryForeground : colors.mutedForeground}
                    />
                  </View>
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Restaurar cards padrão"
          testID="reset-dashboard-cards-button"
          onPress={handleReset}
          style={({ pressed }) => [styles.resetButton, { borderColor: colors.border }, pressed && styles.pressed]}
        >
          <Feather name="refresh-ccw" size={15} color={colors.foreground} />
          <Text style={[styles.resetText, { color: colors.foreground }]}>Restaurar cards padrão</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar para o dashboard"
          onPress={() => goBackOrReplace('/(tabs)')}
          style={({ pressed }) => [styles.doneButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
        >
          <Text style={[styles.doneText, { color: colors.primaryForeground }]}>Concluir</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  intro: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: -7, marginBottom: 22 },
  summaryCard: { minHeight: 72, borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 24 },
  summaryIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, minWidth: 0 },
  summaryTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  summaryDescription: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 3 },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  optionsCard: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13 },
  option: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11 },
  optionIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  optionDescription: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 3 },
  divider: { height: 1 },
  resetButton: { minHeight: 42, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18 },
  resetText: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  doneButton: { minHeight: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  doneText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  pressed: { opacity: 0.72 },
});