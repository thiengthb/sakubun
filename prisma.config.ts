import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 keeps CLI config here instead of in schema.prisma — that is why
// `schema.prisma` has a `datasource` with no `url`.
const DEFAULT_DEV_URL = 'file:./prisma/dev.db';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DATABASE_URL ?? DEFAULT_DEV_URL,
  },
});
