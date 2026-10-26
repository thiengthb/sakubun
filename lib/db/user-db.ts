import { Prisma } from '@/lib/generated/prisma/client';
import { unguardedPrisma } from '@/lib/db/db';
import { isLearningModel, scopeArgs } from '@/lib/db/learner-scope';

// A Prisma client bound to one learner (roadmap 7.1). Every query on a learning table carries
// their userId: reads see only their rows, creates write it. Other tables pass through.
// Nested writes (`srs: { create }`) are not seen by the extension: put `userId: db.$ownerId()`
// in the nested data yourself.
function learnerScope(userId: string) {
  return Prisma.defineExtension({
    name: 'learner-scope',
    client: {
      $ownerId: () => userId,
    },
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (!isLearningModel(model)) return query(args);
          return query(scopeArgs(model, operation, args, userId) as typeof args);
        },
      },
    },
  });
}

export function userDb(userId: string) {
  if (!userId) throw new Error('userDb needs a userId.');
  return unguardedPrisma.$extends(learnerScope(userId));
}

export type UserDb = ReturnType<typeof userDb>;
