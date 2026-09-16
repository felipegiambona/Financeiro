import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useNotificationAutomation } from '@/context/NotificationAutomationContext';
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
  const automation = useNotificationAutomation();
  const [packagesText, setPackagesText] = useState('');

  useEffect(() => {
    setPackagesText(automation.allowedPackages.join(', '));
  }, [automation.allowedPackages]);

  const savePackages = () => {
    void automation.setAllowedPackages(packagesText.split(','));
  };

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
                  <View style={[styles.radio, { borderColor: selected ? colors.radio : colors.border }]}>
                    {selected ? <View style={[styles.radioDot, { backgroundColor: colors.radio }]} /> : null}
                  </View>
                </Pressable>
              </React.Fragment>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Automação Android</Text>
        <View style={[styles.automationCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.automationHeader}>
            <View style={styles.optionIconAndCopy}>
              <View style={[styles.optionIcon, { backgroundColor: automation.enabled ? colors.primary : colors.secondary }]}>
                <Feather name="bell" size={17} color={automation.enabled ? colors.primaryForeground : colors.foreground} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionTitle, { color: colors.foreground }]}>Ler notificações bancárias</Text>
                <Text style={[styles.optionDescription, { color: colors.mutedForeground }]}>
                  {automation.enabled ? 'Ativa para os aplicativos configurados.' : 'Desativada até você autorizar.'}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: automation.enabled }}
              accessibilityLabel="Ativar automação por notificações"
              testID="notification-automation-toggle"
              disabled={automation.busy || !automation.status.supported}
              onPress={() => void automation.setEnabled(!automation.enabled)}
              style={[styles.switch, { backgroundColor: automation.enabled ? colors.primary : colors.border }, automation.busy && styles.disabled]}
            >
              <View style={[styles.switchThumb, { backgroundColor: automation.enabled ? colors.primaryForeground : colors.mutedForeground, alignSelf: automation.enabled ? 'flex-end' : 'flex-start' }]} />
            </Pressable>
          </View>
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            O texto é processado no aparelho. Somente notificações dos pacotes informados abaixo entram na fila de automação.
          </Text>
          {!automation.status.supported ? (
            <View style={[styles.notice, { backgroundColor: colors.secondary }]}>
              <Feather name="info" size={15} color={colors.foreground} />
              <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
                Disponível apenas em um APK Android de desenvolvimento ou produção. O Expo Go não inclui esse serviço nativo.
              </Text>
            </View>
          ) : null}
          <Text style={[styles.label, { color: colors.foreground }]}>Pacotes Android autorizados</Text>
          <TextInput
            testID="notification-package-input"
            defaultValue={automation.allowedPackages.join(', ')}
            key={automation.allowedPackages.join('|')}
            onChangeText={setPackagesText}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="com.exemplo.banco, com.outro.app"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.card }]}
          />
          <Text style={[styles.packageHint, { color: colors.mutedForeground }]}>
            Separe vários pacotes por vírgula. O nome pode ser conferido nas informações do aplicativo Android.
          </Text>
          <Pressable
            accessibilityRole="button"
            testID="save-notification-packages"
            disabled={automation.busy || !automation.status.supported}
            onPress={savePackages}
            style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, automation.busy && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Salvar aplicativos</Text>
          </Pressable>
          {automation.status.supported && !automation.status.listenerAccessGranted ? (
            <Pressable
              accessibilityRole="button"
              testID="open-notification-settings"
              onPress={() => void automation.openSettings()}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
            >
              <Feather name="settings" size={15} color={colors.primaryForeground} />
              <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Abrir acesso às notificações</Text>
            </Pressable>
          ) : null}
          {automation.pendingCount > 0 ? (
            <Text style={[styles.packageHint, { color: colors.mutedForeground }]}>
              {automation.pendingCount} notificação(ões) aguardando processamento.
            </Text>
          ) : null}
          {automation.message ? <Text style={[styles.message, { color: colors.foreground }]}>{automation.message}</Text> : null}
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
  automationCard: { borderWidth: 1, borderRadius: 9, padding: 13, gap: 10 },
  automationHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10 },
  optionIconAndCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11 },
  option: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11 },
  optionIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  optionDescription: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 3 },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 3, marginBottom: -3 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, fontSize: 12, fontFamily: 'Inter_400Regular' },
  packageHint: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular' },
  notice: { borderRadius: 7, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noticeText: { flex: 1, fontSize: 10, lineHeight: 15, fontFamily: 'Inter_500Medium' },
  message: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_600SemiBold' },
  helper: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 3 },
  switch: { width: 37, height: 22, borderRadius: 12, padding: 3, justifyContent: 'center' },
  switchThumb: { width: 16, height: 16, borderRadius: 8 },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  divider: { height: 1 },
  secondaryButton: { minHeight: 42, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  primaryButton: { minHeight: 42, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});