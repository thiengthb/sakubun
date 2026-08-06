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
import { useQueryClient } from '@tanstack/react-query';
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

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error: authError } = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (authError) {
      setError(authError.message ?? 'Đăng nhập không thành công.');
      return;
    }
    // NAVIGATE BY HAND, do not wait on `useSession` (better-auth #10545: on React Native the session
    // store can fail to notify after sign-in, and the app then sits on this screen until it is killed).
    // The cookie is already in SecureStore at this point, so the next request is authenticated —
    // invalidate so the home screen refetches rather than reading a cached 401.
    await queryClient.invalidateQueries();
    router.replace('/');
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
  buttonText: { fontSize: 16, fontWeight: '600' },
});
