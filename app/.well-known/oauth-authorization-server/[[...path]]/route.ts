import { auth } from '@/lib/auth/auth';

// RFC 8414 metadata for the OAuth provider at the site root (also with the issuer path appended).
// better-auth answers it; this route only forwards the request.
export const GET = (req: Request) => auth.handler(req);
