import Link from 'next/link';
import { Network } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { KanjiEntry } from '@/lib/kanji/catalog';

// One kanji in a dialog (KJ2, KJ5): Hán Việt and meaning, then its level, strokes, readings,
// radical and parts. Tài nguyên › Kanji and Kho chung's kanji groups open it from a tile; it links to
// the kanji's own page with its component network (KJ6).

/** The kanji's page: its strokes, facts and component network (KJ6). */
export const kanjiHref = (kanji: string) => `/resources/kanji/${encodeURIComponent(kanji)}`;

/** Level, strokes, readings, radical and parts as a two-column list. */
export function KanjiFacts({ kanji: k }: { kanji: KanjiEntry }) {
  const rows: { label: string; value: string; ja?: boolean; href?: string }[] = [
    { label: 'Cấp', value: k.level ?? 'Ngoài JLPT' },
    { label: 'Số nét', value: String(k.strokes) },
    { label: 'Âm On', value: k.on.join('、'), ja: true },
    { label: 'Âm Kun', value: k.kun.join('、'), ja: true },
    {
      label: 'Bộ',
      value: `${k.radical.radical} ${k.radical.nameVi} (bộ số ${k.radical.number})`,
      href: `/resources/radicals/${k.radical.number}`,
    },
    { label: 'Thành phần', value: k.parts.join(' + '), ja: true },
    { label: 'Phần chỉ âm', value: k.phon ?? '', ja: true },
  ].filter((r) => r.value);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd lang={r.ja ? 'ja' : undefined} className="min-w-0 break-words">
            {r.href ? (
              <Link href={r.href} className="underline underline-offset-4 hover:text-accent-brand">
                {r.value}
              </Link>
            ) : (
              r.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function KanjiDetail({ kanji: k }: { kanji: KanjiEntry }) {
  return (
    <>
      <DialogHeader className="items-center text-center sm:items-center sm:text-center">
        <DialogTitle className="flex flex-col items-center gap-2">
          <span lang="ja" className="text-6xl leading-none font-normal">
            {k.kanji}
          </span>{' '}
          <span>[{k.hanviet}]</span>
        </DialogTitle>
        <DialogDescription>{k.meaningVi || 'Chưa có nghĩa tiếng Việt.'}</DialogDescription>
      </DialogHeader>
      <KanjiFacts kanji={k} />
      <ButtonLink href={kanjiHref(k.kanji)} variant="outline">
        <Network aria-hidden />
        Mạng lưới thành phần
      </ButtonLink>
    </>
  );
}
