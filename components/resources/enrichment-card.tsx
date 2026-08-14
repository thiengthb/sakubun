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
import { SectionTag } from '@/components/shared/section-tag';
import { SpokenLine } from '@/components/shared/spoken-line';
import { useSessionState } from '@/components/shared/use-session-state';
import Link from 'next/link';
import { parseEnrichment, type Related } from '@/lib/enrichment';
import { needsWork, scoreEnrichment, TIER_LABELS } from '@/lib/enrichment-quality';
import { VOCAB_KIND, type ItemKind } from '@/lib/item-kinds';
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

/**
 * A synonym/antonym list. Every Japanese term goes through `<SpokenLine>` — the repo-wide rule for any
 * Japanese string a learner reads — which also gets furigana for free: `term` + `reading` is exactly the
 * 漢字[かな] markup SpokenLine already parses.
 *
 * A term that is ITSELF in the library links to its own page, reusing the `contrastLinks` table the
 * detail page already resolves. That is what turns "read a word card" into walking a graph of words.
 */
function RelationList({
  entries,
  links,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  entries: Related[];
  links: ContrastLink[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  return (
    <ul className="space-y-2">
      {entries.map((r) => {
        const link = links.find((l) => l.expression === r.term);
        // Only when the reading ADDS something: a kana-only word repeating itself as ruby is noise.
        const ruby = r.reading && r.reading !== r.term ? `${r.term}[${r.reading}]` : undefined;
        return (
          <li key={r.term} className="space-y-0.5">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <SpokenLine
                text={r.term}
                ruby={ruby}
                showFurigana={showFurigana}
                speaker={voiceSpeaker}
                rate={speechRate}
                label={`Nghe từ ${r.term}`}
              />
              <span className="text-muted-foreground">{r.vi}</span>
              {link && (
                <Link
                  href={`/resources/${link.itemId}`}
                  className="text-xs text-accent-brand underline-offset-2 hover:underline"
                >
                  trong kho
                </Link>
              )}
            </div>
            {r.note && <p className="text-muted-foreground">{r.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}

export function EnrichmentCard({
  raw,
  kind,
  className,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
  contrastLinks = [],
  persist = false,
  storedExample = null,
}: {
  raw: string | null | undefined;
  /**
   * GRAMMAR or VOCAB. Required, not defaulted: it decides which completeness bar the quality line
   * reports against, and what the first section is called. A default would silently score every word
   * card as a grammar card — the bug lib/enrichment-quality.ts was split by kind to end.
   */
  kind: ItemKind;
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
  /**
   * `Item.notes` — for VOCAB that field holds the example sentence stored with the word when it was
   * added (`item-edit-form.tsx` labels it «Ví dụ» for this kind).
   *
   * It belongs INSIDE this card's examples list, not beside it. Both callers used to render it as
   * their own «Ví dụ» section directly above the card, and the card then rendered a second «Ví dụ»
   * of its own — two headings with the same name, stacked, on the detail page AND in the peek dialog.
   * Not a rendering bug: two data sources (the Item row vs the enrichment card, which only arrived on
   * 2026-08-12) that were never reconciled after the second one appeared.
   */
  storedExample?: string | null;
}) {
  // Hook runs unconditionally (before the null-guard return) to satisfy rules-of-hooks. Shared key so
  // collapsing a section stays collapsed as you move between item detail pages — a "sticky" accordion,
  // mirroring the sticky `item.tab`. Unknown values (a section absent on another item) are ignored.
  const [stored, setStored] = useSessionState<string[] | null>('enrichment.open', null);
  const isVocabCard = kind === VOCAB_KIND;
  const enrichment = parseEnrichment(raw);
  if (!enrichment) {
    // No card — but the stored sentence must still surface, or moving it in here would DELETE it from
    // the screen for exactly the items that have the least content. It keeps its own heading in this
    // branch, and that is still only ONE «Ví dụ» on the page because the card's is not rendered.
    return (
      <div className={cn('w-full', className)}>
        {storedExample && (
          <section className="space-y-1 px-1 pb-3 text-sm">
            <p className="text-xs text-muted-foreground">Ví dụ</p>
            {/* `ruby={undefined}` viết TƯỜNG MINH, không phải bỏ quên: câu lưu trên `Item` không có
                cột ruby nào để lấy. Luật khoá `japanese-three-signals` tồn tại để bắt trường hợp
                QUÊN truyền `ruby`, và cách phân biệt "quên" với "không có" là nói ra. */}
            <SpokenLine
              text={storedExample}
              ruby={undefined}
              showFurigana={showFurigana}
              speaker={voiceSpeaker}
              rate={speechRate}
              label="Nghe ví dụ"
            />
          </section>
        )}
        <EmptyState icon={null} className="p-4">
          Chưa có thẻ chi tiết. Trong Claude Desktop chạy prompt <code>enrich_backlog</code> để Claude
          soạn{' '}
          {isVocabCard ? 'nghĩa, cụm hay đi kèm, từ đồng nghĩa/trái nghĩa, ví dụ' : 'cấu trúc, ví dụ, bẫy'}
          … cho {isVocabCard ? 'từ' : 'mẫu'} này.
        </EmptyState>
      </div>
    );
  }

  // ONE list, so there is ONE «Ví dụ» and one render path (issue #47).
  //
  // The stored sentence goes LAST — the card's own examples lead because they are richer (they carry
  // `vi`, and `jaRuby` since 2026-07-20). Deduped on the Japanese text: a word that was added and
  // later enriched often ends up with the same sentence in both places, and printing it twice inside
  // one section would be the same defect one level down.
  const cardExamples = [enrichment.example, ...enrichment.examples];
  const exampleList =
    storedExample && !cardExamples.some((ex) => ex.ja === storedExample)
      ? [...cardExamples, { ja: storedExample, vi: '', jaRuby: undefined }]
      : cardExamples;

  // Every present section opens by default (accordion is still collapsible per-section).
  const open = [
    enrichment.structure.length > 0 && 'structure',
    'usage',
    'examples',
    enrichment.collocations.length > 0 && 'collocations',
    enrichment.synonyms.length > 0 && 'synonyms',
    enrichment.antonyms.length > 0 && 'antonyms',
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
  const report = scoreEnrichment(raw, kind);

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
          <Section
            value="structure"
            // A word has no conjugation TABLE to show; what belongs here for vocabulary is the word
            // class + the frame it takes (自動詞/他動詞, 名詞 + する, 〜に〜を).
            title={isVocabCard ? 'Loại từ / khung câu' : 'Cấu trúc / cách chia'}
          >
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
            {exampleList.map((ex, i) => (
              <li key={`${ex.ja}-${i}`} className="space-y-0.5">
                {/* `jaRuby` is absent on every card enriched before 2026-07-20 — SpokenLine then just
                  renders the plain sentence, so the play button still works and only the furigana
                  is missing. The library fills in as items are re-enriched. The stored sentence is
                  permanently in that state (the Item row has no ruby column), which is why it goes
                  through this SAME render path instead of a second one: one path means one place
                  where `ruby` can be forgotten, and `lib/ui-pattern-lock.test.ts` guards that place. */}
                <SpokenLine
                  text={ex.ja}
                  ruby={ex.jaRuby}
                  showFurigana={showFurigana}
                  speaker={voiceSpeaker}
                  rate={speechRate}
                  label="Nghe ví dụ"
                />
                {ex.vi ? (
                  <p className="text-muted-foreground">{ex.vi}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">câu lưu cùng từ khi thêm vào kho</p>
                )}
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

        {enrichment.synonyms.length > 0 && (
          <Section value="synonyms" title="Từ đồng nghĩa">
            <RelationList
              entries={enrichment.synonyms}
              links={contrastLinks}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
            />
          </Section>
        )}

        {enrichment.antonyms.length > 0 && (
          <Section value="antonyms" title="Từ trái nghĩa">
            <RelationList
              entries={enrichment.antonyms}
              links={contrastLinks}
              voiceSpeaker={voiceSpeaker}
              speechRate={speechRate}
              showFurigana={showFurigana}
            />
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
