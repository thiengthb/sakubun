import { redirect } from 'next/navigation';

export default function GroupsPage() {
  redirect('/resources?tab=groups');
}
