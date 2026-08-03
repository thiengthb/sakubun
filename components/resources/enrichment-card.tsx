'use client';

import { type ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { GuideLink } from '@/components/shared/guide-link';
import { SectionTag } from '@/components/shared/section-tag';
import { SpokenLine } from '@/components/shared/spoken-line';
import { useSessionState } from '@/components/shared/use-session-state';
import Link from 'next/link';
import { parseEnrichment } from '@/lib/enrichment';
import { needsWork, scoreEnrichment, TIER_LABELS } from '@/lib/enrichment-quality';
import type { ContrastLink } from '@/lib/item-stats';
import { cn } from '@/lib/utils';

/**
 * The Claude-written usage card for a grammar pattern (structure / usage / examples / collocations /
 * pitfalls / contrasts / register). Shared by the detail page AND the peek dialog (was duplicated in
 * both — extracted 2026-07-18). Each section is a COLLAPSIBLE accordion item, all OPEN by default; the
 * section titles are bold headings with a leading themed dot (shared SectionTag) so they stand out.
 */

/**
 * One collapsible section. The title is a bold heading with a leading themed dot (shared SectionTag),
 * so the sections read as labelled blocks of a lesson — the same treatment on both consumers (peek
 * dialog + detail page) since the card is shared.
 */
function Section({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="border-border/70">
      <AccordionTrigger className="py-2 hover:no-underline">
        <SectionTag>{title}</SectionTag>
      </AccordionTrigger>
      <AccordionContent className="text-sm">{children}</AccordionContent>
    </AccordionItem>
  );
}

export function EnrichmentCard({
  raw,
  className,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
  contrastLinks = [],
  persist = false,
}: {
  raw: string | null | undefined;
  className?: string;
  /** TTS settings, threaded from the caller so examples can be played + read in sync. */
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
  /** Contrast targets that exist in the library (resolved server-side) — rendered as links. */
  contrastLinks?: ContrastLink[];
  /** Remember which sections are collapsed across navigation within the session (detail page only —
   * the peek dialog stays uncontrolled). `null` = untouched ⇒ fall back to "all open". */
  persist?: boolean;
}) {
  // Hook runs unconditionally (before the null-guard return) to satisfy rules-of-hooks. Shared key so
  // collapsing a section stays collapsed as you move between item detail pages — a "sticky" accordion,
  // mirroring the sticky `item.tab`. Unknown values (a section absent on another item) are ignored.
  const [stored, setStored] = useSessionState<string[] | null>('enrichment.open', null);
  const enrichment = parseEnrichment(raw);
  if (!enrichment) {
    return (
      <EmptyState
        icon={null}
        className="p-4"
        action={<GuideLink topic="enrichment" label="Thẻ chi tiết là gì?" />}
      >
        Chưa có thẻ chi tiết. Trong Claude Desktop chạy prompt <code>enrich_backlog</code> để Claude
        soạn cấu trúc, ví dụ, bẫy… cho mẫu này.
      </EmptyState>
    );
  }

  // Every present section opens by default (accordion is still collapsible per-section).
  const open = [
    enrichment.structure.length > 0 && 'structure',
    'usage',
    'examples',
    enrichment.collocations.length > 0 && 'collocations',
    enrichment.pitfalls.length > 0 && 'pitfalls',
    enrichment.contrasts.length > 0 && 'contrasts',
    enrichment.register && 'register',
  ].filter(Boolean) as string[];

  // Persisted (detail page): controlled by session state, seeded with "all open" until first toggled.
  // Ephemeral (peek dialog): uncontrolled, opens all every time.
  const accordionProps = persist
    ? { value: stored ?? open, onValueChange: setStored }
    : { defaultValue: open };

  // The card can be PRESENT and still not carry what the tutor reads from it. Saying so here — with the
  // parts that are absent — is what makes the web agree with `check_library`; before this the page was
  // as blind as the old `enriched: true` filter and a one-line card looked finished.
  const report = scoreEnrichment(raw);

  return (
    <div className={cn('w-full', className)}>
      {needsWork(report.tier) && (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-1 pb-2 text-xs text-muted-foreground">
          <span className="font-medium text-warn">{TIER_LABELS[report.tier]}</span>
          {report.missing.length > 0 && <span>thiếu: {report.missing.join(', ')}</span>}
          <span className="text-muted-foreground/70">
            — nhờ Claude bổ sung (nó chỉ thêm phần thiếu, không ghi đè phần đang có)
          </span>
        </p>
      )}
      <Accordion type="multiple" {...accordionProps} className="w-full">
        {enrichment.structure.length > 0 && (
          <Section value="structure" title="Cấu trúc / cách chia">
            {/* Plain lines, NOT a notation table. Bunpro's structure legend is the single most
              complained-about part of that product ("comically difficult to read", "unnecessarily
              verbose notation"), and our own data says the same from the other side: `structure` is
              empty on 190/200 cards while the attachment rule already sits at the head of `usage`.
              A notation system nobody asked for, over data that mostly is not there. */}
            <ul className="space-y-1">
              {enrichment.structure.map((s) => (
                <li key={s} lang="ja" className="rounded-md bg-muted px-2 py-1 font-medium">
                  {s}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section value="usage" title="Cách dùng">
          <p>{enrichment.usage}</p>
        </Section>

        <Section value="examples" title="Ví dụ">
          <ul className="space-y-2.5">
            {[enrichment.example, ...enrichment.examples].map((ex, i) => (
              <li key={`${ex.ja}-${i}`} className="space-y-0.5">
                {/* `jaRuby` is absent on every card enriched before 2026-07-20 — SpokenLine then just
                  renders the plain sentence, so the play button still works and only the furigana
                  is missing. The library fills in as items are re-enriched. */}
                <SpokenLine
                  text={ex.ja}
                  ruby={ex.jaRuby}
                  showFurigana={showFurigana}
                  speaker={voiceSpeaker}
                  rate={speechRate}
                  label="Nghe ví dụ"
                />
                <p className="text-muted-foreground">{ex.vi}</p>
              </li>
            ))}
          </ul>
        </Section>

        {enrichment.collocations.length > 0 && (
          <Section value="collocations" title="Cụm hay đi kèm">
            <div className="flex flex-wrap gap-1.5">
              {enrichment.collocations.map((c) => (
                <Badge key={c} variant="secondary" lang="ja">
                  {c}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        {enrichment.pitfalls.length > 0 && (
          <Section value="pitfalls" title="Bẫy hay gặp">
            <ul className="list-disc space-y-0.5 pl-5">
              {enrichment.pitfalls.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Section>
        )}

        {enrichment.contrasts.length > 0 && (
          <Section value="contrasts" title="Phân biệt">
            {/* A contrast that IS in the library links to its own lesson page, turning the store into a
              graph the learner can walk. One that is not owned stays plain text — no dead link. */}
            <ul className="space-y-1">
              {enrichment.contrasts.map((c) => {
                const link = contrastLinks.find((l) => l.expression === c.with);
                return (
                  <li key={c.with}>
                    {link ? (
                      <Link
                        href={`/resources/${link.itemId}`}
                        lang="ja"
                        className="font-medium text-accent-brand underline-offset-2 hover:underline"
                      >
                        {c.with}
                      </Link>
                    ) : (
                      <span lang="ja" className="font-medium">
                        {c.with}
                      </span>
                    )}
                    <span className="text-muted-foreground"> — {c.note}</span>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {enrichment.register && (
          <Section value="register" title="Văn phong">
            <p>{enrichment.register}</p>
          </Section>
        )}
      </Accordion>
    </div>
  );
}
