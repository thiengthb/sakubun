import { z } from 'zod';
import {
  addItemsToGroup,
  createGroup,
  GROUP_KINDS,
  listGroups,
  previewGroupMembers,
  removeItemsFromGroup,
} from '@/lib/groups';
// `getUserId` is gone from this import on purpose: the data layer no longer takes a userId (the boundary
// is the login — withMcpAuth({required:true}) on the route), so nothing here needs to resolve one.
import { guard, ID, ITEM_IDS, ok, type McpServer } from '@/lib/mcp/tool-kit';

const GROUP_KIND = z.enum(GROUP_KINDS);

// Study-group tools. Groups are a pure organization + practice-scoping layer (they NEVER touch FSRS).
// Claude PROPOSES a grouping in chat → the learner approves → Claude calls create_group +
// add_items_to_group. suggest_group is the DRY-RUN that verifies a proposal before that write, so an
// approve can't leave an empty/half-built group. Scoping practice to a group rides get_due_items
// { groupId } (in tools/practice.ts), not a tool here.
export function registerGroupTools(server: McpServer) {
  server.tool(
    'list_groups',
    "List the learner's STUDY GROUPS (READ-ONLY). A group is a named collection of items that scopes " +
      'focused practice: kind "vocab" | "grammar" | "mixed" decides which item kinds may join. Returns ' +
      '[{ id, name, kind, note, memberCount }]. Use to answer "nhóm nào", to find a groupId before ' +
      'get_due_items { groupId } / add_items_to_group, or to check a group already exists before ' +
      'creating one. To practise a group, call get_due_items with its groupId.',
    {},
    guard('list_groups', async (_args, _extra: unknown) => ok(await listGroups())),
  );

  server.tool(
    'create_group',
    'CREATE an empty study group, then add members with add_items_to_group. kind ("vocab" | "grammar" ' +
      '| "mixed", default "mixed") is a soft constraint on which item kinds may join — a "grammar" group ' +
      'takes only grammar items, "vocab" only vocab, "mixed" both. PROPOSE-THEN-CREATE: only call this ' +
      'AFTER the learner approves the grouping you proposed in chat (use suggest_group to preview it ' +
      'first). Returns the created group { id, name, kind, ... } — pass its id to add_items_to_group.',
    {
      name: z.string().min(1).describe('Group name (learner-facing, Vietnamese)'),
      kind: GROUP_KIND.optional().describe('vocab | grammar | mixed (default mixed)'),
      note: z.string().optional().describe('Optional short note about the group'),
    },
    guard('create_group', async ({ name, kind, note }, _extra: unknown) =>
      ok(await createGroup({ name, kind, note })),
    ),
  );

  server.tool(
    'add_items_to_group',
    'ADD items (grammar and/or vocab) to a study group. itemIds come from list_grammar / list_vocab / ' +
      'get_due_items. Idempotent — an item already in the group is skipped. Enforces the group kind: ' +
      'every item must fit (a "grammar" group rejects vocab items, etc.); if any item does not fit or ' +
      "is not the learner's, NOTHING is added and an error explains why — call suggest_group first to " +
      'check. Returns { added } = how many NEW memberships were created. Get the groupId from ' +
      'list_groups or create_group.',
    {
      groupId: ID,
      itemIds: ITEM_IDS,
    },
    guard('add_items_to_group', async ({ groupId, itemIds }, _extra: unknown) =>
      ok(await addItemsToGroup(groupId, itemIds)),
    ),
  );

  server.tool(
    'remove_items_from_group',
    'REMOVE items from a study group (the items themselves and their FSRS history are untouched — only ' +
      'the membership is dropped). Returns { removed } = how many memberships were removed. Get the ' +
      'groupId from list_groups and itemIds from get_due_items / list_grammar / list_vocab.',
    {
      groupId: ID,
      itemIds: ITEM_IDS,
    },
    guard('remove_items_from_group', async ({ groupId, itemIds }, _extra: unknown) =>
      ok(await removeItemsFromGroup(groupId, itemIds)),
    ),
  );

  server.tool(
    'suggest_group',
    'DRY-RUN a proposed grouping — VERIFIES it, writes NOTHING. YOU pick the items and name from the ' +
      'chat + library (list_grammar / list_vocab / get_weak_report), then call this to preview: it ' +
      'returns { name, kind, fit[{itemId, expression, kind}], mismatched[...], notFound[...] } where ' +
      'fit = items that would join, mismatched = items whose kind the group would reject, notFound = ' +
      "ids that are not the learner's. Show the learner this preview (Vietnamese) and WAIT for their " +
      'yes; only then call create_group + add_items_to_group with the fit ids. This is the ' +
      'propose-then-approve step — never create a group before the learner approves.',
    {
      name: z.string().min(1).describe('Proposed group name'),
      kind: GROUP_KIND.optional().describe('vocab | grammar | mixed (default mixed)'),
      itemIds: ITEM_IDS,
    },
    guard('suggest_group', async ({ name, kind, itemIds }, _extra: unknown) => {
      const resolvedKind = kind ?? 'mixed';
      const preview = await previewGroupMembers(resolvedKind, itemIds);
      return ok({ name, kind: resolvedKind, ...preview });
    }),
  );
}
