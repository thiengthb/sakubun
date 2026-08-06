import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isUnauthorized, trpc } from '~/lib/api';
import { useTheme, type Theme } from '~/lib/theme';

/**
 * Tiến độ — the home screen.
 *
 * EVERY NUMBER HERE ARRIVES ALREADY COMPUTED. Nothing on this screen is derived from timestamps: the
 * study day, the streak, "how much of today's goal is done" all depend on `settings.dayCutoffHour`
 * evaluated in the server's timezone, and a phone that worked them out itself would quietly disagree
 * with the web (ADR 0001, decision 4). The only arithmetic below is over the snapshot's own counts.
 */
export default function HomeScreen() {
  const theme = useTheme();
  const me = useQuery(trpc.me.queryOptions());
  const stats = useQuery(trpc.stats.queryOptions());
  const snapshot = useQuery(trpc.snapshot.queryOptions());

  // Only a real 401 sends the learner to /login. A network failure must not — see isUnauthorized.
  if (isUnauthorized(me.error) || isUnauthorized(stats.error) || isUnauthorized(snapshot.error)) {
    return <Redirect href="/login" />;
  }

  const failure = me.error ?? stats.error ?? snapshot.error;
  if (failure) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <Text style={[styles.title, { color: theme.text }]}>Không kết nối được máy chủ</Text>
        <Text style={[styles.centered, { color: theme.muted }]}>{failure.message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void me.refetch();
            void stats.refetch();
            void snapshot.refetch();
          }}
          style={[styles.button, { backgroundColor: theme.accent }]}
        >
          <Text style={[styles.buttonText, { color: theme.onAccent }]}>Thử lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Three independent queries: no one of them narrows another's `data`, so one explicit gate.
  const account = me.data;
  const s = stats.data;
  const lib = snapshot.data;
  if (!account || !s || !lib) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  const refreshing = stats.isFetching || snapshot.isFetching;
  const peakDay = Math.max(1, ...s.reviewsByDay.map((d) => d.count));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void stats.refetch();
              void snapshot.refetch();
            }}
            tintColor={theme.accent}
          />
        }
      >
        <Text style={[styles.title, { color: theme.text }]}>Tiến độ</Text>
        <Text style={[styles.muted, { color: theme.muted }]}>{account.email}</Text>

        <Section title="Hôm nay" theme={theme}>
          <View style={styles.grid}>
            <Stat label="Câu đã làm" value={`${s.today.sentences}/${s.sessionGoal}`} theme={theme} />
            <Stat label="Lượt ôn" value={s.today.reviews} theme={theme} />
            <Stat label="Mẫu mới" value={s.today.newGrammar} theme={theme} />
            <Stat label="Đang tới hạn" value={s.dueNow} theme={theme} />
          </View>
        </Section>

        <Section title="Chuỗi ngày học" theme={theme}>
          <View style={styles.grid}>
            <Stat label="Hiện tại" value={`${s.streak.current} ngày`} theme={theme} />
            <Stat label="Dài nhất" value={`${s.streak.longest} ngày`} theme={theme} />
          </View>
        </Section>

        <Section title="Bảy ngày qua" theme={theme}>
          <View style={styles.chart}>
            {s.reviewsByDay.map((day) => (
              <View key={day.day} style={styles.chartCol}>
                <Text style={[styles.chartValue, { color: theme.muted }]}>{day.count}</Text>
                <View
                  style={[
                    styles.bar,
                    {
                      backgroundColor: day.count > 0 ? theme.accent : theme.border,
                      // Bars are plain Views on purpose: seven rectangles do not justify a charting
                      // dependency. That call gets revisited when a screen needs a real chart.
                      height: Math.max(4, (day.count / peakDay) * 80),
                    },
                  ]}
                />
                <Text style={[styles.chartLabel, { color: theme.muted }]}>{day.day}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.footnote, { color: theme.muted }]}>
            Tổng {s.reviewsLast7Days} lượt ôn
          </Text>
        </Section>

        <Section title="Mức thuộc" theme={theme}>
          <View style={styles.grid}>
            <Stat label="Chưa học" value={s.mastery.new} theme={theme} />
            <Stat label="Đang học" value={s.mastery.learning} theme={theme} />
            <Stat label="Đang ôn" value={s.mastery.review} theme={theme} />
            <Stat label="Học lại" value={s.mastery.relearning} theme={theme} />
          </View>
        </Section>

        <Section title="Thư viện" theme={theme}>
          <View style={styles.grid}>
            <Stat
              label="Mẫu ngữ pháp"
              value={lib.items.filter((item) => item.kind === 'GRAMMAR').length}
              theme={theme}
            />
            <Stat
              label="Từ vựng"
              value={lib.items.filter((item) => item.kind === 'VOCAB').length}
              theme={theme}
            />
            <Stat label="Nhóm" value={lib.counts.groups} theme={theme} />
            <Stat label="Tạm ngưng" value={s.mastery.suspended} theme={theme} />
          </View>
        </Section>

        <Text style={[styles.footnote, { color: theme.muted }]}>
          Số liệu lúc {new Date(s.takenAt).toLocaleTimeString('vi-VN')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: Theme;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Stat({
  label,
  value,
  theme,
}: {
  label: string;
  value: number | string;
  theme: Theme;
}) {
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centered: { fontSize: 14, textAlign: 'center' },
  page: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700' },
  muted: { fontSize: 14 },
  section: { marginTop: 24, gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderRadius: 12, padding: 14 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 12, marginTop: 2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 120 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  chartValue: { fontSize: 11 },
  bar: { width: '100%', borderRadius: 4 },
  chartLabel: { fontSize: 10 },
  footnote: { fontSize: 12, marginTop: 12 },
  button: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  buttonText: { fontSize: 15, fontWeight: '600' },
});
