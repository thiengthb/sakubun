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
  export function runPatternLock(
    root: string,
    registry: unknown,
  ): { pass: boolean; total: number; byPattern: PatternResult[] };
  export function loadRegistry(file: string): unknown;
}
