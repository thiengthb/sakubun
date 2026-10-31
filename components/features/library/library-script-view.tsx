'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, MessagesSquare, UserRound } from 'lucide-react';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import { useServerAction } from '@/components/common/use-server-action';
import { LibraryAdminMenu } from '@/components/features/library/library-admin-menu';
import { LikeButton } from '@/components/features/library/like-button';
import {
  scriptSize,
  type LibraryScriptRow,
} from '@/components/features/library/library-script-card';
import { takeScriptAction } from '@/app/library/actions';

// One shared Kaiwa script (K7): read and listened to as on Hội thoại, before taking it. "Lấy về"
// copies it into the learner's own scripts and opens the copy; once they have one, the action opens it.
// The page passes Hội thoại's chat in as `children`, so this feature does not reach into that one.
export function LibraryScriptView({
  script,
  admin = false,
  children,
}: {
  script: Omit<LibraryScriptRow, 'firstLine'>;
  /** The admin gets Ẩn, in its menu (L6). */
  admin?: boolean;
  /** The script's lines, drawn as on Hội thoại. */
  children: ReactNode;
}) {
  const router = useRouter();
  const take = useServerAction(takeScriptAction, {
    success: (r) => (r.already ? 'Bạn đã có kịch bản này' : 'Đã lấy về Hội thoại'),
    onSuccess: (r) => router.push(`/kaiwa/${r.scriptId}`),
  });

  return (
    <PageShell
      template="list"
      breadcrumb={<ParentCrumbs section="library" self />}
      title={script.title}
      meta={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{scriptSize(script)}</span>
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
        <>
          <LikeButton
            entryId={script.id}
            liked={script.liked}
            likes={script.likes}
            name={script.title}
          />
          {admin && (
            <LibraryAdminMenu entryId={script.id} name={script.title} back="/library?tab=scripts" />
          )}
        </>
      }
      actions={
        script.myScriptId ? (
          <ExpandingIconButton asChild icon={MessagesSquare} label="Kịch bản của bạn">
            <Link href={`/kaiwa/${script.myScriptId}`} />
          </ExpandingIconButton>
        ) : (
          <Button onClick={() => take.run(script.id)} disabled={take.isPending}>
            <Download aria-hidden />
            Lấy về
          </Button>
        )
      }
      actionsOnPhone="split"
    >
      {children}
    </PageShell>
  );
}
