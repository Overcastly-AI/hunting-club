# Project status

Coordinator log. Updated by the coordinating session; read this first when resuming.

## Working agreements

- AWS changes are requested by email to the owner with a subject starting with `Grok Bot`. Grok Bot configures AWS. Never send credentials by email.
- Commit messages never credit Claude or other AI tools (enforced by `.githooks/commit-msg`).
- Stop and ask the owner before: spending money, open decisions in `docs/SPEC.md`, emails to anyone other than the owner, deleting anything.

## AWS requests (Grok Bot)

| # | Sent | Request | Status | Result |
|---|---|---|---|---|
| 1 | 2026-11-26 | Dev subdomain `huntclub-dev.<domain>`: Route 53 hosted zone, delegation from parent, ACM wildcard cert in us-east-1 | Waiting for reply | |

## Waiting on the owner

- Branch policy for agents (create `main`, worker branches, merge reviewed PRs)
- Check-in cadence and number of parallel workers
- Daily status email: OK? time and time zone
- Removing Claude credit from commit `0cbde5d` (needs a force-push)
- Open decisions listed in `docs/SPEC.md`
