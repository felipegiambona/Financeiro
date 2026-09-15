import { Feather } from '@expo/vector-icons';
import { getLegalDocument, type LegalDocumentKey } from '@workspace/api-client-react';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

const DOCUMENT_KEYS = ['privacy', 'terms', 'contact'] as const;

function isDocumentKey(value: string | string[] | undefined): value is LegalDocumentKey {
  return typeof value === 'string' && DOCUMENT_KEYS.includes(value as LegalDocumentKey);
}

export default function LegalDocumentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { document } = useLocalSearchParams<{ document?: string }>();
  const [content, setContent] = useState<Awaited<ReturnType<typeof getLegalDocument>> | null>(null);
  const [error, setError] = useState('');
  const backTarget = session ? '/(tabs)' : '/login';

  useEffect(() => {
    if (!isDocumentKey(document)) {
      setError('Documento não encontrado.');
      return;
    }
    let mounted = true;
    setError('');
    void getLegalDocument(document)
      .then((value) => {
        if (mounted) setContent(value);
      })
      .catch(() => {
        if (mounted) setError('Não foi possível carregar este documento.');
      });
    return () => {
      mounted = false;
    };
  }, [document]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          eyebrow="Transparência"
          title={content?.title ?? 'Documento'}
          showBack
          backFallback={backTarget}
          onBack={() => router.replace(backTarget)}
        />
        {content?.isDraft ? (
          <View style={[styles.notice, { backgroundColor: colors.accent, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={16} color={colors.accentForeground} />
            <Text style={[styles.noticeText, { color: colors.accentForeground }]}>
              Rascunho operacional: este texto precisa de revisão jurídica antes do lançamento.
            </Text>
          </View>
        ) : null}
        {content ? (
          <>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>
              Versão {content.version} · Atualizado em {content.lastUpdated}
            </Text>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {content.body.map((paragraph, index) => (
                <Text key={`${content.key}-${index}`} style={[styles.paragraph, { color: colors.foreground }]}>
                  {paragraph}
                </Text>
              ))}
            </View>
          </>
        ) : error ? (
          <Text style={[styles.error, { color: colors.expense }]}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace(backTarget)}
          style={({ pressed }) => [styles.backButton, { borderColor: colors.border }, pressed && styles.pressed]}
        >
          <Text style={[styles.backText, { color: colors.foreground }]}>Voltar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  notice: { borderWidth: 1, borderRadius: 8, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'flex-start', marginBottom: 12 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_600SemiBold' },
  meta: { fontSize: 11, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 9, padding: 14, gap: 14 },
  paragraph: { fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  error: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium' },
  backButton: { minHeight: 44, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  backText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  pressed: { opacity: 0.72 },
});