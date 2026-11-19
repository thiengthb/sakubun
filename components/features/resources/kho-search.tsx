'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, PenLine, X } from 'lucide-react';
import { KanjiDrawPad } from '@/components/common/kanji-draw-pad';
import { LIST_CARD } from '@/components/common/list-card';
import { SearchInput } from '@/components/common/search-input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsMobile } from '@/hooks/use-mobile';
import { SpokenLine } from '@/components/common/spoken-line';
import { STATE_LABEL } from '@/lib/library/level-screen';
import type { KhoSearch, LibraryHit, MineHit } from '@/lib/app/kho-search';
import { speakable } from '@/lib/core/format';
import { cn } from '@/lib/core/utils';
import { MARK } from './word-marks';
import { TakeWordButton } from './take-buttons';

// Kho's search (U4f, layout B that thien picked on 19/11, docs/plans/2026-11-14-u4-kho.md). The query
// lives in the address (?q=), so the server answers it and a search can be linked; while there is
// one, its results take the level board's place, the learner's own beside Kho chung's.

const WAIT_MS = 250;

export interface Voice {
  speaker?: number;
  rate?: number;
}

/**
 * The box under Kho's title, and what it searches below it (`children`: the results or the board).
 * Typing updates ?q= a moment after the last key; `query` is ?q= as is. The pen in the box opens the
 * drawing pad (KD2, docs/plans/2026-11-19-kanji-draw-search.md): on a laptop it drops down under the
 * box, over the results; on a phone it is a keyboard at the foot of the screen, over the tab bar.
 */
