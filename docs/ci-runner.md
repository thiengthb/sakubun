# CI runner

`ci.yml` and `deploy.yml` run on GitHub-hosted runners, `runs-on: ubuntu-latest`. The repo is public, so
hosted jobs cost no Actions minutes.

**Never use a self-hosted runner while the repo is public.** Anyone can open a PR from a fork, and a PR can
change the workflow to run any code on the runner's machine.

## History

- 2026-10-27: hosted jobs stopped starting on this account (billing). #134 moved both workflows to a
  self-hosted runner, `tnt-laptop-wsl`, in WSL Ubuntu-24.04 on thien's laptop. CI then only ran while the
  laptop was on, and the migration suites needed 30 s under CI (`testTimeout` in `vitest.config.ts`).
- 2026-10-27, same day: thien made the repo public so hosted runners are free again; the workflows went back
  to `ubuntu-latest` and the laptop runner was stopped and removed from the repo.
