import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3'],
  outputFileTracingIncludes: {
    '/api/**': ['./prisma/**'],
  },
  typedRoutes: false,
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
