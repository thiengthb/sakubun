'use client';

import { useEffect, useRef, useState } from 'react';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { WordCard } from '@/components/common/word-card';
import {
  LOOKUP_BATCH,
  wordPieces,
  type SentenceWord,
  type TextRun,
} from '@/lib/japanese/sentence-words';
import type { SentenceLookup } from '@/lib/japanese/sentence-lookup';
import type { WordMeaning } from '@/lib/kaiwa/lookup';

// The hover lookup on every Japanese sentence (thien, 7.4b). A page marks a sentence with
// `data-lookup` and draws it however it likes (ruby, karaoke, a cloze blank); this one layer reads
// the text the learner sees, asks the server once for the words that have a meaning, underlines
// them with the CSS Custom Highlight API (no extra DOM, nothing re-renders) and opens the word card
// when the mouse rests on one or a finger taps it (`data-lookup="hover"`: the mouse only). Text under `data-lookup-hide` (Ôn nhanh's target
// before the answer) is never looked up.

const OPEN_DELAY = 150;
const CLOSE_DELAY = 150;
const MARKED = 'word-lookup';
const ACTIVE = 'word-lookup-active';
// Readings, controls and decoration are not the sentence.
const SKIP = 'rt, rp, button, [aria-hidden="true"]';

interface Found {
  id: number;
  meaning: WordMeaning;
  surface: string;
  ranges: Range[];
}

function readSentence(el: Element) {
  const nodes: Text[] = [];
  const runs: TextRun[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    const skip = parent?.closest(SKIP);
    if (skip && el.contains(skip)) continue;
    const hide = parent?.closest('[data-lookup-hide]');
    nodes.push(n as Text);
    runs.push({ length: (n as Text).data.length, hidden: !!hide && el.contains(hide) });
  }
  return { text: nodes.map((n) => n.data).join(''), nodes, runs };
}

const supportsHighlight = () => typeof CSS !== 'undefined' && 'highlights' in CSS;

function paint(name: string, ranges: Range[]) {
  if (!supportsHighlight()) return;
  if (ranges.length === 0) CSS.highlights.delete(name);
  else CSS.highlights.set(name, new Highlight(...ranges));
}

// The same word on the page, whichever scan built it.
const same = (a: Found | null, b: Found | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.ranges[0].startContainer === b.ranges[0].startContainer &&
    a.ranges[0].startOffset === b.ranges[0].startOffset);

function hit(found: Found[] | undefined, x: number, y: number): Found | null {
  for (const f of found ?? []) {
    for (const range of f.ranges) {
      for (const r of range.getClientRects()) {
        if (x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1) return f;
      }
    }
  }
  return null;
}

