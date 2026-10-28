'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { SpokenLine } from '@/components/common/spoken-line';
import { DueCell } from '@/components/common/due-cell';
import { STATE_LABELS } from '@/lib/srs/constants';
import { cn } from '@/lib/core/utils';
import { Truncate } from '@/components/ui/truncate';

export function ResourceCard({
  expression,
  ruby,
  speakText,
  meaningVi,
  level,
  suspended,
  srs,
  showFurigana,
  voiceSpeaker,
  speechRate,
  aside,
  extra,
  actions,
}: {
  expression: string;
  ruby: string | null;
  speakText: string;
  meaningVi: string;
  level: string;
  suspended: boolean;
  srs: { state: number; due: string | Date } | null;
  showFurigana: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
  aside?: ReactNode;
  extra?: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', suspended && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <SpokenLine
            text={expression}
            speakText={speakText}
            ruby={ruby}
            showFurigana={showFurigana}
            speaker={voiceSpeaker}
            rate={speechRate}
            label="Nghe mẫu"
          />
          {extra}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      </div>

      <Truncate className="text-sm text-muted-foreground">{meaningVi}</Truncate>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{suspended ? 'Tạm ngưng' : (STATE_LABELS[srs?.state ?? 0] ?? '—')}</span>
        {!suspended && srs != null && srs.state !== 0 && (
          <>
            <span aria-hidden>·</span>
            <DueCell srs={srs} />
          </>
        )}
        <span aria-hidden>·</span>
        <Badge variant="outline" className="px-1.5 py-0 text-xs">
          {level}
        </Badge>
        {aside}
      </div>
    </div>
  );
}
