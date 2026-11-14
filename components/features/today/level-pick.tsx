'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { LeadPanel } from '@/components/common/lead-panel';
import { useServerAction } from '@/components/common/use-server-action';
import { startAtLevelAction } from '@/app/actions';
import { JLPT_LEVELS } from '@/lib/settings/schema';

// Hôm nay's lead area for a newcomer (plan 2026-11-14-u3-today, U3c): one tap on a level takes its
// grammar, words and kanji from Kho chung, and the area turns into "Bắt đầu ôn".

export function LevelPick({ kanjiWaiting }: { kanjiWaiting: number }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const start = useServerAction(startAtLevelAction, {
    // Kanji come in a few a day in Ôn nhanh, so the count of kanji taken is left out.
    success: (r) => `Đã lấy ${r.grammar} mẫu và ${r.vocab} từ về kho; kanji vào dần mỗi ngày`,
    onSuccess: () => router.refresh(),
  });
  return (
    <LeadPanel aria-label="Hôm nay">
      <p className="text-sm font-medium text-accent-brand">Bắt đầu</p>
      <h2 className="mt-1 text-title">Bạn đang học cấp nào?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sakubun lấy ngữ pháp, từ vựng và kanji của cấp đó từ Kho chung. Đổi lại được ở Cài đặt.
      </p>
      <div className="mt-4 grid grid-cols-5 gap-2 md:max-w-xl" role="group" aria-label="Cấp JLPT">
        {JLPT_LEVELS.map((level) => (
          <Button
            key={level}
            variant="outline"
            size="lg"
            className="w-full"
            disabled={start.isPending}
            aria-busy={start.isPending && picked === level}
            onClick={() => {
              setPicked(level);
              start.run(level);
            }}
          >
            {level}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
        {start.isPending && picked
          ? `Đang lấy bộ ${picked} về kho…`
          : 'N5 là mới bắt đầu, N1 là cao nhất. Muốn tự chọn từng mẫu thì mở Kho chung.'}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <ButtonLink href="/library" variant="ghost" size="sm">
          Mở Kho chung <ArrowRight aria-hidden />
        </ButtonLink>
        {kanjiWaiting > 0 && (
          <Link
            href="/review"
            className="inline-flex min-h-7 items-center text-sm text-accent-brand hover:underline"
          >
            {kanjiWaiting} thẻ kanji đang chờ ở Ôn nhanh
          </Link>
        )}
      </div>
    </LeadPanel>
  );
}
