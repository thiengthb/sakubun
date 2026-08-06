import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isUnauthorized, trpc } from '~/lib/api';
import { useTheme } from '~/lib/theme';

/**
 * The first screen, and for now a deliberately thin one: it exists to prove the whole native path end
 * to end (SecureStore cookie jar -> `Cookie` header -> better-auth session -> tRPC guard -> library).
 *
 * It shows COUNTS and the snapshot's timestamp — never a derived schedule. "Bao nhiêu thẻ tới hạn hôm
 * nay" depends on the study-day cutoff and the daily limit, which are server truth (ADR 0001, decision
 * 4); a client that computed its own answer would quietly disagree with the web. That number arrives
 * with the `stats` procedure in a later phase, as a number, already computed.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const me = useQuery(trpc.me.queryOptions());
  const snapshot = useQuery(trpc.snapshot.queryOptions());

  // Only a real 401 sends the learner to /login. A network failure must not — see isUnauthorized.
  if (isUnauthorized(me.error) || isUnauthorized(snapshot.error)) {
    return <Redirect href="/login" />;
  }

  if (me.isPending || snapshot.isPending) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  const failure = me.error ?? snapshot.error;
  if (failure) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.text }]}>Không kết nối được máy chủ</Text>
        <Text style={[styles.muted, { color: theme.muted }]}>{failure.message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void me.refetch();
            void snapshot.refetch();
          }}
          style={[styles.button, { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.buttonText, { color: theme.onAccent }]}>Thử lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Two independent queries: neither `isPending` check above narrows the OTHER one's `data`, so the
  // compiler is right to still call these possibly-undefined. One explicit gate, then real types.
  const data = snapshot.data;
  const account = me.data;
  if (!data || !account) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  const suspended = data.items.filter((item) => item.suspended).length;
  const grammar = data.items.filter((item) => item.kind === 'GRAMMAR').length;
  const vocab = data.items.filter((item) => item.kind === 'VOCAB').length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={[styles.title, { color: theme.text }]}>Thư viện</Text>
        <Text style={[styles.muted, { color: theme.muted }]}>{account.email}</Text>

        <View style={styles.grid}>
          <Stat label="Mẫu ngữ pháp" value={grammar} />
          <Stat label="Từ vựng" value={vocab} />
          <Stat label="Nhóm" value={data.counts.groups} />
          <Stat label="Đang tạm ngưng" value={suspended} />
        </View>

        <Text style={[styles.footnote, { color: theme.muted }]}>
          Số liệu lúc {new Date(data.takenAt).toLocaleTimeString('vi-VN')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  page: { padding: 24, gap: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  muted: { fontSize: 14, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  card: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: 12, padding: 16 },
  statValue: { fontSize: 28, fontWeight: '700' },
  statLabel: { fontSize: 13, marginTop: 4 },
  footnote: { fontSize: 12, marginTop: 20, textAlign: 'left' },
  button: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
