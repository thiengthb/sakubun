import type { Metadata } from 'next';
import { KaiwaScriptForm } from '@/components/features/kaiwa/kaiwa-script-form';
import { getSessionUserId } from '@/lib/auth/current-user';

export const metadata: Metadata = { title: 'Thêm kịch bản — sakubun' };
export const dynamic = 'force-dynamic';

export default async function NewScriptPage() {
  await getSessionUserId();
  return <KaiwaScriptForm />;
}
