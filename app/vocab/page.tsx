import { redirect } from 'next/navigation';

// Merged into /resources (tabs) on 2026-07-13 — see app/items/page.tsx.
export default function VocabPage() {
  redirect('/resources');
}
