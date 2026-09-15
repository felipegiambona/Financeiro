import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { useFinancialProfiles } from '@/context/FinancialProfileContext';

const MENU_ITEMS = [
  {
    key: 'profile',
    title: 'Perfil',
    description: 'Dados da conta, segurança e sessão',
    icon: 'user',
  },
  {
    key: 'wallets',
    title: 'Carteiras',
    description: 'Contas, bancos e saldos iniciais',
    icon: 'briefcase',
  },
  {
    key: 'categories',
    title: 'Categorias',
    description: 'Organize seus lançamentos por tipo de gasto',
    icon: 'tag',
  },
  {
    key: 'limits',
    title: 'Meus limites',
    description: 'Acompanhe seus gastos por categoria e lançamento',
    icon: 'target',
  },
  {
    key: 'goals',
    title: 'Metas e objetivos',
    description: 'Planeje e acompanhe o dinheiro dos seus objetivos',
    icon: 'award',
  },
  {
    key: 'cards',
    title: 'Cartões',
    description: 'Acompanhe faturas, vencimentos e limites dos seus cartões',
    icon: 'credit-card',
  },
  {
    key: 'investments',
    title: 'Investimentos',
    description: 'Acompanhe sua carteira pessoal e rentabilidade',
    icon: 'trending-up',
  },
  {
    key: 'settings',
    title: 'Configurações',
    description: 'Aparência e preferências do app',
    icon: 'sliders',
  },
  {
    key: 'privacy',
    title: 'Privacidade e suporte',
    description: 'Documentos, direitos do titular e atendimento',
    icon: 'shield',
  },
] as const;

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeProfile } = useFinancialProfiles();
  const menuItems = MENU_ITEMS.filter((item) => item.key !== 'investments' || activeProfile?.type === 'personal');

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Conta" title="Mais" />
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Acesse configurações e recursos da sua conta.
        </Text>
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {menuItems.map((item, index) => (
            <React.Fragment key={item.key}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${item.title}`}
                testID={`more-menu-${item.key}`}
                onPress={() => router.push(
                  item.key === 'profile'
                    ? '/more/profile'
                    : item.key === 'wallets'
                      ? '/wallets'
                      : item.key === 'categories'
                        ? '/more/categories'
                        : item.key === 'limits'
                          ? '/more/limits'
                        : item.key === 'goals'
                          ? '/more/goals'
                          : item.key === 'cards'
                            ? '/more/cards'
                          : item.key === 'investments'
                            ? '/more/investments'
                           : item.key === 'privacy'
                             ? '/more/privacy'
                           : '/more/settings',
                )}
                style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
              >
                <View style={[styles.menuIcon, { backgroundColor: colors.secondary }]}>
                  <Feather name={item.icon} size={17} color={colors.foreground} />
                </View>
                <View style={styles.menuCopy}>
                  <Text style={[styles.menuTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.menuDescription, { color: colors.mutedForeground }]}>{item.description}</Text>
                </View>
                <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
              </Pressable>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  intro: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: -7, marginBottom: 18 },
  menuCard: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 13 },
  menuItem: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11 },
  menuIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, minWidth: 0 },
  menuTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  menuDescription: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 3 },
  divider: { height: 1 },
  pressed: { opacity: 0.72 },
});