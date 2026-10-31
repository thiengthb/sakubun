'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MessagesSquare, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { SearchInput } from '@/components/common/search-input';
import {
  LibraryScriptCard,
  type LibraryScriptRow,
} from '@/components/features/library/library-script-card';

/** The URL of the scripts tab, with its search (K7). */
export const scriptsHref = (q: string) =>
  `/library?${new URLSearchParams(q.trim() ? { tab: 'scripts', sq: q.trim() } : { tab: 'scripts' })}`;

// "Kịch bản" on Kho chung (K7): the Kaiwa scripts learners shared, the most taken first, searched on
// the server by title and text.
export function LibraryScripts({ scripts, q }: { scripts: LibraryScriptRow[]; q: string }) {
  const router = useRouter();
  const [text, setText] = useState(q);
  return (
    <div className="space-y-4">
      {(scripts.length > 0 || q) && (
        <form
          role="search"
          className="w-full sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            router.replace(scriptsHref(text));
          }}
        >
          <SearchInput
            type="search"
            aria-label="Tìm kịch bản"
            placeholder="Ở nhà hàng, いらっしゃいませ"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </form>
      )}
      {scripts.length === 0 ? (
        q ? (
          <EmptyState icon={SearchX} title="Không có kịch bản nào khớp." />
        ) : (
          <EmptyState
            icon={MessagesSquare}
            title="Chưa có kịch bản nào được chia sẻ"
            description={
              <>
                Muốn chia sẻ kịch bản của bạn: mở nó ở{' '}
                <Link href="/kaiwa" className="underline underline-offset-2">
                  Hội thoại
                </Link>{' '}
                rồi bấm Chia sẻ.
              </>
            }
          />
        )
      ) : (
        <div className="@container">
          <ul className="grid gap-2 @2xl:grid-cols-2 @2xl:gap-3 @5xl:grid-cols-3">
            {scripts.map((s) => (
              <LibraryScriptCard key={s.id} script={s} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
