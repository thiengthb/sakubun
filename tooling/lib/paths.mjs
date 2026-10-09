// Small path/process helpers for the product scripts in tooling/ (formerly part of the harness library).
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function repoPath(...parts) {
  return join(REPO_ROOT, ...parts);
}

export function run(bin, args = [], { cwd = REPO_ROOT, capture = true, input, shell = process.platform === 'win32', env } = {}) {
  const r = spawnSync(bin, args, {
    cwd, encoding: 'utf8', input, shell,
    ...(env ? { env: { ...process.env, ...env } } : {}),
    stdio: capture ? 'pipe' : 'inherit',
  });
  return { status: r.status ?? 1, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() };
}
