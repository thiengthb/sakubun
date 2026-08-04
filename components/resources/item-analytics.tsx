'use client';

import type { ReactNode } from 'react';
import {
  Brain,
  CalendarClock,
  CalendarPlus,
  Gauge,
  History,
  Repeat,
  Sparkles,
  Target,
  TrendingDown,
} from 'lucide-react';
import { AppBreadcrumbs } from '@/components/shell/app-breadcrumbs';
import { PageShell } from '@/components/shell/page-shell';
import { CopyCommandButton } from '@/components/shared/copy-command-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { EnrichmentCard } from '@/components/resources/enrichment-card';
import { InfoTooltip } from '@/components/shared/info-tooltip';
import { SectionTag } from '@/components/shared/section-tag';
import { SpokenLine } from '@/components/shared/spoken-line';
import { StarButton } from '@/components/shared/star-button';
import { ForgettingCurve } from '@/components/resources/item-forgetting-curve';
import { ReviewLog } from '@/components/resources/item-review-log';
import { useSessionState } from '@/components/shared/use-session-state';
import { parseEnrichment } from '@/lib/enrichment';
import { formatDateVN, formatDueExact, humanizeUntil, speakable } from '@/lib/format';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { cn } from '@/lib/utils';
import { STATE_LABELS } from '@/lib/srs-constants';
import type { ItemStats } from '@/lib/item-stats';

// State → badge tint, on the same alert→info scale the rest of the app uses (label always carries the
// meaning; color is only reinforcement). Suspended is handled separately (muted).
const STATE_BADGE: Record<number, string> = {
  0: 'border-info/60 text-info',
  1: 'border-warn/60 text-warn',
  2: 'border-accent-brand/60 text-accent-brand',
  3: 'border-alert/60 text-alert',
};

