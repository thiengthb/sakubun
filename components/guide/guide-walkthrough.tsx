'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleCheck, ListChecks, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ANKI_STEPS, HOW_STEPS, MCP_STEPS, START_STEPS } from '@/components/guide/guide-steps';
import type { StartProgress, StartProgressKey } from '@/lib/guide-progress';

// --- interactive stepper -------------------------------------------------------------------------
// A self-contained "click-through" walkthrough: an animated illustration stage on top, a numbered
// caption below, prev/next + step dots. The stage is re-keyed by step index so its CSS enter
// animation (guide-stagein) replays on every navigation. Motion is CSS-only (globals.css guide-*),
// so the app's global prefers-reduced-motion rule already degrades it to a static reveal.
// The illustration primitives live in guide-primitives.tsx; the step content in guide-steps.tsx.

export interface WalkStep {
  title: string;
  body: ReactNode;
  visual: ReactNode;
}

/**
 * A step of a TUTORIAL (as opposed to an explanation walkthrough like HOW_STEPS). Diátaxis: a tutorial
 * must be self-sufficient and linear, and every step must produce a concrete, observable result — so
 * both fields are REQUIRED here. That is the type doing the work: a new tutorial step cannot be added
 * without stating what must already be true and how the reader knows it worked. `HOW_STEPS` stays a
 * plain WalkStep, where prerequisites/verification would be nonsense.
 */
export interface TutorialStep extends WalkStep {
  /** What must already be done before this step. */
  need: ReactNode;
  /** The observable result that proves the step worked. */
  done: ReactNode;
  /**
   * The signal in the learner's own data that proves this step is finished (`lib/guide-progress.ts`).
   * When the page passes `progress`, the step shows a real DONE state instead of just describing one.
   * Omit for a step whose completion the app cannot observe.
   */
  progressKey?: StartProgressKey;
}

function hasChecks(step: WalkStep | TutorialStep): step is TutorialStep {
  return 'need' in step;
}