export function WordLookup() {
  const [active, setActive] = useState<Found | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<Found | null>(null);
  const anchor = useRef({
    getBoundingClientRect: () =>
      activeRef.current?.ranges[0]?.getBoundingClientRect() ?? new DOMRect(),
  });

  useEffect(() => {
    // Words per sentence text: an array once the server answered, null while asked.
    const words = new Map<string, SentenceWord[] | null>();
    const meanings = new Map<string, WordMeaning>();
    let sentences = new Map<Element, Found[]>();
    let nextId = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let scanQueued = 0;
    let lastPointer = 'mouse';
    let stopped = false;

    const ask = async (texts: string[]) => {
      for (const t of texts) words.set(t, null);
      for (let i = 0; i < texts.length; i += LOOKUP_BATCH) {
        const batch = texts.slice(i, i + LOOKUP_BATCH);
        const result = await fetch('/api/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texts: batch }),
        })
          .then((r) => (r.ok ? (r.json() as Promise<SentenceLookup>) : null))
          .catch(() => null);
        if (stopped) return;
        for (const t of batch) words.set(t, result?.words[t] ?? []);
        for (const [k, m] of Object.entries(result?.meanings ?? {})) meanings.set(k, m);
      }
      queueScan();
    };

    const scan = () => {
      scanQueued = 0;
      const next = new Map<Element, Found[]>();
      const unknown = new Set<string>();
      for (const el of document.querySelectorAll('[data-lookup]')) {
        const { text, nodes, runs } = readSentence(el);
        if (!text.trim()) continue;
        if (!words.has(text)) {
          if (text.length <= 500) unknown.add(text);
          continue;
        }
        const found: Found[] = [];
        for (const word of words.get(text) ?? []) {
          const pieces = wordPieces(runs, word);
          const meaning = meanings.get(word.key);
          if (!pieces || !meaning) continue;
          found.push({
            id: nextId++,
            meaning,
            surface: text.slice(word.start, word.end),
            ranges: pieces.map((p) => {
              const range = new Range();
              range.setStart(nodes[p.run], p.start);
              range.setEnd(nodes[p.run], p.end);
              return range;
            }),
          });
        }
        next.set(el, found);
      }
      sentences = next;
      paint(
        MARKED,
        [...next.values()].flatMap((list) => list.flatMap((f) => f.ranges)),
      );
      if (unknown.size > 0) void ask([...unknown]);
    };
    const queueScan = () => {
      if (!scanQueued) scanQueued = requestAnimationFrame(scan);
    };

    const show = (found: Found | null, delay: number) => {
      clearTimeout(timer);
      if (same(found, activeRef.current)) return;
      timer = setTimeout(() => setActive(found), delay);
    };
    const under = (
      e: { target: EventTarget | null; clientX: number; clientY: number },
      tap = false,
    ) => {
      const el = e.target instanceof Element ? e.target.closest('[data-lookup]') : null;
      // `data-lookup="hover"`: a tap there belongs to the card it sits in.
      if (!el || (tap && el.getAttribute('data-lookup') === 'hover')) return null;
      return hit(sentences.get(el), e.clientX, e.clientY);
    };

    let moveQueued = 0;
    const onMove = (e: PointerEvent) => {
      lastPointer = e.pointerType;
      if (e.pointerType !== 'mouse' || moveQueued) return;
      moveQueued = requestAnimationFrame(() => {
        moveQueued = 0;
        if (e.target instanceof Node && cardRef.current?.contains(e.target)) {
          clearTimeout(timer);
          return;
        }
        const found = under(e);
        // From one word straight to the next, the card follows at once.
        show(found, found ? (activeRef.current ? 0 : OPEN_DELAY) : CLOSE_DELAY);
      });
    };
    const onDown = (e: PointerEvent) => {
      lastPointer = e.pointerType;
    };
    // A tap on a marked word opens its card instead of what the sentence does on a tap (play it).
    const onClick = (e: MouseEvent) => {
      if (lastPointer === 'mouse') return;
      const found = under(e, true);
      if (!found) return;
      e.preventDefault();
      e.stopPropagation();
      show(found, 0);
    };

    // The card itself and other floating layers are not sentences; their changes need no scan.
    const observer = new MutationObserver((records) => {
      const outside = records.some((r) => {
        const el = r.target instanceof Element ? r.target : r.target.parentElement;
        return !el?.closest('[data-radix-popper-content-wrapper]');
      });
      if (outside) queueScan();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('click', onClick, true);
    queueScan();
    return () => {
      stopped = true;
      observer.disconnect();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('click', onClick, true);
      clearTimeout(timer);
      cancelAnimationFrame(scanQueued);
      cancelAnimationFrame(moveQueued);
      paint(MARKED, []);
      paint(ACTIVE, []);
    };
  }, []);

  useEffect(() => {
    activeRef.current = active;
    paint(ACTIVE, active?.ranges ?? []);
  }, [active]);

  return (
    <Popover open={!!active} onOpenChange={(open) => !open && setActive(null)}>
      <PopoverAnchor virtualRef={anchor} />
      {active && (
        <PopoverContent
          key={active.id}
          ref={cardRef}
          side="bottom"
          align="start"
          sideOffset={6}
          className="w-72"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <WordCard meaning={active.meaning} surface={active.surface} />
        </PopoverContent>
      )}
    </Popover>
  );
}
