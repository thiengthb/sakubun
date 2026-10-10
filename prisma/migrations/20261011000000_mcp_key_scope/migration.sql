-- Planner keys (read-only load counts for a scheduling assistant); existing keys stay 'full'.
ALTER TABLE "mcp_key" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'full';
