import Link from 'next/link';
import { ArrowRight, Quote } from 'lucide-react';

import { SpokenLine } from '@/components/common/spoken-line';
import { Badge } from '@/components/ui/badge';
import { ERROR_TAG_LABELS } from '@/lib/session/error-tags';
import { APP_TIME_ZONE } from '@/lib/core/format';
import type { Dossier, TrendDirection } from '@/lib/session/dossier';
import type { AssertedNoteWithEvidence } from '@/lib/session/learner-notes';
import { furiganaInApp, type FuriganaMode } from '@/lib/settings/schema';
import { cn } from '@/lib/core/utils';

const TREND_LABEL: Record<TrendDirection, string> = {
  improving: 'đang đỡ dần',
  stuck: 'chưa chuyển',
  worsening: 'đang nặng lên',
};

const TREND_CLASS: Record<TrendDirection, string> = {
  improving: 'border-ok/40 text-ok',
  stuck: 'border-border text-muted-foreground',
  worsening: 'border-alert/40 text-alert',
};

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function dateVi(d: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
  }).format(d);
}

export function LearnerProfile({
  dossier,
  notes,
  voiceSpeaker,
  speechRate,
  furiganaMode = 'app',
}: {
  dossier: Dossier;
  notes: AssertedNoteWithEvidence[];
  voiceSpeaker?: number;
  speechRate?: number;
  furiganaMode?: FuriganaMode;
}) {
  const showFurigana = furiganaInApp(furiganaMode);
  const facts: string[] = [];
  if (dossier.exposures) {
    facts.push(
      `Bạn cần khoảng ${dossier.exposures.median} lần gặp thì một mẫu mới vào nhịp ôn ` +
        `(đo trên ${dossier.exposures.sample} mẫu của chính bạn).`,
    );
  }
  if (dossier.register) {
    facts.push(
      `Văn phong lệch ở ${Math.round(dossier.register.rate * 100)}% lượt hội thoại ` +
        `(${dossier.register.turns} lượt).`,
    );
  }
  if (dossier.topics.length > 0) {
    facts.push(
      `Bạn viết tốt nhất khi chủ đề là ${dossier.topics.map((t) => t.context).join(', ')}.`,
    );
  }

  const hasAnything =
    dossier.confusions.length > 0 ||
    facts.length > 0 ||
    dossier.tagTrend.length > 0 ||
    notes.length > 0;
  if (!hasAnything) return null;

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-muted-foreground">Hồ sơ học của bạn</h2>
        <p className="text-xs text-muted-foreground">
          Claude đọc phần này trước khi ra đề. Mọi dòng ở đây đều rút ra từ chính lịch sử của bạn —
          thấy sai thì cứ nói lại với Claude.
        </p>
      </div>

      {dossier.confusions.length > 0 && (
        <Block label="Hay nhầm">
          <ul className="space-y-1">
            {dossier.confusions.map((c) => (
              <li
                key={`${c.used}-${c.required}`}
                className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
              >
                <span lang="ja" className="truncate font-medium">
                  {c.used}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span lang="ja" className="truncate font-medium">
                  {c.required}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.count} lần{c.tag ? ` · ${ERROR_TAG_LABELS[c.tag]}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {facts.length > 0 && (
        <Block label="Nhịp học của bạn">
          <ul className="space-y-1 text-muted-foreground">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Block>
      )}

      {dossier.tagTrend.length > 0 && (
        <Block label="So với 30 ngày trước">
          <div className="flex flex-wrap gap-2">
            {dossier.tagTrend.map((t) => (
              <Badge key={t.tag} variant="outline" className={cn(TREND_CLASS[t.direction])}>
                {ERROR_TAG_LABELS[t.tag]} {TREND_LABEL[t.direction]}
                <span className="ml-1 text-xs opacity-80">
                  {t.prior} → {t.recent}
                </span>
              </Badge>
            ))}
          </div>
        </Block>
      )}

      {notes.length > 0 && (
        <Block label="Claude ghi nhận">
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="min-w-0 space-y-1 border-l-2 border-border/70 pl-3">
                <p>{n.text}</p>
                {n.evidenceSentences.map((s) => (
                  <div
                    key={s.id}
                    className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <Quote className="size-3 shrink-0" aria-hidden />
                    {s.direction === 'JA_VI' ? (
                      <SpokenLine
                        text={s.sourceText}
                        ruby={s.sourceRuby}
                        showFurigana={showFurigana}
                        speaker={voiceSpeaker}
                        rate={speechRate}
                        truncate
                        className="min-w-0"
                      />
                    ) : (
                      <span className="line-clamp-1">{s.sourceText}</span>
                    )}
                  </div>
                ))}
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>Tự hết hạn {dateVi(n.expiresAt)} nếu không lặp lại.</span>
                  {n.evidenceSentences[0] && (
                    <Link
                      href={`/history?q=${encodeURIComponent(n.evidenceSentences[0].sourceText)}`}
                      className="rounded-sm text-accent-brand hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      Xem trong lịch sử
                    </Link>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </section>
  );
}