function pct(r: number): string {
  return `${Math.round(r * 100)}%`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  hint,
}: {
  icon: typeof Brain;
  label: string;
  value: ReactNode;
  sub?: string;
  hint?: string;
}) {
  return (
    // Denser below sm (2026-08-05): eight of these stack 2-across on a phone, so p-4 + text-2xl spent
    // ~370px of screen before the curve and the log — the two things you scroll here for. The label
    // truncates rather than wrapping, which is what kept the cards uneven in a 2-column grid.
    <Card className="gap-0.5 p-3 sm:gap-1 sm:p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {/* min-w-0 is what makes `truncate` bite on a flex item (min-width defaults to auto). */}
        <span className="min-w-0 truncate">{label}</span>
        {hint && <InfoTooltip label={`Về ${label}`}>{hint}</InfoTooltip>}
      </div>
      <div className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

/**
 * Per-item "card info" (Anki-style) analytics — the whole learning picture for ONE grammar pattern or
 * vocab word: FSRS metrics grid, the forgetting curve, the full review log, and (grammar) the
 * enrichment card. Read-only; editing/suspend/delete stay in the ⋮ row menu on /resources.
 */
export function ItemAnalytics({
  stats,
  groupsSlot,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  stats: ItemStats;
  /** Study-group membership control (chips + add/remove), rendered under the header. */
  groupsSlot?: ReactNode;
  /** TTS settings, so every Japanese line on the page can be played + read in sync. */
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  // Remember the active tab across navigation + reload (shared key across items — a "sticky tab" so
  // opening any item lands on the tab you last used, not always back on "Chỉ số").
  const [tab, setTab] = useSessionState('item.tab', 'stats');
  const { srs } = stats;
  const stateLabel = stats.suspended ? 'Tạm ngưng' : (STATE_LABELS[srs?.state ?? 0] ?? 'Mới');
  const scheduled = srs && srs.state !== 0 && !stats.suspended;

  const lastReview = srs?.lastReview ? new Date(srs.lastReview) : null;
  const dueDate = srs ? new Date(srs.due) : null;
  const dayMs = 86_400_000;
  const nowDay = stats.nowDay ?? -1;
  const dueDay = lastReview && dueDate ? (dueDate.getTime() - lastReview.getTime()) / dayMs : 0;
  const correctRate = stats.reviewCount ? stats.correctCount / stats.reviewCount : null;

  // Name the gaps in the enrichment card so the page can offer the exact instruction that fills them
  // — the answer to "where does the content come from", stated where the gap is noticed. Scoped to the
  // detail-card CONTENT only: furigana rides the unified enrich now (jaRuby comes bundled), so there is
  // no separate "add furigana" patch instruction anymore (2026-07-25).
  const enrichment = stats.kind === 'grammar' ? parseEnrichment(stats.enrichment) : null;
  const missing =
    stats.kind === 'grammar'
      ? ([
          !enrichment && 'thẻ chi tiết (cách dùng, ví dụ, bẫy, phân biệt)',
          enrichment && enrichment.pitfalls.length === 0 && 'bẫy hay gặp',
        ].filter(Boolean) as string[])
      : [];

  return (
    // Detail page: PageShell owns the frame; its tabs (Chỉ số / Thẻ) are content sub-tabs under the
    // item header, NOT page-level nav, so they stay below (not in headerAside) — a documented exception.
    <PageShell
      breadcrumb={
        <AppBreadcrumbs
          section="resources"
          detail={{
            kind: stats.kind,
            label: stats.expression,
            description: `${stats.expression} — ${stats.meaningVi}`,
          }}
        />
      }
      // The identity tags (JLPT level + SRS state) sit ON the breadcrumb row, right of the trail
      // (2026-07-25) — the breadcrumb already says grammar vs vocab, so the old "Ngữ pháp / Từ vựng"
      // kind badge is dropped as redundant. The star follows; the share toggle beside it went out with
      // the public library on 2026-08-03 and its slot prop is gone with it.
      headerAside={
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{stats.level}</Badge>
          <Badge variant="outline" className={cn(!stats.suspended && STATE_BADGE[srs?.state ?? 0])}>
            {stateLabel}
          </Badge>
          <StarButton id={stats.itemId} starred={stats.starred} kind="item" />
        </div>
      }
    >
      {/* Header — pattern + its definition on ONE row (ngữ pháp → định nghĩa), then âm Hán Việt
          (vocab). The level / state tags moved up to the breadcrumb row (headerAside); the kind badge
          is gone (the breadcrumb already names grammar vs vocab). */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/* The term itself is playable here too — this page is where the user studies it. The ruby
              is built from the stored reading (whole-term), same as the resource tables. */}
          <h1 className="text-2xl leading-tight font-semibold">
            <SpokenLine
              text={stats.expression}
              speakText={speakable(stats.expression)}
              ruby={buildFuriganaMarkup(stats.expression, stats.reading)}
              showFurigana={showFurigana}
              speaker={voiceSpeaker}
              rate={speechRate}
              label={stats.kind === 'grammar' ? 'Nghe mẫu' : 'Nghe từ'}
            />
          </h1>
          <p className="text-base text-muted-foreground">{stats.meaningVi}</p>
        </div>
        {stats.kind === 'vocab' && stats.hanviet && (
          <p className="text-sm text-muted-foreground">
            Âm Hán Việt:{' '}
            <span className="font-medium text-foreground capitalize">{stats.hanviet}</span>
          </p>
        )}
      </header>

      {groupsSlot && <div>{groupsSlot}</div>}

      {/* Two tabs: metrics + review log · then the enrichment / word detail (2026-07-18).
          A REAL tab bar here, not the app's `TabSelect` (2026-08-05, by request). TabSelect trades a
          tab bar for a select below `md` because a bar costs width proportional to the NUMBER of tabs —
          that trade pays on /settings (five tabs) and /guide (four). With TWO tabs it does not: the pair
          is ~200px at 360px, i.e. it already fits, so the select bought nothing and cost the thing a tab
          bar is for — both destinations visible at once, one tap away, no menu.
          The line is the tab row's POSITION, not the tab count: this row is page CONTENT and owns its
          full width, while the dashboard's two tabs (`analytics-tabs.tsx`) sit on the HEADER row, where
          360px leaves ~166px after the mobile top bar and the breadcrumb and e2e/mobile-layout.spec.ts
          requires that row to stay one line. There, a capped-width pill is exactly what is needed.
          `max-md:w-full` makes the pair split the phone's row evenly (a segmented control), which is also
          what turns the two labels into two big thumb targets. */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList className="max-md:w-full">
            <TabsTrigger value="stats">Chỉ số &amp; lịch</TabsTrigger>
            <TabsTrigger value="detail">
              {stats.kind === 'grammar' ? 'Thẻ chi tiết' : 'Chi tiết từ'}
            </TabsTrigger>
          </TabsList>
          {/* The Claude-instruction buttons, `md` AND UP ONLY (2026-08-05, by request).
              They are not a mobile control in the first place: each one COPIES a sentence for you to
              paste into Claude Desktop, and Claude Desktop is not on the phone you are holding — so on a
              phone they took two of the four slots on the tab row to offer an action that finishes
              somewhere else. The app cannot drive Claude itself (MCP runs the other way, invariant #1),
              which is exactly why the control is a copy button and not a "do it" button. */}
          <div className="hidden flex-wrap gap-2 md:ml-auto md:flex">
            <CopyCommandButton
              command={`luyện tập trung mẫu ${stats.expression}`}
              label="Luyện riêng mẫu này"
              icon={Target}
              expandOnHover
            />
            {missing.length > 0 && (
              <CopyCommandButton
                command={`bổ sung ${missing.join(' và ')} cho mẫu ${stats.expression}`}
                label="Nhờ Claude bổ sung"
                icon={Sparkles}
                expandOnHover
              />
            )}
          </div>
        </div>

        <TabsContent value="stats" className="space-y-6">
          {/* FSRS metrics grid — 4 cards: 2x2 on mobile, one even row from sm up (no orphan col). */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={Brain}
              label="Xác suất nhớ"
              value={stats.retrievability != null ? pct(stats.retrievability) : '—'}
              sub={stats.retrievability != null ? 'ngay bây giờ' : 'chưa ôn lần nào'}
              hint="Khả năng bạn còn nhớ mục này NGAY BÂY GIỜ, theo đường cong quên của FSRS. Càng gần đến hạn thì càng giảm."
            />
            <StatCard
              icon={Gauge}
              label="Độ bền trí nhớ"
              value={srs ? `${srs.stability.toFixed(1)}` : '—'}
              sub="ngày"
              hint="Trí nhớ bền tới đâu: số ngày ước tính để xác suất nhớ rơi về mức mong muốn. Càng cao càng nhớ lâu, khoảng ôn càng giãn."
            />
            <StatCard
              icon={TrendingDown}
              label="Độ khó"
              value={srs ? `${srs.difficulty.toFixed(1)}` : '—'}
              sub="trên thang 10"
              hint="Mục này khó với bạn tới đâu (1 dễ – 10 khó). Càng khó, FSRS xếp ôn càng dày."
            />
            <StatCard
              icon={CalendarClock}
              label="Đến hạn"
              value={
                scheduled && dueDate ? (
                  <span className="text-xl">{humanizeUntil(dueDate)}</span>
                ) : (
                  '—'
                )
              }
              sub={scheduled && dueDate ? formatDueExact(dueDate) : 'chưa lên lịch'}
              hint="Khi nào mục này nên được ôn lại. Đến hạn = xác suất nhớ đã rơi về mức mong muốn."
            />
            <StatCard
              icon={Repeat}
              label="Đã ôn"
              value={srs?.reps ?? 0}
              sub="lần"
              hint="Tổng số lần mục này được lên lịch ôn (đóng vai trò chính trong câu)."
            />
            <StatCard
              icon={Target}
              label="Tỉ lệ đúng"
              value={correctRate != null ? pct(correctRate) : '—'}
              sub={stats.reviewCount ? `${stats.correctCount}/${stats.reviewCount} lần` : 'chưa có'}
              hint="Số lần bạn làm ĐÚNG (Good/Easy) trên tổng số lần ôn — gồm cả khi mục xuất hiện phụ trong câu."
            />
            <StatCard
              icon={TrendingDown}
              label="Số lần quên"
              value={srs?.lapses ?? 0}
              sub="lần sai khi đang ôn"
              hint="Số lần bạn quên (chọn Again) khi mục đã vào giai đoạn ôn tập. Quên nhiều → mục sẽ vào 'Luyện điểm yếu'."
            />
            <StatCard
              icon={CalendarPlus}
              label="Ngày thêm"
              value={<span className="text-xl">{formatDateVN(stats.createdAt)}</span>}
              sub={
                stats.firstReviewedAt
                  ? `ôn lần đầu ${formatDateVN(stats.firstReviewedAt)}`
                  : 'chưa ôn'
              }
            />
          </div>

          {/* Forgetting curve */}
          {stats.forgettingCurve.length > 0 && dueDate && lastReview && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <TrendingDown className="size-5 text-muted-foreground" aria-hidden />
                Đường cong quên
              </h2>
              <Card className="p-4">
                <ForgettingCurve
                  points={stats.forgettingCurve}
                  nowDay={nowDay}
                  dueDay={dueDay}
                  retention={stats.retention}
                  currentR={stats.retrievability}
                />
              </Card>
            </section>
          )}

          {/* Review log */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <History className="size-5 text-muted-foreground" aria-hidden />
              Lịch sử ôn
              <span className="text-sm font-normal text-muted-foreground">
                ({stats.reviewCount} lần)
              </span>
            </h2>
            <ReviewLog
              reviews={stats.reviews}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
            />
          </section>
        </TabsContent>

        <TabsContent value="detail" className="space-y-4">
          {stats.kind === 'grammar' ? (
            <EnrichmentCard
              raw={stats.enrichment}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
              contrastLinks={stats.contrastLinks}
              persist
            />
          ) : (
            <div className="space-y-4 text-sm">
              {stats.hanviet && (
                <section className="space-y-1">
                  <SectionTag>Âm Hán Việt</SectionTag>
                  <p className="font-medium capitalize">{stats.hanviet}</p>
                </section>
              )}
              {stats.notes ? (
                <section className="space-y-1">
                  <SectionTag>Ví dụ</SectionTag>
                  <SpokenLine
                    text={stats.notes}
                    showFurigana={showFurigana}
                    speaker={voiceSpeaker}
                    rate={speechRate}
                    label="Nghe ví dụ"
                  />
                </section>
              ) : (
                !stats.hanviet && (
                  <EmptyState icon={null} className="p-4">
                    Chưa có chi tiết cho từ này.
                  </EmptyState>
                )
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
