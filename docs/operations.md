# Operations Runbook

This runbook is the first production operations placeholder required by `AGENTS.md`.

## Launch Blockers

- No production deploy without `npm run test:release`.
- No production deploy without staging and canary smoke tests.
- No live provider secrets in browser logs, bundles, or test fixtures.
- No mutating tools until confirmation, idempotency, audit logging, and rollback are implemented.

## Rollback

Rollback order:

1. Disable affected feature flag.
2. Roll back prompt/config version.
3. Roll back app build.
4. Disable affected tool.
5. Route traffic to text fallback or human handoff.

