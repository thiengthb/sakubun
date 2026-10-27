'use client';

import { useTransition, type ReactNode } from 'react';
import {
  Pause,
  Play,
  Brain,
  CalendarClock,
  CalendarPlus,
  Gauge,
  Repeat,
  Sparkles,
  Target,
  TrendingDown,
} from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageTabs } from '@/components/common/page-tabs';
import { itemTabs } from '@/components/layout/page-heads';
import { PageShell } from '@/components/layout/page-shell';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { Button } from '@/components/ui/button';
import { StateNotice } from '@/components/common/state-notice';
import { setItemSuspendedAction } from '@/app/actions';
import { toastResult } from '@/lib/core/action-toast';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { EnrichmentCard } from '@/components/features/resources/enrichment-card';
import { InfoTooltip } from '@/components/common/info-tooltip';
import { SpokenLine } from '@/components/common/spoken-line';
import { StarButton } from '@/components/common/star-button';
import { ForgettingCurve } from '@/components/features/resources/item-forgetting-curve';
import { ReviewLog } from '@/components/features/resources/item-review-log';
import { useSessionState } from '@/components/common/use-session-state';
import { parseEnrichment } from '@/lib/library/enrichment';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { formatDateVN, formatDueExact, humanizeUntil, speakable } from '@/lib/core/format';
import { cn } from '@/lib/core/utils';
import { STATE_LABELS } from '@/lib/srs/constants';
import type { ItemStats } from '@/lib/insights/item-stats';

const STATE_TONE: Record<number, string> = {
  0: 'text-info',
  1: 'text-warn',
  2: 'text-accent-brand',
  3: 'text-alert',
};

function pct(r: number): string {
  return `${Math.round(r * 100)}%`;
}

function Fact({
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
    <div className="flex min-w-0 flex-col gap-1 rounded-sm bg-muted/70 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{label}</span>
        {hint && <InfoTooltip label={`Về ${label}`}>{hint}</InfoTooltip>}
      </dt>
      <dd className="min-w-0">
        <div className="truncate text-base font-bold tabular-nums">{value}</div>
        <div className="truncate text-xs text-muted-foreground">{sub ?? '\u00a0'}</div>
      </dd>
    </div>
  );
}

