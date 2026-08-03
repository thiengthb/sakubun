import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

// better-auth's own endpoints (sign-in/out, session, admin ops, api-key management). Machine
// clients never call these automatically, so no forward-auth concern here (the MCP endpoint is
// the machine-facing one, handled separately in app/api/[transport]).
export const { GET, POST } = toNextJsHandler(auth);
