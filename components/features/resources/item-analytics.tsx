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
import { AppBreadcrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { CopyCommandButton } from '@/components/common/copy-command-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnrichmentCard } from '@/components/features/resources/enrichment-card';
import { InfoTooltip } from '@/components/common/info-tooltip';
import { SectionTag } from '@/components/common/section-tag';
import { SpokenLine } from '@/components/common/spoken-line';
import { StarButton } from '@/components/common/star-button';
import { ForgettingCurve } from '@/components/features/resources/item-forgetting-curve';
import { ReviewLog } from '@/components/features/resources/item-review-log';
import { useSessionState } from '@/components/common/use-session-state';
import { parseEnrichment } from '@/lib/library/enrichment';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/library/item-kinds';
import { formatDateVN, formatDueExact, humanizeUntil, speakable } from '@/lib/core/format';
import { buildFuriganaMarkup } from '@/lib/japanese/furigana';
import { cn } from '@/lib/core/utils';
import { STATE_LABELS } from '@/lib/srs/constants';
import type { ItemStats } from '@/lib/insights/item-stats';

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
    <Card className="gap-0.5 p-3 sm:gap-1 sm:p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{label}</span>
        {hint && <InfoTooltip label={`Về ${label}`}>{hint}</InfoTooltip>}
      </div>
      <div className="text-xl font-semibold tabular-nums sm:text-2xl">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

export function ItemAnalytics({
  stats,
  groupsSlot,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  stats: ItemStats;
  groupsSlot?: ReactNode;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
}) {
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
    >
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl leading-tight font-semibold">
              <SpokenLine
                text={stats.expression}
                speakText={speakable(stats.expression)}
                ruby={buildFuriganaMarkup(stats.expression, stats.reading)}
                showFurigana={showFurigana}
                speaker={voiceSpeaker}
                rate={speechRate}
                label={stats.kind === 'grammar' ? 'Nghe mẫu' : 'Nghe từ'}
                align="start"
              />
            </h1>
            <p className="text-body text-muted-foreground">{stats.meaningVi}</p>
          </div>
          <StarButton id={stats.itemId} starred={stats.starred} kind="item" />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-subhead text-muted-foreground">
          <Badge variant="outline">{stats.level}</Badge>
          <Badge variant="outline" className={cn(!stats.suspended && STATE_BADGE[srs?.state ?? 0])}>
            {stateLabel}
          </Badge>
          {stats.kind === 'vocab' && stats.hanviet && (
            <>
              <span aria-hidden>·</span>
              <span>
                Âm Hán Việt:{' '}
                <span className="font-medium text-foreground capitalize">{stats.hanviet}</span>
              </span>
            </>
          )}
        </div>
      </header>

      {groupsSlot && <div>{groupsSlot}</div>}

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <TabsList className="max-md:w-full">
            <TabsTrigger value="stats">Chỉ số &amp; lịch</TabsTrigger>
            <TabsTrigger value="detail">
              {stats.kind === 'grammar' ? 'Thẻ chi tiết' : 'Chi tiết từ'}
            </TabsTrigger>
          </TabsList>
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
                label="Nhờ trợ lý MCP bổ sung"
                icon={Sparkles}
                expandOnHover
              />
            )}
          </div>
        </div>

        <TabsContent value="stats" className="space-y-6">
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

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <History className="size-5 text-muted-foreground" aria-hidden />
              Lịch sử ôn
              <span className="text-subhead font-normal text-muted-foreground">
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
          {isVocab && stats.hanviet && (
            <section className="space-y-1 text-body">
              <SectionTag>Âm Hán Việt</SectionTag>
              <p className="font-medium capitalize">{stats.hanviet}</p>
            </section>
          )}

          <EnrichmentCard
            raw={stats.enrichment}
            kind={isVocab ? VOCAB_KIND : GRAMMAR_KIND}
            voiceSpeaker={voiceSpeaker}
            speechRate={speechRate}
            showFurigana={showFurigana}
            contrastLinks={stats.contrastLinks}
            storedExample={isVocab ? stats.notes : null}
            persist
          />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
