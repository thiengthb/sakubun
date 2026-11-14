import type { Metadata } from 'next';
import { ArrowRight, Plug } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';
import { ButtonLink } from '@/components/ui/button';
import { StateNotice } from '@/components/common/state-notice';
import { LiveRefresh } from '@/components/layout/live-refresh';
import {
  ForecastMini,
  NeedsWork,
  NextSteps,
  TodayHero,
  WeekStrip,
  type RowLink,
} from '@/components/features/today/today-view';
import { LevelPick } from '@/components/features/today/level-pick';
import { getToday } from '@/lib/insights/today';
import { APP_TIME_ZONE } from '@/lib/core/format';
import { getUserDb } from '@/lib/auth/current-user';
import { hasAiConnection } from '@/lib/auth/connected-apps';
import { showConnectHint } from '@/lib/insights/connect-hint';

export const metadata: Metadata = {
  title: 'Hôm nay — sakubun',
  description: 'Hôm nay học gì: thẻ đến hạn, việc tiếp theo, việc cần xử lý.',
};

export const dynamic = 'force-dynamic';

const hourOf = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: APP_TIME_ZONE,
});

function greeting(now: Date): string {
  const h = Number(hourOf.format(now));
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

// Until a page reads which script or practice is next (U3d), the rows point at where each starts.
const NEXT_STEPS: RowLink[] = [
  {
    href: 'https://claude.ai/new',
    title: 'Luyện dịch với Claude',
    hint: 'Nói "luyện dịch", Claude soạn câu từ kho của bạn',
    mark: '文',
  },
  {
    href: '/kaiwa',
    title: 'Nghe lại một kịch bản',
    hint: 'Hội thoại: đọc theo, nghe từng vai',
    mark: '話',
  },
  {
    href: '/library',
    title: 'Lấy thêm mẫu ở Kho chung',
    hint: 'Ngữ pháp, từ vựng, kanji và kịch bản theo cấp',
    mark: '新',
  },
];

export default async function TodayPage() {
  const db = await getUserDb();
  const now = new Date();
  const [today, connected, firstReview] = await Promise.all([
    getToday(db, now),
    hasAiConnection(db.$ownerId()),
    db.reviewLog.findFirst({ select: { id: true } }),
  ]);
  const connectHint = showConnectHint({ connected, reviewed: firstReview !== null }) && (
    <StateNotice
      icon={Plug}
      title="Kết nối Claude để bắt đầu luyện"
      action={
        <ButtonLink href="/settings?tab=guide" variant="outline" size="sm" className="shrink-0">
          Xem hướng dẫn <ArrowRight aria-hidden />
        </ButtonLink>
      }
    >
      Claude hoặc ChatGPT soạn câu và chấm bài; sakubun giữ kho và lịch ôn.
    </StateNotice>
  );

  if (today.hero.kind === 'empty') {
    // A new account starts empty (phase 8, L4): the lead area asks for a level (U3c).
    return (
      <PageShell template="dashboard" title="Hôm nay" meta={greeting(now)} width="wide">
        <LiveRefresh />
        {connectHint}
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <LevelPick kanjiWaiting={today.hero.kanjiWaiting} />
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      template="dashboard"
      title="Hôm nay"
      meta={
        today.streak.current > 0
          ? `${greeting(now)} · chuỗi ${today.streak.current} ngày`
          : greeting(now)
      }
      width="wide"
    >
      <LiveRefresh />
      {connectHint}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <TodayHero hero={today.hero} now={now} />
          <NextSteps rows={NEXT_STEPS} />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <div className="max-lg:hidden">
            <WeekStrip week={today.week} streak={today.streak} />
          </div>
          <NeedsWork today={today} />
          <div className="max-lg:hidden">
            <ForecastMini forecast={today.forecast} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
