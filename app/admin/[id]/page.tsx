import { notFound } from 'next/navigation';
import { Activity, CalendarClock, GraduationCap, Inbox, Layers } from 'lucide-react';
import {
  ChartCard,
  Heatmap,
  HeatmapLegend,
  LevelBars,
  StatTile,
} from '@/components/features/dashboard/dashboard-charts';
import { LibraryTile } from '@/components/features/dashboard/library-tile';
import { RetentionCard } from '@/components/features/dashboard/retention-gauge';
import { StreakCard } from '@/components/features/dashboard/streak-card';
import { AccountActions } from '@/components/features/admin/account-actions';
import { EmptyState } from '@/components/common/empty-state';
import { RelativeTime } from '@/components/common/relative-time';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { getAccount } from '@/lib/admin/accounts';
import { getAdminUserId } from '@/lib/auth/current-user';
import { formatDateVN } from '@/lib/core/format';
import { userDb } from '@/lib/db/user-db';
import { getDashboard } from '@/lib/insights/dashboard';

export const dynamic = 'force-dynamic';

// One account (roadmap 7.2c): who they are, then the same numbers their Phân tích page shows, read
// through their own userDb. Weak spots are left out: they link to items only the learner can open.
export default async function AdminAccountPage({ params }: { params: Promise<{ id: string }> }) {
  await getAdminUserId();
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();
  const data = await getDashboard(userDb(id));

  const status = account.banned ? 'Bị chặn' : account.access === 'admin' ? 'Quản trị' : 'Người học';
  const grammar = data.grammarTotal;
  const masteredPct = grammar > 0 ? Math.round((data.masteredGrammar / grammar) * 100) : 0;

  return (
    <PageShell
      template="detail"
      breadcrumb={<ParentCrumbs section="admin" self />}
      title={account.name || account.email}
      subtitle={account.email}
      facts={[
        { label: 'Trạng thái', value: status, tone: account.banned ? 'text-destructive' : undefined },
        { label: 'Tạo', value: formatDateVN(account.createdAt) },
        {
          label: 'Ôn gần nhất',
          value: account.lastReviewAt ? <RelativeTime value={account.lastReviewAt} /> : 'Chưa ôn',
        },
        {
          label: 'Đăng nhập',
          value: account.lastSignInAt ? <RelativeTime value={account.lastSignInAt} /> : 'Không có phiên',
        },
      ]}
      // The menu sits at the end of the title row, beside the trail on a phone, like the star does.
      pageIcons={
        account.access === 'admin' ? undefined : (
          <AccountActions
            account={{ id: account.id, email: account.email, banned: account.banned }}
            afterDelete="/admin"
          />
        )
      }
    >
      {grammar + data.vocabTotal === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Chưa có mục nào"
          description="Tài khoản này chưa có ngữ pháp hay từ vựng nào trong kho."
        />
      ) : (
        <div className="space-y-3">
          <section aria-label="Tổng quan" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile
              icon={CalendarClock}
              tone="brand"
              items={[{ value: data.dueNow, label: 'Đến hạn' }]}
              note={`Còn ${data.newItems} mẫu mới`}
              explain={`Số lượt ôn đến hạn bây giờ. Còn ${data.newItems} mẫu chưa học lần nào.`}
            />
            <StreakCard
              current={data.streak.current}
              note={`Kỷ lục ${data.streak.longest} ngày`}
              explain={`Số ngày học liên tiếp. Kỷ lục ${data.streak.longest} ngày; 30 ngày qua ${data.reviewsLast30} lượt ôn.`}
            />
            <StatTile
              icon={GraduationCap}
              tone="ok"
              items={[{ value: `${masteredPct}%`, label: 'Thành thạo' }]}
              note={`${data.masteredGrammar}/${grammar} mẫu`}
              explain={`${data.masteredGrammar}/${grammar} mẫu đang ở trạng thái Ôn tập.`}
            />
            <LibraryTile
              grammar={grammar}
              vocab={data.vocabTotal}
              explain={`Kho học: ${grammar} ngữ pháp, ${data.vocabTotal} từ vựng; ${data.newLast30} mục mới trong 30 ngày qua.`}
            />
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <RetentionCard
              actual={data.retention.actual}
              desired={data.retention.desired}
              windowDays={data.retention.windowDays}
            />
            <ChartCard
              icon={Layers}
              title="Theo cấp"
              info="Ngữ pháp theo cấp JLPT, chia theo trạng thái ghi nhớ. Số cạnh chú thích là tổng toàn kho."
            >
              <LevelBars data={data.levelDist} totals={data.mastery} />
            </ChartCard>
          </section>

          <ChartCard
            icon={Activity}
            title="1 năm"
            info="Số lượt ôn mỗi ngày trong một năm qua."
            action={<HeatmapLegend />}
          >
            <Heatmap data={data.activity} max={data.activityMax} />
          </ChartCard>
        </div>
      )}
    </PageShell>
  );
}
