import { redirect } from 'next/navigation';

// The groups list moved into the /resources "Nhóm" tab (2026-07-22). Keep this path alive so old
// links / bookmarks land on the new home instead of 404-ing.
export default function GroupsPage() {
  redirect('/resources?tab=groups');
}
