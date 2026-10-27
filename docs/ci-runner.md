# CI runner

Since 2026-10-27, `ci.yml` and `deploy.yml` run on a self-hosted runner, `runs-on: [self-hosted, linux, x64]`,
because GitHub stopped starting hosted jobs on this account (billing). Self-hosted jobs cost no Actions minutes.

- Where: thien's laptop (TNT-Laptop), in WSL2 Ubuntu, with Docker Desktop's WSL integration on (the jobs run
  `docker build`). Runner folder `~/actions-runner-sakubun`, name `tnt-laptop-wsl`.
- CI only runs while that machine is on. It is slower than a hosted runner, so `vitest.config.ts` gives tests 30 s under CI. A PR whose `verify` sits in "Queued" is waiting for the runner.
- Code from a PR runs on that machine: keep the repo private and the runner registered to this repo only.
- Back to hosted runners: set `runs-on: ubuntu-latest` again in both workflows, then remove the runner
  (Settings > Actions > Runners).

## Keeping it up (set up 2026-10-27)

- Ubuntu-24.04 is imported from cloud-images.ubuntu.com (the Store's 26.04 does not start on that WSL 2.2.4).
  User `runner`, systemd on; `build-essential` is installed because better-sqlite3 compiles in `npm ci`.
- Runner v2.338.2 in `/home/runner/actions-runner-sakubun`, a systemd service inside the distro.
- WSL stops the distro when no Windows process holds it, and the runner with it. After each sign-in run
  `wsl -d Ubuntu-24.04 -u runner -- sleep infinity` (hidden), or add it as a logon task. Docker Desktop must be
  running too (turn on its AutoStart).
