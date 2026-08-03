import { redirect } from 'next/navigation';

// /items + /vocab were merged into /resources (tabs) on 2026-07-13. Keep this stub so old links/
// bookmarks and any lingering internal hrefs land on the new page instead of 404-ing.
export default function ItemsPage() {
  redirect('/resources');
}
