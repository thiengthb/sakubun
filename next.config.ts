import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // kuromoji reads its dictionary from node_modules at run time (lib/kaiwa/tokenizer.ts), so it stays
  // unbundled and the dictionary is traced into the standalone output for the MCP route that saves
  // scripts.
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3', 'kuromoji'],
  outputFileTracingIncludes: {
    '/api/**': ['./prisma/**', './node_modules/kuromoji/dict/**'],
  },
  typedRoutes: false,
  experimental: {
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
