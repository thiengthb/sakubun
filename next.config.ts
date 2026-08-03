import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 is a native addon: it must stay external to the server bundle.
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3'],
  outputFileTracingIncludes: {
    '/api/**': ['./prisma/**'],
  },
  typedRoutes: false,
  experimental: {
    // Server Actions carry pasted Excel imports; the cap has to fit a real workbook.
    // Every action still runs behind the per-user tenancy guard in lib/db.ts.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
