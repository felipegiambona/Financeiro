import { Feather } from '@expo/vector-icons';
import { useSignIn, useSignUp } from '@clerk/expo';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';

type Mode = 'signIn' | 'signUp' | 'verifyEmail' | 'verifyMfa' | 'forgot' | 'reset';

function errorMessage(error: unknown): string {
  const clerkError = error as { errors?: Array<{ longMessage?: string; message?: string }> };
  return clerkError.errors?.[0]?.longMessage
    ?? clerkError.errors?.[0]?.message
    ?? (error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.');
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submitting = signInStatus === 'fetching' || signUpStatus === 'fetching';

  const finalizeSignIn = async () => {
    await signIn.finalize({ navigate: () => undefined });
  };

  const handlePrimary = async () => {
    try {
      setError('');
      if (mode === 'signIn') {
        const result = await signIn.password({ emailAddress: email.trim().toLowerCase(), password });
        if (result.error) throw result.error;
        if (signIn.status === 'complete') await finalizeSignIn();
        else if (signIn.status === 'needs_second_factor') {
          const hasAuthenticatorFactor = signIn.supportedSecondFactors.some((factor) => factor.strategy === 'totp');
          if (!hasAuthenticatorFactor) {
            throw new Error('Sua conta exige uma etapa adicional que ainda não está disponível nesta tela.');
          }
          setCode('');
          setMode('verifyMfa');
        } else {
          throw new Error('Não foi possível concluir o login.');
        }
      } else if (mode === 'signUp') {
        const result = await signUp.password({ emailAddress: email.trim().toLowerCase(), password });
        if (result.error) throw result.error;
        await signUp.verifications.sendEmailCode();
        setMode('verifyEmail');
      } else if (mode === 'verifyEmail') {
        const result = await signUp.verifications.verifyEmailCode({ code });
        if (result.error) throw result.error;
        if (signUp.status !== 'complete') throw new Error('O código ainda não concluiu a verificação.');
        await signUp.finalize({ navigate: () => undefined });
      } else if (mode === 'verifyMfa') {
        const result = await signIn.mfa.verifyTOTP({ code });
        if (result.error) throw result.error;
        if (signIn.status === 'complete') await finalizeSignIn();
        else throw new Error('O código não concluiu a verificação.');
      } else if (mode === 'forgot') {
        const created = await signIn.create({ identifier: email.trim().toLowerCase() });
        if (created.error) throw created.error;
        const sent = await signIn.resetPasswordEmailCode.sendCode();
        if (sent.error) throw sent.error;
        setMode('reset');
      } else {
        const verified = await signIn.resetPasswordEmailCode.verifyCode({ code });
        if (verified.error) throw verified.error;
        const changed = await signIn.resetPasswordEmailCode.submitPassword({
          password,
          signOutOfOtherSessions: true,
        });
        if (changed.error) throw changed.error;
        if (signIn.status === 'complete') await finalizeSignIn();
        else throw new Error('Não foi possível concluir a troca de senha.');
      }
    } catch (submitError) {
      setError(errorMessage(submitError));
    }
  };

  const title = mode === 'signIn' ? 'Acesse seu controle financeiro.'
    : mode === 'signUp' ? 'Crie sua conta segura.'
      : mode === 'verifyEmail' ? 'Confirme seu e-mail.'
        : mode === 'verifyMfa' ? 'Confirme sua identidade.'
        : mode === 'forgot' ? 'Recupere seu acesso.'
          : 'Defina uma nova senha.';
  const primaryLabel = mode === 'signIn' ? 'Entrar'
    : mode === 'signUp' ? 'Criar conta'
      : mode === 'verifyEmail' ? 'Confirmar código'
        : mode === 'verifyMfa' ? 'Verificar código'
        : mode === 'forgot' ? 'Enviar código'
          : 'Trocar senha';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.mark, { backgroundColor: colors.primary }]}>
          <Feather name="bar-chart-2" size={24} color={colors.primaryForeground} />
        </View>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>FINANÇAS MOBILE</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Seus lançamentos ficam protegidos e separados dos dados de outras pessoas.
        </Text>

        {mode !== 'verifyEmail' && mode !== 'reset' ? (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>E-mail</Text>
            <TextInput accessibilityLabel="E-mail" testID="login-email" autoCapitalize="none" autoComplete="email"
              keyboardType="email-address" placeholder="voce@exemplo.com" placeholderTextColor={colors.mutedForeground}
              value={email} onChangeText={setEmail}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]} />
          </>
        ) : null}

        {mode === 'signIn' || mode === 'signUp' || mode === 'reset' ? (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>
              {mode === 'reset' ? 'Nova senha' : 'Senha'}
            </Text>
            <TextInput accessibilityLabel="Senha" testID="login-password" secureTextEntry
              placeholder="Digite sua senha" placeholderTextColor={colors.mutedForeground}
              value={password} onChangeText={setPassword}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]} />
          </>
        ) : null}

        {mode === 'verifyMfa' ? (
          <>
            <Text style={[styles.mfaHint, { color: colors.mutedForeground }]}>
              Abra seu aplicativo autenticador e informe o código atual de 6 dígitos.
            </Text>
            <Text style={[styles.label, { color: colors.foreground }]}>Código do autenticador</Text>
            <TextInput accessibilityLabel="Código do autenticador" testID="mfa-code" keyboardType="number-pad"
              maxLength={6} placeholder="000000" placeholderTextColor={colors.mutedForeground}
              value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]} />
          </>
        ) : null}

        {mode === 'verifyEmail' || mode === 'reset' ? (
          <>
            <Text style={[styles.label, { color: colors.foreground }]}>Código enviado por e-mail</Text>
            <TextInput accessibilityLabel="Código" testID="verification-code" keyboardType="number-pad"
              placeholder="000000" placeholderTextColor={colors.mutedForeground} value={code} onChangeText={setCode}
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]} />
          </>
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.expense }]}>{error}</Text> : null}
        <Pressable accessibilityRole="button" testID="login-button" disabled={submitting}
          onPress={() => void handlePrimary()}
          style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, submitting && styles.disabled, pressed && styles.pressed]}>
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{submitting ? 'Aguarde...' : primaryLabel}</Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </Pressable>

        <View style={styles.links}>
          {mode === 'signIn' ? (
            <>
              <Pressable testID="forgot-password-link" onPress={() => { setError(''); setMode('forgot'); }}>
                <Text style={[styles.link, { color: colors.foreground }]}>Esqueci minha senha</Text>
              </Pressable>
              <Pressable testID="create-account-link" onPress={() => { setError(''); setMode('signUp'); }}>
                <Text style={[styles.link, { color: colors.foreground }]}>Criar uma conta</Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => { signIn.reset(); signUp.reset(); setCode(''); setError(''); setMode('signIn'); }}>
              <Text style={[styles.link, { color: colors.foreground }]}>Voltar para entrar</Text>
            </Pressable>
          )}
        </View>
        <View nativeID="clerk-captcha" />
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22, justifyContent: 'center' },
  mark: { width: 48, height: 48, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  eyebrow: { fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5 },
  title: { marginTop: 8, maxWidth: 330, fontSize: 29, lineHeight: 35, fontFamily: 'Inter_700Bold', letterSpacing: -0.8 },
  subtitle: { marginTop: 9, marginBottom: 23, maxWidth: 340, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  mfaHint: { marginTop: 12, marginBottom: -1, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  label: { marginTop: 13, marginBottom: 6, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  input: { minHeight: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  error: { marginTop: 10, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_500Medium' },
  button: { minHeight: 48, borderRadius: 8, marginTop: 18, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttonText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  links: { marginTop: 20, gap: 14, alignItems: 'center' },
  link: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});