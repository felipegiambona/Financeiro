import { Feather } from '@expo/vector-icons';
import {
  createPrivacyRequest,
  createSupportRequest,
  listPrivacyConsents,
  listPrivacyRequests,
  recordPrivacyConsent,
  type PrivacyRequestRequestType,
  type SupportRequestInputCategory,
} from '@workspace/api-client-react';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { exportPrivacyData } from '@workspace/api-client-react';
import { sharePrivacyExport } from '@/services/privacyExport';

const REQUESTS: Array<{ type: PrivacyRequestRequestType; title: string; description: string }> = [
  { type: 'access', title: 'Acessar meus dados', description: 'Registre uma solicitação para receber confirmação e acesso aos dados tratados.' },
  { type: 'correction', title: 'Corrigir meus dados', description: 'Explique qual informação precisa ser corrigida.' },
  { type: 'deletion', title: 'Solicitar exclusão', description: 'Abra uma solicitação formal de eliminação de dados.' },
];

const SUPPORT_CATEGORIES: Array<{ value: SupportRequestInputCategory; label: string }> = [
  { value: 'account', label: 'Conta' },
  { value: 'privacy', label: 'Privacidade' },
  { value: 'billing', label: 'Cobrança' },
  { value: 'technical', label: 'Problema técnico' },
];

