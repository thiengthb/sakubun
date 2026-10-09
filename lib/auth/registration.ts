import { prisma } from '@/lib/db/db';

export async function isRegistrationOpen(): Promise<boolean> {
  try {
    return (await prisma.user.count()) === 0;
  } catch {
    return false;
  }
}