export function KhoSearchArea({ query, children }: { query: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const phone = useIsMobile();
  const [text, setText] = useState(query);
  const [pen, setPen] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const field = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // A key is waiting for the pause before it searches.
  const [waiting, setWaiting] = useState(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  // ?q= changed from elsewhere (the sidebar's "Kho", a link): show it. While a key is waiting or the
  // box's own search is on its way, the typed text wins, so a slow answer never undoes a key.
  if (!waiting && !pending && query.trim() !== text.trim()) setText(query);

  const go = (next: string) => {
    clearTimeout(timer.current);
    setWaiting(true);
    timer.current = setTimeout(() => {
      const q = next.trim();
      setWaiting(false);
      startTransition(() =>
        router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}` : pathname, { scroll: false }),
      );
    }, WAIT_MS);
  };
  const type = (next: string) => {
    setText(next);
    go(next);
  };

  const togglePen = () => {
    // On a phone the drawing keyboard takes the typing keyboard's place.
    if (!pen && phone) field.current?.blur();
    setPen(!pen);
  };
  // On a phone the pad has a way back to typing.
  const pad = (keyboard: boolean) => (
    <KanjiDrawPad
      onPick={(k) => type(text + k)}
      onKeyboard={
        keyboard
          ? () => {
              setPen(false);
              field.current?.focus();
            }
          : undefined
      }
    />
  );

  const penButton = (
    <Button
      variant={pen ? 'default' : 'ghost'}
      size="icon-xs"
      aria-pressed={pen}
      aria-label="Vẽ chữ kanji"
      title="Tìm bằng cách vẽ chữ kanji"
      onClick={phone ? togglePen : undefined}
      // 24px to see, 44px to touch on a phone (docs/ui-standard.md › Nút và ô).
      className="absolute top-1/2 right-1 -translate-y-1/2 max-md:after:absolute max-md:after:-inset-2.5 md:right-0.5"
    >
      <PenLine />
    </Button>
  );
  const box = (
    <div ref={boxRef} className="relative">
      <SearchInput
        ref={field}
        role="searchbox"
        enterKeyHint="search"
        value={text}
        onChange={(e) => type(e.target.value)}
        // Typing on a phone brings its own keyboard up, which the drawing one would sit under.
        onFocus={() => phone && setPen(false)}
        placeholder="Tìm trong kho và Kho chung"
        aria-label="Tìm trong kho và Kho chung"
        className="sm:max-w-none"
        inputClassName="pr-10 md:pr-8"
      />
      {pending && (
        <Loader2
          aria-label="Đang tìm"
          className="absolute top-1/2 right-10 size-4 -translate-y-1/2 animate-spin text-muted-foreground md:right-8"
        />
      )}
      {phone ? (
        penButton
      ) : (
        // On a laptop the pad drops down under the box, over the results (thien, round 2 review).
        <Popover open={pen} onOpenChange={setPen}>
          <PopoverTrigger render={penButton} />
          <PopoverContent
            anchor={boxRef}
            align="end"
            aria-label="Vẽ chữ"
            className="w-96 gap-3 p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-heading">Vẽ chữ</h2>
              <Button variant="ghost" size="icon" aria-label="Đóng khung vẽ" onClick={togglePen}>
                <X />
              </Button>
            </div>
            {pad(false)}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );

  return (
    <>
      {box}
      {children}
      {pen && phone && (
        <>
          {/* Room under the results, so the last of them can scroll up above the drawing keyboard. */}
          <div aria-hidden className="h-100 shrink-0" />
          {/* On the body, so it sits over the tab bar whatever the page's own layers are. */}
          {createPortal(
            <div
              role="region"
              aria-label="Bàn phím vẽ"
              className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-border bg-background pb-[env(safe-area-inset-bottom)]"
            >
              <div className="mx-auto max-w-md p-3">{pad(true)}</div>
            </div>,
            document.body,
          )}
        </>
      )}
    </>
  );
}

export function KhoSearchResults({ search, voice }: { search: KhoSearch; voice: Voice }) {
  const moreMine = search.mineCount - search.mine.length;
  const moreLibrary = search.libraryCount - search.library.length;
  return (
    <div className="grid items-start gap-6 md:grid-cols-2">
      <section aria-labelledby="kho-search-mine" className="min-w-0">
        <Heading id="kho-search-mine" title="Trong kho của bạn">
          {search.mineMore ? `hơn ${search.mineCount} mục` : `${search.mineCount} mục`}
        </Heading>
        {search.mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kho của bạn chưa có mục nào khớp.</p>
        ) : (
          <ul className={cn(LIST_CARD.base, 'divide-y divide-border p-0')}>
            {search.mine.map((hit) => (
              <MineRow key={hit.id} hit={hit} voice={voice} />
            ))}
          </ul>
        )}
        {moreMine > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Còn {search.mineMore ? 'nhiều' : moreMine} mục khác: gõ thêm chữ để thu hẹp.
          </p>
        )}
      </section>
      <section aria-labelledby="kho-search-library" className="min-w-0">
        <Heading id="kho-search-library" title="Trong Kho chung">
          {`${search.libraryCount} mục chưa có trong kho`}
        </Heading>
        {search.library.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Kho chung không còn mục nào khớp mà bạn chưa có.
          </p>
        ) : (
          <ul className={cn(LIST_CARD.base, 'divide-y divide-border p-0')}>
            {search.library.map((hit) => (
              <LibraryRow key={hit.id} hit={hit} voice={voice} />
            ))}
          </ul>
        )}
        {moreLibrary > 0 && (
          <Link
            href={search.libraryHref}
            className="mt-2 inline-block text-sm text-accent-brand hover:underline"
          >
            Xem thêm {moreLibrary} mục ở Kho chung
          </Link>
        )}
      </section>
    </div>
  );
}

function Heading({ id, title, children }: { id: string; title: string; children: string }) {
  return (
    <h2 id={id} className="mb-2 flex items-baseline gap-2 text-heading">
      {title}
      <span className="text-sm font-normal text-muted-foreground">{children}</span>
    </h2>
  );
}

function Row({
  href,
  hit,
  voice,
  children,
}: {
  href: string;
  hit: MineHit | LibraryHit;
  voice: Voice;
  children: React.ReactNode;
}) {
  return (
    <li className={cn('relative flex min-h-11 items-center gap-3 px-4 py-2.5', LIST_CARD.linked)}>
      <Link href={href} aria-label={`Mở ${hit.expression}`} className={LIST_CARD.link} />
      <span className="flex min-w-0 flex-1 flex-col">
        <SpokenLine
          text={hit.expression}
          speakText={speakable(hit.expression)}
          speaker={voice.speaker}
          rate={voice.rate}
          truncate
          className="font-semibold"
        />
        <span className="truncate text-sm">
          {hit.reading && (
            <span lang="ja" className="text-muted-foreground">
              {hit.reading} ·{' '}
            </span>
          )}
          {hit.meaningVi}
        </span>
      </span>
      {hit.level && <span className="shrink-0 text-xs text-muted-foreground">{hit.level}</span>}
      {children}
    </li>
  );
}

function MineRow({ hit, voice }: { hit: MineHit; voice: Voice }) {
  return (
    <Row href={`/resources/${hit.id}`} hit={hit} voice={voice}>
      <span className="inline-flex w-20 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden className={cn('size-3 rounded-xs', MARK[hit.state])} />
        <span className="first-letter:uppercase">{STATE_LABEL[hit.state]}</span>
      </span>
    </Row>
  );
}

function LibraryRow({ hit, voice }: { hit: LibraryHit; voice: Voice }) {
  return (
    <Row href={`/library/item/${hit.id}`} hit={hit} voice={voice}>
      <TakeWordButton entryId={hit.id} expression={hit.expression} className="h-8 shrink-0" />
    </Row>
  );
}
