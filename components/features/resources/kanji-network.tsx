'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LIST_CARD } from '@/components/common/list-card';
import { kanjiHref } from '@/components/common/kanji-detail';
import type { KanjiPage, KanjiPagePart, KanjiStudy, NetworkNode } from '@/lib/app/kanji-page';
import { NETWORK_PER_PART } from '@/lib/kanji/network';
import { withHanviet } from '@/lib/kanji/label';
import { cn } from '@/lib/core/utils';

// The component network of a kanji (KJ6, docs/plans/2026-11-08-kanji.md › Bộ thủ và mạng lưới). A
// laptop draws it: the kanji in the middle, its parts on the inner ring, and on the outer ring the
// first kanji built with each part, the part that gives the sound marked. Below, and alone on a phone, the
// same network as a list by part, each part's kanji past the first twelve behind "Xem thêm". Every
// kanji opens its own page, so the learner walks the network. Colours follow what they studied.

const STUDY_LABEL: Record<KanjiStudy, string> = {
  none: 'chưa học',
  new: 'đang chờ học',
  learning: 'đang học',
  review: 'đã nhớ',
};

// Faint until met; the brand colour while being learned; green once remembered.
const NODE_TONE: Record<KanjiStudy, string> = {
  none: 'fill-card stroke-border text-muted-foreground',
  new: 'fill-card stroke-accent-brand text-foreground',
  learning: 'fill-accent-brand/15 stroke-accent-brand text-foreground',
  review: 'fill-ok/15 stroke-ok text-foreground',
};
const TILE_TONE: Record<KanjiStudy, string> = {
  none: 'text-muted-foreground',
  new: 'border-accent-brand',
  learning: 'border-accent-brand bg-accent-brand/10',
  review: 'border-ok bg-ok/10',
};

