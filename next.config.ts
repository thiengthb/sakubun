import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output → server.js + a pruned node_modules, which is what the Dockerfile copies into
  // the runtime stage. Without it the image build fails on a missing .next/standalone.
  output: 'standalone',
  // better-sqlite3 is a native addon: it must stay external to the server bundle.
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3'],
  outputFileTracingIncludes: {
    '/api/**': ['./prisma/**'],
  },
  typedRoutes: false,
  experimental: {
    // Server Actions carry pasted Excel imports; the cap has to fit a real workbook.
    // Each action re-checks the session itself (getSessionUserId) — there is no tenancy layer now.
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