export default function PrivacyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [privacyActive, setPrivacyActive] = useState(false);
  const [termsActive, setTermsActive] = useState(false);
  const [communicationsActive, setCommunicationsActive] = useState(false);
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof listPrivacyRequests>>>([]);
  const [supportCategory, setSupportCategory] = useState<SupportRequestInputCategory>('account');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [busy, setBusy] = useState('');

  const loadPrivacy = useCallback(async () => {
    const [consentState, requestState] = await Promise.all([listPrivacyConsents(), listPrivacyRequests()]);
    setPrivacyActive(consentState.consents.some((consent) => consent.documentKey === 'privacy' && consent.active));
    setTermsActive(consentState.consents.some((consent) => consent.documentKey === 'terms' && consent.active));
    setCommunicationsActive(consentState.consents.some((consent) => consent.documentKey === 'communications' && consent.active));
    setRequests(requestState);
  }, []);

  useEffect(() => {
    void loadPrivacy().catch(() => {
      Alert.alert('Não foi possível carregar', 'Tente novamente em alguns instantes.');
    });
  }, [loadPrivacy]);

  const saveConsent = async (documentKey: 'privacy' | 'terms' | 'communications', active: boolean) => {
    setBusy(`consent-${documentKey}`);
    try {
      await recordPrivacyConsent({ documentKey, accepted: active });
      await loadPrivacy();
    } catch {
      Alert.alert('Não foi possível salvar', 'Tente novamente.');
    } finally {
      setBusy('');
    }
  };

  const submitPrivacyRequest = async (requestType: PrivacyRequestRequestType) => {
    setBusy(`request-${requestType}`);
    try {
      const request = await createPrivacyRequest({ requestType });
      setRequests((current) => [request, ...current]);
      Alert.alert('Solicitação registrada', 'Você poderá acompanhar o status nesta tela.');
    } catch {
      Alert.alert('Não foi possível registrar', 'Tente novamente.');
    } finally {
      setBusy('');
    }
  };

  const handleExport = async () => {
    setBusy('export');
    try {
      const data = await exportPrivacyData();
      await sharePrivacyExport(data);
    } catch {
      Alert.alert('Não foi possível exportar', 'Tente novamente.');
    } finally {
      setBusy('');
    }
  };

  const submitSupport = async () => {
    if (!supportSubject.trim() || !supportMessage.trim()) {
      Alert.alert('Preencha os campos', 'Informe um assunto e descreva o que aconteceu.');
      return;
    }
    setBusy('support');
    try {
      await createSupportRequest({
        category: supportCategory,
        subject: supportSubject.trim(),
        message: supportMessage.trim(),
      });
      setSupportSubject('');
      setSupportMessage('');
      Alert.alert('Solicitação enviada', 'A equipe poderá acompanhar este atendimento pelo processo interno.');
    } catch {
      Alert.alert('Não foi possível enviar', 'Tente novamente.');
    } finally {
      setBusy('');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader eyebrow="Conta" title="Privacidade e suporte" showBack />
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          Controle seus documentos, direitos e solicitações sem enviar dados financeiros por canais inseguros.
        </Text>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Documentos públicos</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { key: 'privacy' as const, title: 'Política de Privacidade', icon: 'shield' as const },
            { key: 'terms' as const, title: 'Termos de Uso', icon: 'file-text' as const },
            { key: 'contact' as const, title: 'Contato e confiança', icon: 'mail' as const },
          ].map((item, index) => (
            <React.Fragment key={item.key}>
              {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/legal/${item.key}`)}
                style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}
              >
                <Feather name={item.icon} size={17} color={colors.foreground} />
                <Text style={[styles.linkText, { color: colors.foreground }]}>{item.title}</Text>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Aceites e preferências</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ConsentRow title="Política de Privacidade" active={privacyActive} disabled={busy === 'consent-privacy'} onToggle={() => void saveConsent('privacy', !privacyActive)} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <ConsentRow title="Termos de Uso" active={termsActive} disabled={busy === 'consent-terms'} onToggle={() => void saveConsent('terms', !termsActive)} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <ConsentRow title="Comunicações de produto (opcional)" active={communicationsActive} disabled={busy === 'consent-communications'} onToggle={() => void saveConsent('communications', !communicationsActive)} colors={colors} />
          <Text style={[styles.helper, { color: colors.mutedForeground }]}>
            Os documentos necessários são registrados com versão, data e conta. A preferência opcional pode ser revogada sem bloquear o serviço. O logout encerra a sessão deste dispositivo.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Direitos do titular</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Pressable accessibilityRole="button" disabled={busy === 'export'} onPress={() => void handleExport()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, busy === 'export' && styles.disabled, pressed && styles.pressed]}>
            <Feather name="download" size={16} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{busy === 'export' ? 'Preparando exportação...' : 'Exportar meus dados (JSON)'}</Text>
          </Pressable>
          {REQUESTS.map((item) => (
            <Pressable key={item.type} accessibilityRole="button" disabled={Boolean(busy)} onPress={() => void submitPrivacyRequest(item.type)} style={({ pressed }) => [styles.requestRow, { borderColor: colors.border }, pressed && styles.pressed]}>
              <View style={styles.requestCopy}>
                <Text style={[styles.requestTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text style={[styles.requestDescription, { color: colors.mutedForeground }]}>{item.description}</Text>
              </View>
              <Feather name="arrow-up-right" size={16} color={colors.foreground} />
            </Pressable>
          ))}
          {requests.length > 0 ? (
            <View style={[styles.history, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.historyTitle, { color: colors.foreground }]}>Solicitações recentes</Text>
              {requests.slice(0, 4).map((request) => (
                <Text key={request.id} style={[styles.historyItem, { color: colors.mutedForeground }]}>
                  {request.requestType} · {request.status}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Fale com o suporte</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Categoria</Text>
          <View style={styles.categoryRow}>
            {SUPPORT_CATEGORIES.map((category) => (
              <Pressable key={category.value} onPress={() => setSupportCategory(category.value)} style={[styles.category, { borderColor: supportCategory === category.value ? colors.primary : colors.border, backgroundColor: supportCategory === category.value ? colors.secondary : colors.card }]}>
                <Text style={[styles.categoryText, { color: colors.foreground }]}>{category.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>Assunto</Text>
          <TextInput value={supportSubject} onChangeText={setSupportSubject} placeholder="Ex.: dúvida sobre minha conta" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.card }]} />
          <Text style={[styles.label, { color: colors.foreground }]}>Mensagem</Text>
          <TextInput value={supportMessage} onChangeText={setSupportMessage} multiline numberOfLines={5} placeholder="Não inclua senhas, códigos ou dados financeiros completos." placeholderTextColor={colors.mutedForeground} style={[styles.textArea, { color: colors.foreground, borderColor: colors.input, backgroundColor: colors.card }]} />
          <Pressable accessibilityRole="button" disabled={busy === 'support'} onPress={() => void submitSupport()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, busy === 'support' && styles.disabled, pressed && styles.pressed]}>
            <Feather name="send" size={16} color={colors.primaryForeground} />
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{busy === 'support' ? 'Enviando...' : 'Enviar solicitação'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function ConsentRow({
  title,
  active,
  disabled,
  onToggle,
  colors,
}: {
  title: string;
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: active }} disabled={disabled} onPress={onToggle} style={({ pressed }) => [styles.consentRow, disabled && styles.disabled, pressed && styles.pressed]}>
      <View style={styles.requestCopy}>
        <Text style={[styles.requestTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.requestDescription, { color: colors.mutedForeground }]}>{active ? 'Aceito e registrado' : 'Aceite pendente ou revogado'}</Text>
      </View>
      <View style={[styles.switch, { backgroundColor: active ? colors.primary : colors.border }]}>
        <View style={[styles.switchThumb, { backgroundColor: active ? colors.primaryForeground : colors.mutedForeground, alignSelf: active ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  intro: { fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular', marginTop: -7, marginBottom: 5 },
  sectionLabel: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 9, padding: 13, gap: 9 },
  divider: { height: 1 },
  linkRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkText: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  consentRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  switch: { width: 37, height: 22, borderRadius: 12, padding: 3, justifyContent: 'center' },
  switchThumb: { width: 16, height: 16, borderRadius: 8 },
  helper: { fontSize: 10, lineHeight: 15, fontFamily: 'Inter_400Regular', marginTop: 3 },
  requestRow: { minHeight: 58, borderWidth: 1, borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  requestCopy: { flex: 1, minWidth: 0 },
  requestTitle: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  requestDescription: { fontSize: 10, lineHeight: 14, fontFamily: 'Inter_400Regular', marginTop: 2 },
  primaryButton: { minHeight: 44, borderRadius: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryButtonText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  history: { borderRadius: 8, padding: 10, gap: 3 },
  historyTitle: { fontSize: 11, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  historyItem: { fontSize: 10, fontFamily: 'Inter_400Regular' },
  label: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 4, marginBottom: 4 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  category: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, minHeight: 30, justifyContent: 'center' },
  categoryText: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, fontSize: 12, fontFamily: 'Inter_400Regular' },
  textArea: { minHeight: 100, borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, paddingTop: 10, textAlignVertical: 'top', fontSize: 12, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});