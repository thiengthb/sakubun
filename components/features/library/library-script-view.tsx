'use client';

import { useRouter } from 'next/navigation';
import { Download, LogIn, MessagesSquare, UserRound } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { useServerAction } from '@/components/common/use-server-action';
import { KaiwaChat } from '@/components/features/kaiwa/kaiwa-chat';
import type { RubyLine } from '@/components/features/kaiwa/kaiwa-line';
import { LibraryAdminMenu } from '@/components/features/library/library-admin-menu';
import { LikeButton } from '@/components/features/library/like-button';
import { takeScriptAction } from '@/app/library/actions';

// A Kaiwa script a learner shared on Kho chung (K7b): read as a chat, as in Hội thoại, before taking
// it. "Lấy về" copies it into the learner's Hội thoại and opens the copy; once they have one, the
// action opens it instead. A guest (not signed in) reads it without speech or word lookup, and signs
// in from here to take it.
export function LibraryScriptView({
  script,
  login = null,
  admin = false,
  voiceSpeaker,
  speechRate,
  showFurigana,
}: {
  script: {
    id: string;
    title: string;
    author: string | null;
    takeCount: number;
    speakers: string[];
    likes: number;
    liked: boolean;
    myScriptId: string | null;
    lines: RubyLine[];
  };
  /** For a guest, the sign-in link that comes back here; null when signed in. */
  login?: string | null;
  /** The admin gets Ẩn, in its menu (L6). */
  admin?: boolean;
  voiceSpeaker?: number;
  speechRate?: number;
  showFurigana: boolean;
}) {
  const router = useRouter();
  const take = useServerAction(takeScriptAction, {
    success: (r) => (r.already ? 'Bạn đã có kịch bản này trong Hội thoại' : 'Đã lấy về Hội thoại'),
    onSuccess: (r) => router.push(`/kaiwa/${r.scriptId}`),
  });

  return (
    <PageShell
      template="list"
      breadcrumb={<ParentCrumbs section="library" self />}
      title={script.title}
      meta={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{script.lines.length} câu</span>
          {script.speakers.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{script.speakers.length} vai</span>
            </>
          )}
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <UserRound className="size-4" aria-hidden />
            {script.author ?? 'Người dùng đã xoá'}
          </span>
          {script.takeCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>{script.takeCount} lượt lấy</span>
            </>
          )}
        </span>
      }
      pageIcons={
        !login && (
          <LikeButton
            entryId={script.id}
            liked={script.liked}
            likes={script.likes}
            name={script.title}
          />
        )
      }
      actions={
        login ? (
          <ButtonLink href={login}>
            <LogIn aria-hidden />
            Đăng nhập để lấy về
          </ButtonLink>
        ) : script.myScriptId ? (
          <ExpandingIconButton
            href={`/kaiwa/${script.myScriptId}`}
            icon={MessagesSquare}
            label="Kịch bản của bạn"
          />
        ) : (
          <Button onClick={() => take.run(script.id)} disabled={take.isPending}>
            <Download aria-hidden />
            Lấy về
          </Button>
        )
      }
      actionsOnPhone="split"
    >
      <div className="space-y-2">
        {/* Kept out of the header, which its loading screen draws the same for everyone. */}
        {admin && (
          <div className="flex justify-end">
            <LibraryAdminMenu entryId={script.id} name={script.title} back="/library?tab=scripts" />
          </div>
        )}
        {login && (
          <p data-slot="guest-note" className="text-sm text-muted-foreground">
            Bạn đang xem kịch bản được chia sẻ trên Sakubun. Đăng nhập bằng Google để nghe máy đọc,
            rê chuột xem nghĩa từ và lấy kịch bản về luyện.
          </p>
        )}
        <KaiwaChat
          guest={!!login}
          scriptId={`library:${script.id}`}
          lines={script.lines}
          voiceSpeaker={voiceSpeaker}
          speechRate={speechRate}
          showFurigana={showFurigana}
        />
      </div>
    </PageShell>
  );
}
