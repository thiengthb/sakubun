import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { KaiwaScriptForm } from '@/components/features/kaiwa/kaiwa-script-form';
import { getUserDb } from '@/lib/auth/current-user';
import { getScript } from '@/lib/kaiwa/scripts';

export const metadata: Metadata = { title: 'Sửa kịch bản — sakubun' };
export const dynamic = 'force-dynamic';

export default async function EditScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const script = await getScript(await getUserDb(), id);
  if (!script) notFound();
  return (
    <KaiwaScriptForm
      script={{ id: script.id, version: script.version, title: script.title, body: script.body }}
    />
  );
}
