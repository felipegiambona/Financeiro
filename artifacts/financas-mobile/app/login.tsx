import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    try {
      setSubmitting(true);
      setError('');
      await signIn(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  };

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
        <Text style={[styles.title, { color: colors.foreground }]}>Acesse seu controle financeiro.</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Nesta primeira versão, qualquer e-mail válido e senha são aceitos.
        </Text>

        <Text style={[styles.label, { color: colors.foreground }]}>E-mail</Text>
        <TextInput
          accessibilityLabel="E-mail"
          testID="login-email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="voce@exemplo.com"
          placeholderTextColor={colors.mutedForeground}
          value={email}
          onChangeText={setEmail}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Senha</Text>
        <TextInput
          accessibilityLabel="Senha"
          testID="login-password"
          secureTextEntry
          placeholder="Digite qualquer senha"
          placeholderTextColor={colors.mutedForeground}
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void handleLogin()}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground }]}
        />

        {error ? <Text style={[styles.error, { color: colors.expense }]}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          testID="login-button"
          disabled={submitting}
          onPress={() => void handleLogin()}
          style={({ pressed }) => [styles.button, { backgroundColor: colors.primary }, submitting && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{submitting ? 'Entrando...' : 'Entrar'}</Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </Pressable>
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
  label: { marginTop: 13, marginBottom: 6, fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  input: { minHeight: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: 'Inter_400Regular' },
  error: { marginTop: 10, fontSize: 11, fontFamily: 'Inter_500Medium' },
  button: { minHeight: 48, borderRadius: 8, marginTop: 18, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buttonText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
});