'use client';

import { type ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/empty-state';
import { SectionTag } from '@/components/common/section-tag';
import { SpokenLine } from '@/components/common/spoken-line';
import { useSessionState } from '@/components/common/use-session-state';
import Link from 'next/link';
import { parseEnrichment } from '@/lib/library/enrichment';
import {
  EnrichmentSections,
  RelationList,
} from '@/components/features/resources/enrichment-sections';
import { needsWork, scoreEnrichment, TIER_LABELS } from '@/lib/library/enrichment-quality';
import { VOCAB_KIND, type ItemKind } from '@/lib/library/item-kinds';
import type { ContrastLink } from '@/lib/insights/item-stats';
import { cn } from '@/lib/core/utils';

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
  kind,
  className,
  voiceSpeaker,
  speechRate,
  showFurigana = false,
  contrastLinks = [],
  persist = false,
  storedExample = null,
  layout = 'accordion',
}: {
  raw: string | null | undefined;
  kind: ItemKind;
  className?: string;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana?: boolean;
  contrastLinks?: ContrastLink[];
  persist?: boolean;
  storedExample?: string | null;
  /** `sections`: the item page's open layout; the accordion fits dialogs and narrow places. */
  layout?: 'accordion' | 'sections';
}) {
  const [stored, setStored] = useSessionState<string[] | null>('enrichment.open', null);
  const isVocabCard = kind === VOCAB_KIND;
  const enrichment = parseEnrichment(raw);
  if (!enrichment) {
    return (
      <div className={cn('w-full', className)}>
        {storedExample && (
          <section className="space-y-1 px-1 pb-3 text-sm">
            <p className="text-xs text-muted-foreground">Ví dụ</p>
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
          Chưa có thẻ chi tiết. Trong Claude Desktop hoặc ChatGPT chạy prompt{' '}
          <code>enrich_backlog</code> để trợ lý MCP soạn{' '}
          {isVocabCard
            ? 'nghĩa, cụm hay đi kèm, từ đồng nghĩa/trái nghĩa, ví dụ'
            : 'cấu trúc, ví dụ, bẫy'}
          … cho {isVocabCard ? 'từ' : 'mẫu'} này.
        </EmptyState>
      </div>
    );
  }

  const cardExamples = [enrichment.example, ...enrichment.examples];
  const exampleList =
    storedExample && !cardExamples.some((ex) => ex.ja === storedExample)
      ? [...cardExamples, { ja: storedExample, vi: '', jaRuby: undefined }]
      : cardExamples;

  if (layout === 'sections')
    return (
      <EnrichmentSections
        enrichment={enrichment}
        examples={exampleList}
        isVocab={isVocabCard}
        contrastLinks={contrastLinks}
        voiceSpeaker={voiceSpeaker}
        speechRate={speechRate}
        showFurigana={showFurigana}
        className={className}
      />
    );

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

  const accordionProps = persist
    ? { value: stored ?? open, onValueChange: setStored }
    : { defaultValue: open };

  const report = scoreEnrichment(raw, kind);

  return (
    <div className={cn('w-full', className)}>
      {needsWork(report.tier) && (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-1 pb-2 text-xs text-muted-foreground">
          <span className="font-medium text-warn">{TIER_LABELS[report.tier]}</span>
          {report.missing.length > 0 && <span>thiếu: {report.missing.join(', ')}</span>}
          <span className="text-muted-foreground/70">
            — nhờ trợ lý MCP bổ sung (nó chỉ thêm phần thiếu, không ghi đè phần đang có)
          </span>
        </p>
      )}
      <Accordion type="multiple" {...accordionProps} className="w-full">
        {enrichment.structure.length > 0 && (
          <Section
            value="structure"
            title={isVocabCard ? 'Loại từ / khung câu' : 'Cấu trúc / cách chia'}
          >
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
