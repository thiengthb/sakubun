// Types for the vendored thienui guards (tooling/thienui-guards, plain .mjs copied by the `guards`
// registry item). Only what the tests use.
declare module '@/tooling/thienui-guards/src/pattern-lock.mjs' {
  export interface Violation {
    file: string;
    line: number;
    excerpt: string;
  }
  export interface PatternResult {
    id: string;
    rule: string;
    violations: Violation[];
    manual?: boolean;
    skipped?: string;
    error?: string;
  }
  export interface Registry {
    patterns: { id: string; check?: Record<string, unknown> }[];
  }
  export function runPatternLock(
    root: string,
    registry: Registry,
  ): { pass: boolean; total: number; byPattern: PatternResult[] };
  export function loadRegistry(file: string): Registry;
}
