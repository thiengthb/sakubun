# CI runner

Since 2026-10-27, `ci.yml` and `deploy.yml` run on a self-hosted runner, `runs-on: [self-hosted, linux, x64]`,
because GitHub stopped starting hosted jobs on this account (billing). Self-hosted jobs cost no Actions minutes.

- Where: thien's laptop (TNT-Laptop), in WSL2 Ubuntu, with Docker Desktop's WSL integration on (the jobs run
  `docker build`). Runner folder `~/actions-runner-sakubun`, name `tnt-laptop-wsl`.
- CI only runs while that machine is on. A PR whose `verify` sits in "Queued" is waiting for the runner.
- Code from a PR runs on that machine: keep the repo private and the runner registered to this repo only.
- Back to hosted runners: set `runs-on: ubuntu-latest` again in both workflows, then remove the runner
  (Settings > Actions > Runners).
