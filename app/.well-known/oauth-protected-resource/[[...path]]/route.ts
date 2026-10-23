import { auth } from '@/lib/auth/auth';

// RFC 9728 metadata for /api/mcp at the site root, where claude.ai and ChatGPT look for it.
// better-auth's mcp plugin answers it; this route only forwards the request.
export const GET = (req: Request) => auth.handler(req);
