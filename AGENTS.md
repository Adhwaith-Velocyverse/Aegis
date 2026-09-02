# AGENTS.md

Conventions and required commands for any agent (or human) working in this repo.

## Workspaces

This is an npm workspaces monorepo:

- `backend/` — TypeScript, Express, MySQL (`aegis_np` DB), BullMQ on Redis (`localhost:6380`)
- `frontend/` — Next.js 14
- `shared/` — shared types

## Required validation

Run these before finishing work and report results in the response:

```bash
npm run typecheck        # root; runs backend + frontend tsc --noEmit
npm run test             # backend vitest (5 test files, 68 tests)
npm run db:migrate       # applies any pending schema changes
```

Backend typecheck/test can also be run directly:

```bash
cd backend
npx tsc --noEmit
npx vitest run
```

## Database

- Host: `localhost:3306`, user `root`, password from `backend/.env` (`DB_PASSWORD`)
- DB name: `aegis_np`
- Migrations live in `backend/src/db/migrate.ts`
- Control catalog must be 199 rows (77 Email + 15 Cloud Apps + 20 Entra ID + 20 Intune + 15 M365 Admin + 21 Purview + 16 SharePoint + 15 Teams), all `is_active=1`, all IDs follow `module-` prefix

## Redis

- App: `localhost:6380` (Redis 5.0.14.1, BullMQ 4.x — BullMQ warns "Current: 5.0.14.1" but works)
- Avoid `localhost:6379` (orphan Redis 3.0.504 process — do not interact)

## Code conventions

- No comments unless asked
- Match existing patterns (controllers, services, types)
- Always run `npm run typecheck` and `npm run test` after edits
- Use `npm run db:migrate` to apply schema changes
- Email controls source-of-truth: `backend/src/services/emailSecurityControlDefinitions.ts` (77 controls; never edit IDs)

## Forbidden patterns

- Never commit `backend/.env`, `dump.rdb`, `version-1.zip`, or `backend/assessment-data/`
- Never add `process.exit()` in worker code (kills the BullMQ worker)
- Never re-raise SMTP errors from the email adapter (kills the worker — log and continue)
- Never bypass `attachScoreToReport` when calling `processAssessmentScore` (writes metadata)
- Never edit `reporting/src/index.ts` exports without re-running `npx vitest run` in `backend/src/reporting/`

## Files to keep an eye on

- `backend/src/services/emailSecurityControlDefinitions.ts` — 77 controls, do not change IDs
- `backend/src/services/emailSecurityEvaluator.ts` — evaluator registry
- `backend/src/services/emailSecurityCollector.ts` — EXO + Graph collector (slow cmdlet to watch: `Get-TenantAllowBlockListItems` — use 4 filtered variants instead)
- `backend/src/security-scoring/` — single scoring system
- `backend/src/reporting/` — PDF/Excel generators
- `backend/assessment-data/<id>/email-security/_summary.json` — rich per-control summary
