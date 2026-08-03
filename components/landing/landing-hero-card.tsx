'use client';

import { motion } from 'motion/react';
import { fadeUp } from '@/components/shared/motion-primitives';

// The hero's two hand-built visuals, split out of `landing-page.tsx` to keep that file about LAYOUT +
// COPY. `BrandMark` is the 作文 badge reused by the landing header/footer (same mark as the app shell and
// the login screen); `MockCard` is the graded-practice card that shows, in one glance, what a turn looks
// like. Both are decorative: the mark is aria-hidden and the card is a static sample, not real data.

/** The Claude-orange brand mark (作文) reused from the app shell / login screen. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      lang="ja"
      aria-hidden
      className={
        'flex items-center justify-center rounded-md bg-primary font-bold tracking-tighter text-primary-foreground ' +
        (className ?? 'size-7 text-[11px]')
      }
    >
      作文
    </span>
  );
}

/** Hero signature: a graded practice card — the most characteristic moment of the app. */
export function MockCard() {
  return (
    <motion.div variants={fadeUp} className="relative">
      <motion.div
        // Gentle idle float; MotionConfig(reducedMotion="user") stills this when the OS asks.
        animate={{ y: [0, -9, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="rounded-2xl border border-border bg-card p-4 shadow-[0_24px_60px_-30px_var(--primary)]"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Lượt luyện · N2
          </span>
          <span className="font-mono text-sm font-bold text-ok tabular-nums">92 / 100</span>
        </div>

        <div className="rounded-xl border border-border p-3.5">
          <div className="mb-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
            Đề — dịch sang tiếng Việt
          </div>
          <div lang="ja" className="text-lg font-medium">
            一言言ったばかりに、彼を怒らせてしまった。
          </div>
        </div>

        <div className="mt-2.5 rounded-xl border border-border p-3.5">
          <div className="mb-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
            Bạn dịch
          </div>
          <div className="text-sm">Chỉ vì lỡ nói một câu mà tôi đã làm cậu ấy nổi giận.</div>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-ok/15 px-2.5 py-0.5 text-xs font-semibold text-ok">
              Nghĩa
            </span>
            <span className="text-muted-foreground">khớp bản tham khảo</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              lang="ja"
              className="rounded-full bg-ok/15 px-2.5 py-0.5 text-xs font-semibold text-ok"
            >
              〜ばかりに
            </span>
            <span className="text-muted-foreground">dùng đúng sắc thái</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-warn/15 px-2.5 py-0.5 text-xs font-semibold text-warn">
              Tự nhiên
            </span>
            <span className="text-muted-foreground">hơi cứng — có thể bỏ “đã”</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Tín hiệu xếp lịch ôn">
          {['1 Again', '2 Hard', '3 Good', '4 Easy'].map((s) => (
            <span
              key={s}
              className={
                'rounded-lg border px-2.5 py-1 text-xs font-semibold ' +
                (s === '3 Good'
                  ? 'border-primary/45 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground')
              }
            >
              {s}
            </span>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
