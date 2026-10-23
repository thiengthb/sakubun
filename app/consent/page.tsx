import { headers } from 'next/headers';
import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import { auth } from '@/lib/auth/auth';
import { getSessionUserId } from '@/lib/auth/current-user';
import { ConsentForm } from './consent-form';

export const dynamic = 'force-dynamic';

// The OAuth consent step: claude.ai or ChatGPT asked for access to /api/mcp and thien is signed in.
// better-auth signs the authorize query; a forged or expired one gets no buttons.
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await getSessionUserId();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : [value])
      if (v !== undefined) query.append(key, v);
  }
  const { secret } = await auth.$context;
  const valid = await verifyOAuthQueryParams(query.toString(), secret);
  const clientId = query.get('client_id');
  if (!valid || !clientId) return <ConsentForm request={null} />;

  const client = await auth.api
    .getOAuthClientPublic({ query: { client_id: clientId }, headers: await headers() })
    .catch(() => null);
  let host: string | null = null;
  try {
    host = new URL(query.get('redirect_uri') ?? '').host;
  } catch {}
  return (
    <ConsentForm
      request={{
        clientName: client?.client_name ?? null,
        redirectHost: host,
      }}
    />
  );
}
