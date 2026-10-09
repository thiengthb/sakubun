import path from 'node:path';
import { defineConfig } from 'prisma/config';

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
