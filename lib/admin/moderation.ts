// Who the admin may ban or delete (roadmap 7.2c). Pure: the page and the server actions both ask it.
import { accountAccess, type AccessUser } from '@/lib/auth/access';

export type ModerationTarget = AccessUser & { id: string; email: string };

// Why the actor may not ban or delete this account, or null when they may.
export function moderationRefusal(actorId: string, target: ModerationTarget | null): string | null {
  if (!target) return 'Không tìm thấy tài khoản.';
  if (target.id === actorId) return 'Không tự chặn hay xoá tài khoản của mình.';
  if (accountAccess({ ...target, banned: false }) === 'admin')
    return 'Không chặn hay xoá được tài khoản quản trị.';
  return null;
}

// Deleting asks the admin to type the account's email again; case and spaces do not matter.
export function deleteConfirmed(email: string, typed: string): boolean {
  return typed.trim().toLowerCase() === email.trim().toLowerCase() && typed.trim() !== '';
}
