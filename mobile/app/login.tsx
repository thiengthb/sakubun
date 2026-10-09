import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { trpc } from '~/lib/api';
import { authClient } from '~/lib/auth-client';
import { useTheme } from '~/lib/theme';

export default function LoginScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = useQuery(trpc.authConfig.queryOptions());

  async function enter() {
    await queryClient.invalidateQueries();
    router.replace('/');
  }

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error: authError } = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (authError) {
      setError(authError.message ?? 'Đăng nhập không thành công.');
      return;
    }
    await enter();
  }

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const { error: authError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/',
    });
    setBusy(false);
    if (authError) {
      setError(authError.message ?? 'Đăng nhập Google không thành công.');
      return;
    }
    await enter();
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.form}>
        <Text style={[styles.title, { color: theme.text }]}>sakubun</Text>
        <Text style={[styles.subtitle, { color: theme.muted }]}>
          Đăng nhập bằng tài khoản bạn dùng trên web.
        </Text>

        <Text style={[styles.label, { color: theme.text }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
        />

        <Text style={[styles.label, { color: theme.text }]}>Mật khẩu</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          onSubmitEditing={() => canSubmit && void signIn()}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
        />

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={() => void signIn()}
          style={[styles.button, { backgroundColor: theme.accent, opacity: canSubmit ? 1 : 0.5 }]}
        >
          {busy ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <Text style={[styles.buttonText, { color: theme.onAccent }]}>Đăng nhập</Text>
          )}
        </Pressable>

        {config.data?.googleEnabled ? (
          <>
            <Text style={[styles.divider, { color: theme.muted }]}>hoặc</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void signInWithGoogle()}
              style={[
                styles.buttonOutline,
                { borderColor: theme.border, backgroundColor: theme.card, opacity: busy ? 0.5 : 1 },
              ]}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>Đăng nhập bằng Google</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  form: { padding: 24, gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 15, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  error: { fontSize: 14, marginTop: 8 },
  button: { marginTop: 20, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonOutline: { borderWidth: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  divider: { fontSize: 13, textAlign: 'center', marginVertical: 12 },
});
