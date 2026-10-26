// Which rows a query may touch, for one learner (roadmap 7.1, docs/decisions/0006). Pure: no
// Prisma client here, so the rules are tested without a database. `userDb` applies them.

// The eight tables that hold one learner's data, by Prisma model name.
export const LEARNING_MODELS = [
  'Item',
  'SrsState',
  'ReviewLog',
  'Sentence',
  'Turn',
  'Group',
  'GroupMember',
  'Settings',
] as const;

const LEARNING = new Set<string>(LEARNING_MODELS);

export function isLearningModel(model: string | undefined): boolean {
  return model !== undefined && LEARNING.has(model);
}

// Reads, updates and deletes: the owner joins the filter, so another learner's row looks absent.
const WHERE_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);
// Creates: the owner is written into every row.
const CREATE_OPS = new Set(['create', 'createMany', 'createManyAndReturn']);
// Updates may not hand a row to someone else.
const UPDATE_OPS = new Set(['update', 'updateMany', 'updateManyAndReturn']);

type Args = Record<string, unknown>;

function owned(data: unknown, userId: string): Args {
  return { ...(data as Args), userId };
}

function assertKeepsOwner(data: unknown, userId: string, model: string): void {
  const rows = Array.isArray(data) ? data : [data];
  for (const row of rows) {
    const set = (row as Args | undefined)?.userId;
    if (set !== undefined && set !== userId) {
      throw new Error(`${model}: a learner's query cannot change userId.`);
    }
  }
}

// Returns the args to run instead. Throws on an operation it does not know, so a new Prisma
// operation fails loudly instead of running unscoped.
export function scopeArgs(model: string, operation: string, args: unknown, userId: string): Args {
  const next: Args = { ...((args as Args | undefined) ?? {}) };
  if (WHERE_OPS.has(operation)) next.where = owned(next.where, userId);
  if (UPDATE_OPS.has(operation)) assertKeepsOwner(next.data, userId, model);
  if (operation === 'upsert') {
    assertKeepsOwner(next.update, userId, model);
    next.create = owned(next.create, userId);
  } else if (CREATE_OPS.has(operation)) {
    next.data = Array.isArray(next.data)
      ? next.data.map((row) => owned(row, userId))
      : owned(next.data, userId);
  } else if (!WHERE_OPS.has(operation)) {
    throw new Error(
      `${model}.${operation} is not scoped to a learner; add it to learner-scope.ts.`,
    );
  }
  return next;
}