export function ItemAnalytics({
  stats,
  groupsSlot,
  shareSlot,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  stats: ItemStats;
  groupsSlot?: ReactNode;
  /** "Chia sẻ" to the shared library, the last header action (phase 8, L3). */
  shareSlot?: ReactNode;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
  const tabSet = itemTabs(stats.kind);
  const [tab, setTab] = useSessionState(tabSet.storeKey, tabSet.initial);
  const [resuming, startResume] = useTransition();
  const { srs } = stats;
  const stateLabel = stats.suspended ? 'Tạm ngưng' : (STATE_LABELS[srs?.state ?? 0] ?? 'Mới');
  const scheduled = srs && srs.state !== 0 && !stats.suspended;

  const lastReview = srs?.lastReview ? new Date(srs.lastReview) : null;
  const dueDate = srs ? new Date(srs.due) : null;
  const dayMs = 86_400_000;
  const nowDay = stats.nowDay ?? -1;
  const dueDay = lastReview && dueDate ? (dueDate.getTime() - lastReview.getTime()) / dayMs : 0;
  const correctRate = stats.reviewCount ? stats.correctCount / stats.reviewCount : null;

  const enrichment = parseEnrichment(stats.enrichment);
  const isVocab = stats.kind === 'vocab';
  const missing = [
    !enrichment &&
      (isVocab
        ? 'thẻ chi tiết (nghĩa, cụm hay đi kèm, đồng nghĩa/trái nghĩa, ví dụ)'
        : 'thẻ chi tiết (cách dùng, ví dụ, bẫy, phân biệt)'),
    enrichment && enrichment.pitfalls.length === 0 && 'bẫy hay gặp',
    enrichment &&
      isVocab &&
      enrichment.synonyms.length + enrichment.antonyms.length === 0 &&
      'từ đồng nghĩa / trái nghĩa',
  ].filter(Boolean) as string[];

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <PageShell
        template="detail"
        breadcrumb={<ParentCrumbs section={stats.kind} self />}
        title={
          <SpokenLine
            text={stats.expression}
            speakText={speakable(stats.expression)}
            speaker={voiceSpeaker}
            rate={speechRate}
            label={stats.kind === 'grammar' ? 'Nghe mẫu' : 'Nghe từ'}
            title
            className="font-extrabold"
            aside={
              // The reading sits beside the title on its baseline, never as ruby above it: ruby would press on the trail.
              showFurigana &&
              stats.reading &&
              stats.reading !== stats.expression && (
                <span className="ml-2 text-sm font-medium text-muted-foreground">
                  [{stats.reading}]
                </span>
              )
            }
          />
        }
        subtitle={
          <>
            <p>{stats.meaningVi}</p>
            {/* Hán Việt is always upper case, in brackets on its own line under the meaning, as a
                dictionary prints it (thien, item detail round 2). */}
            {stats.kind === 'vocab' && stats.hanviet && (
              <p className="text-sm font-medium text-muted-foreground uppercase">
                <span className="sr-only">Âm Hán Việt: </span>[{stats.hanviet}]
              </p>
            )}
          </>
        }
        facts={[
          { label: 'Cấp độ', value: stats.level },
          {
            label: 'Trạng thái',
            value: stats.suspended ? (
              <>
                <Pause aria-hidden />
                Tạm ngưng
              </>
            ) : (
              stateLabel
            ),
            tone: stats.suspended ? 'text-muted-foreground' : STATE_TONE[srs?.state ?? 0],
          },
        ]}
        actions={
          <>
            <CopyCommandButton
              command={`luyện tập trung mẫu ${stats.expression}`}
              label="Luyện riêng"
              size="default"
              icon={Target}
            />
            {missing.length > 0 && (
              <CopyCommandButton
                command={`bổ sung ${missing.join(' và ')} cho mẫu ${stats.expression}`}
                label="Nhờ bổ sung"
                size="default"
                icon={Sparkles}
              />
            )}
            {shareSlot}
          </>
        }
        pageIcons={<StarButton id={stats.itemId} starred={stats.starred} kind="item" />}
        tabs={<PageTabs items={tabSet.items} label={tabSet.label} />}
      >
        {stats.suspended && (
          <StateNotice
            icon={Pause}
            title="Đang tạm ngưng"
            action={
              <Button
                variant="outline"
                disabled={resuming}
                onClick={() =>
                  startResume(async () => {
                    const r = await setItemSuspendedAction(stats.itemId, false);
                    toastResult(r, 'Đã cho học lại');
                  })
                }
              >
                <Play aria-hidden />
                Học lại
              </Button>
            }
          >
            Không vào lịch ôn cho tới khi học lại.
          </StateNotice>
        )}
        {/* A suspended item's numbers are faded and grey under the notice, so the page reads as
            paused before any word is read. */}
        <div className={cn('@container min-w-0', stats.suspended && 'opacity-55 saturate-0')}>
          <TabsContent value="stats" className="space-y-6 md:space-y-8">
            <section className="space-y-3">
              <h2 className="text-sm font-bold">Thông tin</h2>
              <dl className="grid auto-rows-fr grid-cols-2 gap-2 @2xl:grid-cols-4 @2xl:gap-3">
                <Fact
                  icon={Brain}
                  label="Xác suất nhớ"
                  value={stats.retrievability != null ? pct(stats.retrievability) : '—'}
                  sub={stats.retrievability != null ? 'ngay bây giờ' : 'chưa ôn lần nào'}
                  hint="Khả năng bạn còn nhớ mục này NGAY BÂY GIỜ, theo đường cong quên của FSRS. Càng gần đến hạn thì càng giảm."
                />
                <Fact
                  icon={Gauge}
                  label="Độ bền trí nhớ"
                  value={srs ? `${srs.stability.toFixed(1)}` : '—'}
                  sub="ngày"
                  hint="Trí nhớ bền tới đâu: số ngày ước tính để xác suất nhớ rơi về mức mong muốn. Càng cao càng nhớ lâu, khoảng ôn càng giãn."
                />
                <Fact
                  icon={TrendingDown}
                  label="Độ khó"
                  value={srs ? `${srs.difficulty.toFixed(1)}` : '—'}
                  sub="trên thang 10"
                  hint="Mục này khó với bạn tới đâu (1 dễ – 10 khó). Càng khó, FSRS xếp ôn càng dày."
                />
                <Fact
                  icon={CalendarClock}
                  label="Đến hạn"
                  value={scheduled && dueDate ? <span>{humanizeUntil(dueDate)}</span> : '—'}
                  sub={scheduled && dueDate ? formatDueExact(dueDate) : 'chưa lên lịch'}
                  hint="Khi nào mục này nên được ôn lại. Đến hạn = xác suất nhớ đã rơi về mức mong muốn."
                />
                <Fact
                  icon={Repeat}
                  label="Đã ôn"
                  value={srs?.reps ?? 0}
                  sub="lần"
                  hint="Tổng số lần mục này được lên lịch ôn (đóng vai trò chính trong câu)."
                />
                <Fact
                  icon={Target}
                  label="Tỉ lệ đúng"
                  value={correctRate != null ? pct(correctRate) : '—'}
                  sub={
                    stats.reviewCount ? `${stats.correctCount}/${stats.reviewCount} lần` : 'chưa có'
                  }
                  hint="Số lần bạn làm ĐÚNG (Good/Easy) trên tổng số lần ôn — gồm cả khi mục xuất hiện phụ trong câu."
                />
                <Fact
                  icon={TrendingDown}
                  label="Số lần quên"
                  value={srs?.lapses ?? 0}
                  sub="lần sai khi đang ôn"
                  hint="Số lần bạn quên (chọn Again) khi mục đã vào giai đoạn ôn tập. Quên nhiều → mục sẽ vào 'Luyện điểm yếu'."
                />
                <Fact
                  icon={CalendarPlus}
                  label="Ngày thêm"
                  value={<span>{formatDateVN(stats.createdAt)}</span>}
                  sub={
                    stats.firstReviewedAt
                      ? `ôn lần đầu ${formatDateVN(stats.firstReviewedAt)}`
                      : 'chưa ôn'
                  }
                />
              </dl>
            </section>
            {groupsSlot && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold">Nhóm</h2>
                {/* The slot is a server element: as a sibling in a static list React's dev check
                      sees it unkeyed, so it gets a box of its own. */}
                <div>{groupsSlot}</div>
              </section>
            )}
            {stats.forgettingCurve.length > 0 && dueDate && lastReview && (
              <section className="space-y-3">
                <h2 className="text-sm font-bold">Đường cong quên</h2>
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

            <section className="space-y-3">
              <h2 className="text-sm font-bold">
                Lịch sử ôn{' '}
                <span className="text-xs font-normal text-muted-foreground">
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
            <EnrichmentCard
              raw={stats.enrichment}
              kind={isVocab ? VOCAB_KIND : GRAMMAR_KIND}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
              contrastLinks={stats.contrastLinks}
              storedExample={isVocab ? stats.notes : null}
              layout="sections"
            />
          </TabsContent>
        </div>
      </PageShell>
    </Tabs>
  );
}
