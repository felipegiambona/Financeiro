import { Feather } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useTheme, ThemeMode } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';

const THEME_OPTIONS: Array<{
  value: ThemeMode;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}> = [
  {
    value: 'light',
    title: 'Modo claro',
    description: 'Usar sempre a aparência clara.',
    icon: 'sun',
  },
  {
    value: 'dark',
    title: 'Modo escuro',
    description: 'Usar sempre a aparência escura.',
    icon: 'moon',
  },
  {
    value: 'system',
    title: 'Padrão do dispositivo',
    description: 'Acompanhar a configuração do aparelho.',
    icon: 'smartphone',
  },
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Preferências" title="Configurações" showBack />
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Personalize a aparência do Finanças Mobile.
        </Text>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Aparência</Text>
        <View style={[styles.optionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {THEME_OPTIONS.map((option, index) => {
            const selected = themeMode === option.value;
            return (
              <React.Fragment key={option.value}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Selecionar ${option.title}`}
                  testID={`theme-option-${option.value}`}
                  onPress={() => void setThemeMode(option.value)}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <View style={[styles.optionIcon, { backgroundColor: selected ? colors.primary : colors.secondary }]}>
                    <Feather name={option.icon} size={17} color={selected ? colors.primaryForeground : colors.foreground} />
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={[styles.optionTitle, { color: colors.foreground }]}>{option.title}</Text>
                    <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>{option.description}</Text>
                  </View>
                  <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
                    {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
                  </View>
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  intro: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: -7, marginBottom: 22 },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  optionsCard: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13 },
  option: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11 },
  optionIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  optionDescription: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 3 },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  divider: { height: 1 },
  pressed: { opacity: 0.72 },
});