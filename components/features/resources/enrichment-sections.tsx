import { type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowLeftRight,
  BookOpen,
  Equal,
  GitCompareArrows,
  Link2,
  MessageSquareQuote,
  Mic,
  Shapes,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { IconTile } from '@/components/common/icon-tile';
import { SpokenLine } from '@/components/common/spoken-line';
import type { Enrichment, Related } from '@/lib/library/enrichment';
import type { ContrastLink } from '@/lib/insights/item-stats';
import { cn } from '@/lib/core/utils';

export function RelationList({
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

interface Block {
  id: string;
  title: string;
  icon: LucideIcon;
  warn?: boolean;
  body: ReactNode;
}

function Section({ block }: { block: Block }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2.5 text-sm font-bold">
        <IconTile icon={block.icon} tone={block.warn ? 'warn' : 'brand'} />
        {block.title}
      </h3>
      <div className="text-sm">{block.body}</div>
    </section>
  );
}

// The item page's tutor card (thien, item detail round 2, 2026-10-25): each part opens with its
// own icon tile so the parts are easy to tell apart, as in the boxed layout he liked, but without
// a box around each part, which he found heavy. Fills, not borders, mark what is inside a part.
// On a wide box the formula and usage sit beside the examples; the rest follows under one rule.
export function EnrichmentSections({
  enrichment,
  examples,
  isVocab,
  contrastLinks,
  voiceSpeaker,
  speechRate,
  showFurigana,
  className,
}: {
  enrichment: Enrichment;
  examples: { ja: string; vi: string; jaRuby?: string }[];
  isVocab: boolean;
  contrastLinks: ContrastLink[];
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
  className?: string;
}) {
  const relation = (entries: Related[]) => (
    <RelationList
      entries={entries}
      links={contrastLinks}
      voiceSpeaker={voiceSpeaker}
      speechRate={speechRate}
      showFurigana={showFurigana}
    />
  );
  const lead: Block[] = [];
  if (enrichment.structure.length > 0)
    lead.push({
      id: 'structure',
      title: isVocab ? 'Loại từ / khung câu' : 'Công thức',
      icon: Shapes,
      body: (
        <ul className="space-y-1.5">
          {enrichment.structure.map((st) => (
            <li key={st} lang="ja" className="rounded-sm bg-muted px-3 py-1.5 text-base font-bold">
              {st}
            </li>
          ))}
        </ul>
      ),
    });
  lead.push({
    id: 'usage',
    title: 'Cách dùng',
    icon: BookOpen,
    body: <p className="text-base leading-relaxed">{enrichment.usage}</p>,
  });
  const exampleBlock: Block = {
    id: 'examples',
    title: 'Ví dụ',
    icon: MessageSquareQuote,
    body: (
      <ul className="space-y-3">
        {examples.map((ex, i) => (
          <li key={`${ex.ja}-${i}`} className="space-y-1 border-l-4 border-accent-brand/40 pl-3">
            <SpokenLine
              text={ex.ja}
              ruby={ex.jaRuby}
              showFurigana={showFurigana}
              speaker={voiceSpeaker}
              rate={speechRate}
              label="Nghe ví dụ"
              className="text-base"
            />
            {ex.vi && <p className="text-sm text-muted-foreground">{ex.vi}</p>}
          </li>
        ))}
      </ul>
    ),
  };
  const rest: Block[] = [];
  if (enrichment.collocations.length > 0)
    rest.push({
      id: 'collocations',
      title: 'Cụm hay đi kèm',
      icon: Link2,
      body: (
        <div className="flex flex-wrap gap-1.5">
          {enrichment.collocations.map((c) => (
            <Badge key={c} variant="outline" size="control" lang="ja" className="pr-2.5">
              {c}
            </Badge>
          ))}
        </div>
      ),
    });
  if (enrichment.synonyms.length > 0)
    rest.push({
      id: 'synonyms',
      title: 'Từ đồng nghĩa',
      icon: Equal,
      body: relation(enrichment.synonyms),
    });
  if (enrichment.antonyms.length > 0)
    rest.push({
      id: 'antonyms',
      title: 'Từ trái nghĩa',
      icon: ArrowLeftRight,
      body: relation(enrichment.antonyms),
    });
  if (enrichment.pitfalls.length > 0)
    rest.push({
      id: 'pitfalls',
      title: 'Bẫy hay gặp',
      icon: TriangleAlert,
      warn: true,
      body: (
        <ul className="space-y-1.5 rounded-lg bg-warn-wash px-3 py-2.5">
          {enrichment.pitfalls.map((p) => (
            <li key={p} className="flex gap-2">
              <X className="mt-0.5 size-4 shrink-0 text-alert" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      ),
    });
  if (enrichment.contrasts.length > 0)
    rest.push({
      id: 'contrasts',
      title: 'Phân biệt',
      icon: GitCompareArrows,
      body: (
        <ul className="space-y-2">
          {enrichment.contrasts.map((c) => {
            const link = contrastLinks.find((l) => l.expression === c.with);
            return (
              <li
                key={c.with}
                className="flex flex-col gap-1 @md:flex-row @md:items-baseline @md:gap-3"
              >
                {link ? (
                  <Link
                    href={`/resources/${link.itemId}`}
                    lang="ja"
                    className="shrink-0 font-bold text-accent-brand hover:underline"
                  >
                    {c.with}
                  </Link>
                ) : (
                  <span lang="ja" className="shrink-0 font-bold">
                    {c.with}
                  </span>
                )}
                <span className="text-muted-foreground">{c.note}</span>
              </li>
            );
          })}
        </ul>
      ),
    });
  if (enrichment.register)
    rest.push({
      id: 'register',
      title: 'Văn phong',
      icon: Mic,
      body: <p>{enrichment.register}</p>,
    });

  return (
    <div className={cn('@container w-full space-y-8', className)}>
      <div className="grid gap-8 @3xl:grid-cols-2 @3xl:gap-x-12">
        <div className="space-y-8">
          {lead.map((b) => (
            <Section key={b.id} block={b} />
          ))}
        </div>
        <Section block={exampleBlock} />
      </div>
      {rest.length > 0 && (
        <div className="grid gap-8 border-t border-border pt-8 @3xl:grid-cols-2 @3xl:gap-x-12">
          {rest.map((b) => (
            <Section key={b.id} block={b} />
          ))}
        </div>
      )}
    </div>
  );
}
