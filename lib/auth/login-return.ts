// Where /login sends the learner back after signing in: a page of this app that a guest opened,
// such as a shared Kaiwa script. Only a path on this site is kept, so a link cannot use the
// login page to send someone to another host.

const BASE = 'http://sakubun.invalid';

export function safeReturnPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return '/';
  }
  if (url.origin !== BASE || url.pathname === '/login' || url.pathname.startsWith('/api/')) {
    return '/';
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function loginPath(from?: string): string {
  const back = safeReturnPath(from);
  return back === '/' ? '/login' : `/login?next=${encodeURIComponent(back)}`;
}
