'use client';

import Link from 'next/link';
import { ArrowUpRight, Info, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EnrichmentCard } from '@/components/resources/enrichment-card';
import { SectionTag } from '@/components/shared/section-tag';
import { SpokenLine } from '@/components/shared/spoken-line';
import { parseEnrichment } from '@/lib/enrichment';
import { GRAMMAR_KIND, VOCAB_KIND } from '@/lib/item-kinds';
import { humanizeUntil, speakable } from '@/lib/format';
import { buildFuriganaMarkup } from '@/lib/furigana';
import { hasKanji } from '@/lib/text';
import { STATE_LABELS } from '@/lib/srs-constants';

export interface DetailItem {
  expression: string;
  reading: string | null;
  /** âm Hán Việt (Sino-Vietnamese) — vocab only, Claude-filled. */
  hanviet?: string | null;
  meaningVi: string;
  notes: string | null;
  level?: string;
  enrichment?: string | null;
  suspended: boolean;
  srs: { state: number; due: string | Date; reps?: number; lapses?: number } | null;
}

/**
 * Full detail of a grammar pattern / vocab word — opened by clicking the term in the resources table.
 * FSRS status + (grammar) the enrichment card (shared `<EnrichmentCard>`, collapsible) + (vocab) âm
 * Hán Việt + example. Read-only; editing lives in the ⋮ row menu. The kana reading is only shown when
 * the term actually contains kanji (a kana-only pattern's "reading" repeats itself).
 */
export function ItemDetailDialog({
  item,
  kind,
  readingOnTop = false,
  triggerVariant = 'text',
  showSrs = true,
  detailHref,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
}: {
  item: DetailItem;
  kind: 'grammar' | 'vocab';
  /** TTS settings, threaded from the table so every Japanese line inside can be played. */
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
  /** When set, the modal shows a "Mở trang chi tiết" link to the item's own page (e.g.
   * `/resources/<id>`). Omit for items with no detail page for the viewer (others' /library items). */
  detailHref?: string;
  /** Show the kana reading as furigana <ruby> ABOVE the expression (text trigger only). */
  readingOnTop?: boolean;
  /** 'text' = the term itself opens the dialog. 'icon' = a small info/enrichment icon opens it, so the
   * term can be a separate <SpokenLine> (audio + karaoke + furigana) — used in the resources tables. */
  triggerVariant?: 'text' | 'icon';
  /** Show the FSRS status box. Off for /library items the viewer doesn't own (they have no schedule). */
  showSrs?: boolean;
}) {
  const enrichment = kind === 'grammar' ? parseEnrichment(item.enrichment) : null;
  const stateLabel = item.suspended ? 'Tạm ngưng' : (STATE_LABELS[item.srs?.state ?? 0] ?? 'Mới');
  const showReading = !!item.reading && hasKanji(item.expression);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {triggerVariant === 'icon' ? (
          <button
            type="button"
            aria-label="Xem nhanh"
            title={enrichment ? 'Xem nhanh (có thẻ enrichment)' : 'Xem nhanh'}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {enrichment ? (
              <Sparkles className="size-3.5 text-accent-brand" aria-hidden />
            ) : (
              <Info className="size-3.5" aria-hidden />
            )}
          </button>
        ) : (
          <button
            type="button"
            className="flex max-w-full items-center gap-1.5 text-left font-medium hover:text-accent-brand hover:underline"
          >
            {readingOnTop && showReading ? (
              <ruby lang="ja" className="leading-tight">
                {item.expression}
                <rt className="text-xs font-normal text-muted-foreground">{item.reading}</rt>
              </ruby>
            ) : (
              <span lang="ja" className="min-w-0 truncate">
                {item.expression}
              </span>
            )}
            {enrichment && <Sparkles className="size-3.5 shrink-0 text-accent-brand" aria-hidden />}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {/* Playable here too: the modal is the quick-look surface, so hearing the term should not
                require opening the full page. Ruby comes from the stored reading when it has kanji. */}
            <SpokenLine
              text={item.expression}
              speakText={speakable(item.expression)}
              ruby={buildFuriganaMarkup(item.expression, item.reading)}
              showFurigana={showFurigana}
              speaker={voiceSpeaker}
              rate={speechRate}
              label={kind === 'grammar' ? 'Nghe mẫu' : 'Nghe từ'}
            />
            {showReading && !showFurigana && (
              <span className="text-base font-normal text-muted-foreground">
                （{item.reading}）
              </span>
            )}
            {item.level && <Badge variant="outline">{item.level}</Badge>}
          </DialogTitle>
          <DialogDescription>{item.meaningVi}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          {/* âm Hán Việt (vocab) */}
          {kind === 'vocab' && item.hanviet && (
            <section className="space-y-1">
              <SectionTag>Âm Hán Việt</SectionTag>
              <p className="font-medium capitalize">{item.hanviet}</p>
            </section>
          )}

          {/* FSRS status — reading-only, never editable */}
          {showSrs && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-border/70 p-3 text-xs text-muted-foreground">
              <span>
                Trạng thái: <span className="font-medium text-foreground">{stateLabel}</span>
              </span>
              {item.srs && item.srs.state !== 0 && !item.suspended && (
                <span>
                  Đến hạn:{' '}
                  <span className="font-medium text-foreground">
                    {humanizeUntil(new Date(item.srs.due))}
                  </span>
                </span>
              )}
              {item.srs?.reps != null && (
                <span>
                  Đã ôn: <span className="font-medium text-foreground">{item.srs.reps}</span> lần
                </span>
              )}
              {item.srs?.lapses != null && item.srs.lapses > 0 && (
                <span>
                  Quên: <span className="font-medium text-foreground">{item.srs.lapses}</span> lần
                </span>
              )}
            </div>
          )}

          {/* The stored example sentence (`notes`) is a VOCAB-only field of the Item row, so it stays
              vocab-only — but the CARD is rendered for both kinds now. Until 2026-08-12 this was
              `kind === 'grammar' && …`, which meant a word's synonyms/collocations/examples existed in
              the DB and appeared on no screen. */}
          {kind === 'vocab' && item.notes && (
            <section className="space-y-1">
              <SectionTag>Ví dụ</SectionTag>
              {/* The stored example sentence carries no ruby markup of its own — it is plain text
                  Claude sent with the word — so this plays but shows no furigana. */}
              <SpokenLine
                text={item.notes}
                showFurigana={showFurigana}
                speaker={voiceSpeaker}
                rate={speechRate}
                label="Nghe ví dụ"
              />
            </section>
          )}

          <EnrichmentCard
            raw={item.enrichment}
            kind={kind === 'vocab' ? VOCAB_KIND : GRAMMAR_KIND}
            voiceSpeaker={voiceSpeaker}
            speechRate={speechRate}
            showFurigana={showFurigana}
          />
        </div>

        {detailHref && (
          <div className="flex justify-end border-t border-border/60 pt-3">
            <Button asChild variant="outline" size="sm">
              <Link href={detailHref}>
                <ArrowUpRight className="size-4" aria-hidden />
                Mở trang chi tiết
              </Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
