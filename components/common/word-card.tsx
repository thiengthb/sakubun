'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookCheck, BookPlus, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { CardAction } from '@/components/common/card-action';
import { SpokenLine } from '@/components/common/spoken-line';
import { useServerAction } from '@/components/common/use-server-action';
import { addWordAction } from '@/app/kaiwa/actions';
import type { WordMeaning } from '@/lib/kaiwa/lookup';

// What a looked-up word shows (thien, 7.4b; mẫu Sidebar-Lookup), the same in Hội thoại, Lịch sử and
// Ôn nhanh: the word (with its play button) and reading, Hán Việt and level; its senses, numbered;
// the form it takes in the sentence; then icon buttons to keep it and copy it.
export function WordCard({ meaning, surface }: { meaning: WordMeaning; surface?: string }) {
  const router = useRouter();
  // The card was read before the word was kept: it learns the new item from the answer.
  const [addedId, setAddedId] = useState<string | null>(null);
  const itemId = meaning.itemId ?? addedId;
  const add = useServerAction(addWordAction, {
    success: `Đã thêm ${meaning.expression} vào kho`,
    onSuccess: (added) => {
      setAddedId(added.itemId);
      router.refresh();
    },
  });
  const senses = meaning.meaningVi
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(meaning.expression);
      toast.success(`Đã chép ${meaning.expression}`);
    } catch {
      toast.error('Không chép được vào clipboard');
    }
  };

  return (
    <div data-slot="word-card" className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 space-y-0.5">
          <SpokenLine
            text={meaning.expression}
            speakText={meaning.reading ?? meaning.expression}
            label="Nghe từ"
            className="text-lg font-semibold"
            aside={
              meaning.reading &&
              meaning.reading !== meaning.expression && (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  [{meaning.reading}]
                </span>
              )
            }
          />
          {meaning.hanviet && (
            <div className="text-xs font-semibold text-muted-foreground uppercase">
              <span className="sr-only">Âm Hán Việt: </span>[{meaning.hanviet}]
            </div>
          )}
        </div>
        <Badge variant="outline" className="ml-auto shrink-0">
          {meaning.level}
        </Badge>
      </div>
      {senses.length > 1 ? (
        <ol className="list-decimal space-y-0.5 pl-5 text-sm">
          {senses.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      ) : (
        <p className="text-sm">{senses[0]}</p>
      )}
      {surface && surface !== meaning.expression && (
        <p className="text-xs text-muted-foreground">
          Trong câu:{' '}
          <span lang="ja" className="text-foreground">
            {surface}
          </span>
        </p>
      )}
      <div className="flex items-center gap-1 border-t border-border/70 pt-1.5">
        {itemId ? (
          <CardAction
            icon={BookCheck}
            label="Đã có trong kho của bạn"
            href={`/resources/${itemId}`}
            className="text-accent-brand"
          />
        ) : (
          <CardAction
            icon={BookPlus}
            label="Thêm vào kho"
            onClick={() => add.run(meaning.expression)}
            disabled={add.isPending}
          />
        )}
        <CardAction icon={Copy} label="Chép từ" onClick={copy} />
        <span className="ml-auto text-xs text-muted-foreground">
          {meaning.itemId ? 'Từ kho của bạn' : 'OpenJLPT'}
        </span>
      </div>
    </div>
  );
}
