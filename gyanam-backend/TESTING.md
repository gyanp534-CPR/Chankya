# Testing Notes

## Standard checks

Run these from `gyanam-backend`:

```bash
npm run typecheck
npm run lint
npm run test
```

## Windows sandbox note

On this machine, `npm run test` can fail inside a restricted sandbox with:

```text
Error: spawn EPERM
```

This is not a repo code failure. `vitest` uses `vite`, and `vite` uses `esbuild`, which spawns a subprocess during startup. In restricted Windows sandboxes, that spawn can be blocked.

If that happens:

1. Run the test command outside the sandbox or with unrestricted execution.
2. Treat `typecheck` and `lint` as the in-sandbox verification baseline.

## Test logging

Request logging is disabled automatically when `NODE_ENV=test`, so test output should stay readable.

Last updated: 2026-03-22

Last updated: 2026-03-22