export function GuideWalkthrough({
  steps,
  ariaLabel,
  progress,
}: {
  steps: (WalkStep | TutorialStep)[];
  ariaLabel: string;
  /**
   * The learner's real progress, or `null` for a guest / an explanation walkthrough — then this renders
   * exactly as it always did (no status anywhere), which is what keeps `/guide` fully readable signed out.
   */
  progress?: StartProgress | null;
}) {
  const [i, setI] = useState(0);
  const last = steps.length - 1;
  const go = (n: number) => setI(Math.max(0, Math.min(last, n)));
  const step = steps[i];

  const isDone = (s: WalkStep | TutorialStep): boolean =>
    progress != null && hasChecks(s) && s.progressKey != null && progress[s.progressKey];
  const tracked =
    progress != null ? steps.filter((s) => hasChecks(s) && s.progressKey != null) : [];
  const doneCount = tracked.filter(isDone).length;
  const firstUnfinished = steps.findIndex(
    (s) => hasChecks(s) && s.progressKey != null && !isDone(s),
  );
  const stepDone = isDone(step);

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          go(i + 1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          go(i - 1);
        }
      }}
      className="overflow-hidden rounded-xl border bg-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {/* Real progress, only when signed in AND this walkthrough has trackable steps: how far the
          learner actually is + one click to the step they still owe. A guest sees nothing here. */}
      {tracked.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/20 px-4 py-2 sm:px-6">
          <span className="flex items-center gap-2 text-xs">
            <CircleCheck
              className={cn(
                'size-4 shrink-0',
                doneCount === tracked.length ? 'text-ok' : 'text-muted-foreground',
              )}
              aria-hidden
            />
            <span className="font-medium tabular-nums">
              {doneCount}/{tracked.length} bước đã xong
            </span>
            <span className="text-muted-foreground">
              {doneCount === tracked.length
                ? '— bạn đã thiết lập xong, cứ luyện thôi.'
                : '— tính từ dữ liệu thật của bạn.'}
            </span>
          </span>
          {firstUnfinished >= 0 && firstUnfinished !== i && (
            <Button variant="outline" size="xs" onClick={() => go(firstUnfinished)}>
              Tới bước còn thiếu
              <ArrowRight />
            </Button>
          )}
        </div>
      )}

      <div className="relative border-b bg-gradient-to-b from-muted/40 to-muted/5 px-4 py-6 sm:px-6">
        <span className="absolute top-3 right-3 text-xs tabular-nums text-muted-foreground">
          {i + 1}/{steps.length}
        </span>
        <div
          key={i}
          className="guide-stagein mx-auto flex min-h-[11rem] max-w-md items-center justify-center"
        >
          {step.visual}
        </div>
      </div>

      <div className="space-y-1.5 px-4 py-4 sm:px-6">
        <h3 className="flex items-center gap-2 font-medium">
          {/* The badge carries the step's status: a check once the learner's data proves it's done. */}
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
              stepDone ? 'bg-ok text-background' : 'bg-primary text-primary-foreground',
            )}
          >
            {stepDone ? <Check className="size-3.5" aria-hidden /> : i + 1}
          </span>
          {step.title}
          {stepDone && <span className="text-xs font-normal text-ok">đã xong</span>}
        </h3>
        <div className="text-sm leading-6 text-muted-foreground">{step.body}</div>

        {hasChecks(step) && (
          <dl className="grid gap-2 pt-2 sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ListChecks className="size-3.5 shrink-0" aria-hidden />
                Cần trước đó
              </dt>
              <dd className="pt-0.5 text-sm">{step.need}</dd>
            </div>
            <div
              className={cn(
                'rounded-xl border px-3 py-2',
                stepDone ? 'border-ok bg-ok/10' : 'border-ok/40 bg-ok/5',
              )}
            >
              <dt className="flex items-center gap-1.5 text-xs font-medium text-ok">
                <CircleCheck className="size-3.5 shrink-0" aria-hidden />
                {stepDone ? 'Xong rồi' : 'Xong chưa?'}
              </dt>
              <dd className="pt-0.5 text-sm">{step.done}</dd>
            </div>
          </dl>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-3 py-2.5 sm:px-4">
        <Button variant="ghost" size="sm" onClick={() => go(i - 1)} disabled={i === 0}>
          <ArrowLeft />
          Trước
        </Button>
        {/* The dot stays 8px; the BUTTON is 24px of transparent hit area around it. An 8px target
            with a 6px gap failed WCAG 2.2 SC 2.5.8 on both counts (size AND neighbour spacing), and
            it was genuinely hard to hit on a phone. Hence gap-0: the 24px boxes sit flush, so the
            dots read 24px apart instead of 14px — slightly wider row, far easier to tap. */}
        <div className="flex items-center gap-0">
          {steps.map((s, idx) => {
            const done = isDone(s);
            return (
              <button
                key={s.title}
                type="button"
                aria-label={`Bước ${idx + 1}: ${s.title}${done ? ' (đã xong)' : ''}`}
                aria-current={idx === i}
                onClick={() => go(idx)}
                className="group grid size-6 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2 rounded-full transition-colors',
                    idx === i
                      ? 'bg-primary'
                      : done
                        ? 'bg-ok/70 group-hover:bg-ok'
                        : 'bg-border group-hover:bg-muted-foreground/50',
                  )}
                />
              </button>
            );
          })}
        </div>
        {i === last ? (
          <Button variant="ghost" size="sm" onClick={() => go(0)}>
            <RotateCcw />
            Xem lại
          </Button>
        ) : (
          <Button size="sm" onClick={() => go(i + 1)}>
            Tiếp
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

// --- exported walkthroughs -----------------------------------------------------------------------

export function StartWalkthrough({ progress }: { progress?: StartProgress | null }) {
  return <GuideWalkthrough steps={START_STEPS} ariaLabel="Hướng dẫn bắt đầu" progress={progress} />;
}
export function HowWalkthrough() {
  return <GuideWalkthrough steps={HOW_STEPS} ariaLabel="Cách hoạt động của vòng luyện" />;
}
export function AnkiWalkthrough() {
  return <GuideWalkthrough steps={ANKI_STEPS} ariaLabel="Thiết lập Anki" />;
}
export function McpWalkthrough() {
  return <GuideWalkthrough steps={MCP_STEPS} ariaLabel="Kết nối MCP với Claude Desktop" />;
}
