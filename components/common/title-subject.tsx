import type { ReactNode } from 'react';

/**
 * An edit page's title names what is being edited beside the action, in brackets:
 * "Sửa ngữ pháp (〜ばかりに)". A long name wraps under it (thien, 2026-10-25).
 */
export function TitleSubject({
  children,
  subject,
  lang,
}: {
  children: ReactNode;
  subject: ReactNode;
  lang?: string;
}) {
  return (
    <>
      {children}{' '}
      <span lang={lang} className="font-semibold text-muted-foreground">
        ({subject})
      </span>
    </>
  );
}