export function KanjiNetwork({ page }: { page: KanjiPage }) {
  if (page.parts.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Chữ này không tách thành phần nhỏ hơn trong KanjiVG.
      </p>
    );
  return (
    <div className="space-y-6">
      <NetworkDrawing page={page} />
      <Legend />
      <div className="space-y-5">
        {page.parts.map((p) => (
          <PartList key={p.part} part={p} />
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {(Object.keys(STUDY_LABEL) as KanjiStudy[]).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <Circle aria-hidden strokeWidth={3} className={cn('size-4', NODE_TONE[s])} />
          {STUDY_LABEL[s]}
        </li>
      ))}
    </ul>
  );
}

const partLabel = (p: KanjiPagePart) =>
  `${p.node ? withHanviet(p.part, p.node.hanviet) : p.name ? `${p.part} ${p.name}` : p.part}${p.sound ? ', phần chỉ âm' : ''}`;

function PartList({ part: p }: { part: KanjiPagePart }) {
  const [all, setAll] = useState(false);
  const shown = all ? p.kanji : p.kanji.slice(0, NETWORK_PER_PART);
  const more = p.kanji.length - shown.length;
  return (
    <section className="space-y-2" aria-label={`Chữ có thành phần ${partLabel(p)}`}>
      <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
        {p.node ? (
          <Link href={kanjiHref(p.part)} className="underline-offset-4 hover:underline">
            <span lang="ja">{p.part}</span>
            {p.name && ` [${p.name}]`}
          </Link>
        ) : (
          <span>
            <span lang="ja">{p.part}</span>
            {p.name && ` ${p.name}`}
          </span>
        )}
        {p.sound && <span className="font-normal text-accent-brand">phần chỉ âm</span>}
        <span className="font-normal text-muted-foreground tabular-nums">
          {p.kanji.length} chữ khác
        </span>
      </h3>
      {p.kanji.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không chữ Jōyō nào khác có thành phần này.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((k) => (
            <li key={k.kanji}>
              <Link
                href={kanjiHref(k.kanji)}
                aria-label={`${withHanviet(k.kanji, k.hanviet)}, ${STUDY_LABEL[k.study]}`}
                className={cn(
                  LIST_CARD.base,
                  'flex min-w-16 flex-col items-center gap-0.5 px-1.5 py-1.5 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  TILE_TONE[k.study],
                )}
              >
                <span lang="ja" className="text-lg leading-none">
                  {k.kanji}
                </span>
                <span className="text-xs whitespace-nowrap">[{k.hanviet}]</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && (
        <Button variant="outline" size="sm" onClick={() => setAll(true)}>
          Xem thêm {more} chữ
        </Button>
      )}
    </section>
  );
}

// The drawing, in a 640 × 640 box: the kanji at the centre, parts at radius 130, and on one ring at
// radius 265 the kanji built with each part, spaced so neither circles nor [HÁN VIỆT] labels touch:
// as many as the part's sector holds (12 for one or two parts, 5 for five), the rest in the list.
const C = 320;
const R_PART = 130;
const R_OUT = 265;
/** The angle between two neighbouring outer kanji: 62 units of arc on the outer ring. */
const STEP = 62 / R_OUT;

// Rounded, so the server's and the browser's Math.cos give the same attribute and hydration matches.
const round = (v: number) => Math.round(v * 100) / 100;
const polar = (r: number, a: number) => ({
  x: round(C + r * Math.cos(a)),
  y: round(C + r * Math.sin(a)),
});

/** How many of a part's kanji the drawing shows when the parts share the ring `n` ways. */
const drawnPerPart = (n: number) =>
  Math.min(NETWORK_PER_PART, Math.floor((((2 * Math.PI) / n) * 0.85) / STEP) + 1);

function NetworkDrawing({ page }: { page: KanjiPage }) {
  const n = page.parts.length;
  const sector = (2 * Math.PI) / n;
  const layout = page.parts.map((p, i) => {
    const angle = -Math.PI / 2 + i * sector;
    const outer = p.kanji.slice(0, drawnPerPart(n));
    const spread = (outer.length - 1) * STEP;
    return {
      part: p,
      at: polar(R_PART, angle),
      outer: outer.map((k, j) => ({
        node: k,
        at: polar(R_OUT, angle - spread / 2 + j * STEP),
      })),
    };
  });
  return (
    <svg
      viewBox="0 0 640 640"
      role="img"
      aria-label={`Mạng lưới thành phần của ${page.kanji.kanji}`}
      data-slot="kanji-network"
      className="mx-auto w-full max-w-2xl max-md:hidden"
    >
      <g className="stroke-border" strokeWidth={1.5}>
        {layout.map(({ part, at, outer }) => (
          <g key={part.part}>
            <line x1={C} y1={C} x2={at.x} y2={at.y} />
            {outer.map(({ node, at: o }) => (
              <line key={node.kanji} x1={at.x} y1={at.y} x2={o.x} y2={o.y} />
            ))}
          </g>
        ))}
      </g>
      {layout.map(({ part, at, outer }) => (
        <g key={part.part}>
          {outer.map(({ node, at: o }) => (
            <Node key={node.kanji} node={node} x={o.x} y={o.y} r={22} />
          ))}
          <PartNode part={part} x={at.x} y={at.y} />
        </g>
      ))}
      <g>
        <circle
          cx={C}
          cy={C}
          r={44}
          strokeWidth={3}
          className={cn(NODE_TONE[page.study], 'stroke-foreground')}
        />
        <text
          x={C}
          y={C}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={44}
          lang="ja"
          className="fill-current"
        >
          {page.kanji.kanji}
        </text>
      </g>
    </svg>
  );
}

function PartNode({ part: p, x, y }: { part: KanjiPagePart; x: number; y: number }) {
  const body = (
    <>
      <circle
        cx={x}
        cy={y}
        r={30}
        strokeWidth={p.sound ? 3 : 2}
        strokeDasharray={p.node ? undefined : '4 3'}
        className={cn(NODE_TONE[p.node?.study ?? 'none'], p.sound && 'stroke-accent-brand')}
      />
      <text
        x={x}
        y={y - 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={26}
        lang="ja"
        className="fill-current"
      >
        {p.part}
      </text>
      {p.name && (
        <text
          x={x}
          y={y + 44}
          textAnchor="middle"
          fontSize={12}
          className={cn('fill-current', p.sound ? 'text-accent-brand' : 'text-muted-foreground')}
        >
          {p.node ? `[${p.name}]` : p.name}
        </text>
      )}
    </>
  );
  return p.node ? (
    <Link href={kanjiHref(p.part)} aria-label={`${partLabel(p)}, ${STUDY_LABEL[p.node.study]}`}>
      {body}
    </Link>
  ) : (
    <g aria-label={partLabel(p)}>{body}</g>
  );
}

function Node({ node, x, y, r }: { node: NetworkNode; x: number; y: number; r: number }) {
  return (
    <Link
      href={kanjiHref(node.kanji)}
      aria-label={`${withHanviet(node.kanji, node.hanviet)}, ${STUDY_LABEL[node.study]}`}
      className="outline-none focus-visible:[&>circle]:stroke-ring"
    >
      <circle cx={x} cy={y} r={r} strokeWidth={2} className={NODE_TONE[node.study]} />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={20}
        lang="ja"
        className="fill-current"
      >
        {node.kanji}
      </text>
      <text
        x={x}
        y={y + r + 11}
        textAnchor="middle"
        fontSize={10}
        className="fill-current text-muted-foreground"
      >
        [{node.hanviet}]
      </text>
    </Link>
  );
}
