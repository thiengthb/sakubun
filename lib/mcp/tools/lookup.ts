import { z } from 'zod';
import { checkLibrary } from '@/lib/library/lookup';
import { renderConsentGuard, renderLibraryCheck } from '@/lib/mcp/render';
import {
  guard,
  okWithNotes,
  type McpServer,
} from '@/lib/mcp/tool-kit';

const LOOKUP_KIND = z.enum(['GRAMMAR', 'VOCAB']);

export function registerLookupTools(server: McpServer) {
  server.tool(
    'check_library',
    'ALWAYS call this FIRST — before you explain, compare, or discuss ANY Japanese grammar pattern or ' +
      'word, including a one-off question in a chat with no practice session running. ONE pattern or ' +
      'word per call: `query` is a short expression, NEVER a pasted document and never a list. If the ' +
      'learner pasted a whole email / page / exam question, that is preview_import, not this. ' +
      'It answers, in ONE ' +
      'call: is it in the learner OWN library (with its review state and how complete its usage card is), ' +
      'has another member PUBLISHED it in the shared library, and what should be OFFERED to fix whatever ' +
      'is missing. READ-ONLY — it never writes.\n' +
      'Use the returned `mine[].card` as REFERENCE MATERIAL for YOUR OWN explanation: read it, ' +
      'cross-check it against what you know, and then explain in your own words. Do NOT transcribe it, ' +
      'and if it CONTRADICTS your own knowledge say so plainly rather than repeating it.\n' +
      'THE RATCHET — this is how the library gets better every session: if YOUR explanation used a ' +
      'near-synonym, a pitfall, a conjugation form or an example the card does NOT already carry, add ' +
      'ONE line offering to put just that on the card (patch_enrichment MERGES, so nothing already ' +
      'there is lost), and wait for a yes. If the card contradicted you, offer the correction instead ' +
      'of leaving the wrong text in place. Never write without a yes.\n' +
      'A ratchet offer exists only in this turn (the numbered `suggestions` come back next session), ' +
      'so it REPLACES the lowest-priority suggestion rather than being dropped; still at most 2 ' +
      'offers, 1 mid-session.\n' +
      "A suggestion's `args` carry only the itemId — YOU supply the content, in patch_enrichment's " +
      'exact shape. A contrast is an OBJECT ARRAY, not a string and not a free-form key: ' +
      'patch_enrichment { itemId, add: { contrasts: [{ with: "<the other pattern>", note: "<one ' +
      'Vietnamese line on the difference>" }] } }. The other `add` keys are structure / collocations / ' +
      'pitfalls (string arrays) and examples ({ ja, vi, jaRuby }); a clearer usage line goes in ' +
      '`set: { usage }`. Any other key is rejected and the offer is lost.\n' +
      'The markdown block is shown to the learner VERBATIM (it deliberately contains the STATUS only, ' +
      'never the card text); your explanation goes AFTER it. Then relay the numbered `suggestions` and ' +
      'WAIT — each one carries the exact `tool` + `args` to call on a yes. Never act on a suggestion ' +
      'the learner has not agreed to — UNLESS it is marked `auto: true`, which means they turned that ' +
      'class of action on in settings: then call the tool straight away and TELL them what you did in ' +
      'one line. `auto` is only ever set on additive, reversible actions; everything else still waits.\n' +
      'Also use it to browse ("có mẫu N2 nào người khác chia sẻ không?") — pass scope: "shared".',
    {
      query: z
        .string()
        .min(1)
        .describe(
          'The pattern, word, or meaning fragment the learner asked about — as they wrote it. Tilde ' +
            'and quote variants are normalised server-side, so 「〜ばかりに」 and ばかりに match the same item.',
        ),
      kind: LOOKUP_KIND.optional().describe(
        'Narrow to GRAMMAR or VOCAB. Omit to search both — usually correct, since the learner asks ' +
          'about a THING, not about a table.',
      ),
      scope: z
        .enum(['mine', 'shared', 'both'])
        .optional()
        .describe(
          'Default "both". "mine" = only their library · "shared" = only the public library.',
        ),
      midSession: z
        .boolean()
        .optional()
        .describe(
          'TRUE when this is an aside during a running practice turn: caps the offers at ONE so the ' +
            'pending exercise is not buried. Do NOT re-stage or grade early — the sentenceId stays valid.',
        ),
    },
    guard('check_library', async (args, _extra: unknown) => {
      const check = await checkLibrary(args);
      return okWithNotes(renderLibraryCheck(check), check, [renderConsentGuard(check.suggestions)]);
    }),
  );
}
