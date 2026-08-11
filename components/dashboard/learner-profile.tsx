import Link from 'next/link';
import { ArrowRight, Quote } from 'lucide-react';

import { SpokenLine } from '@/components/shared/spoken-line';
import { Badge } from '@/components/ui/badge';
import { ERROR_TAG_LABELS } from '@/lib/error-tags';
import { APP_TIME_ZONE } from '@/lib/format';
import type { Dossier, TrendDirection } from '@/lib/dossier';
import type { AssertedNoteWithEvidence } from '@/lib/learner-notes';
import { furiganaInApp, type FuriganaMode } from '@/lib/settings-schema';
import { cn } from '@/lib/utils';

/**
 * "What does this app believe about me, and can I argue with it?" — the learner-facing half of the
 * student model (`lib/dossier.ts` + `lib/learner-notes.ts`, plan step 5.6).
 *
 * Why it exists at all. Until this shipped, the app derived a picture of the learner and handed it
 * only to Claude; the person it described could not see it. That is fine for a counter and wrong for
 * a claim — the asserted notes were accepted specifically because they are FALSIFIABLE, and a claim
 * nobody can read cannot be falsified. So the note is printed WITH the sentence that produced it, one
 * clamped line each (playable when that sentence is Japanese), plus a link into /history filtered to
 * exactly that sentence.
 *
 * It is an ADDED section, not a rearrangement of the weakness area beside it. That area answers
 * "which patterns am I weak on"; this answers "what has the app concluded about me". Nothing that was
 * already on this page moved.
 */

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

/** A labelled block inside the section — same rhythm as `WeakList` on the dashboard. */
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
  // Each fact is a whole short sentence rather than a number with a caption: "cần khoảng 3 lần gặp"
  // is something the learner can agree or disagree with; "3" next to a label is a score.
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
  // An empty model must LOOK empty — a heading over nothing reads as "the app knows something it is
  // not telling you", which is the opposite of the point.
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
                {/* Dense summary row, like the weakness badges beside it — see the playable-rule
                    audit in components/_INDEX.md. A play button per token would drown the line. */}
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
                    {/* A JA_VI source IS Japanese, so it gets the full treatment (audio + karaoke +
                        furigana) — invariant #9 makes no exception for a citation, and the gate
                        refused the first version that printed it as dead text. A VI_JA source is
                        Vietnamese and stays plain; a Japanese voice reading it would be nonsense. */}
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
                    // One link per NOTE rather than one per quote: a link wrapping a SpokenLine would
                    // nest a button inside an anchor, and clicking would both play and navigate.
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
