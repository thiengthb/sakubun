import { redirect } from 'next/navigation';

// Editing happens on the script's own page since 7.4f (one canvas); old links still land there.
export default async function EditScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/kaiwa/${id}?edit=1`);
}
