# Repository Guidelines

## Project Structure & Module Organization

AdonisJS 7 serves an Inertia/React frontend. Backend `app/` contains controllers, services, VineJS validators, and Lucid models. Routes/middleware live in `start/`, configuration in `config/`, providers in `providers/`, and migrations/seeders in `database/`. Frontend code is under `inertia/`; Edge templates are in `resources/views/`.

## Backend Architecture & Request Flow

Define routes in `start/routes.ts`; authenticated routes use session auth, Bouncer, and—where applicable—`ensure_module_middleware.ts`. Controllers authorize, validate, call a service, then render or redirect.

Put business rules and state transitions in `app/services/`. Multi-record writes use Lucid transactions and row locks where needed. Record mutations through `audit(...)` in the same transaction. Use `DomainError` for database-dependent failures; Vine handles request-shape errors.

Models extend generated `database/schema.ts`; never edit it or `.adonisjs/` manually. Module definitions belong in `app/services/modules/registry.ts`. S3/MinIO files stay private and stream through authorized app routes. Web-only schedules are registered by `providers/scheduler_provider.ts`.

## Build, Test, and Development Commands

- `npm install` installs dependencies (Node 24+); `npm run dev` starts HMR.
- On Windows, `.\dev.ps1 setup` prepares a first-time development environment;
  `.\dev.ps1` starts the Docker infrastructure and host-run npm app thereafter.
- `docker compose -f docker-compose.dev.yml up -d` starts local infrastructure
  when using the manual workflow.
- `node ace migration:run && node ace db:seed` prepares the database.
- `npm run build` creates production output; `npm start` runs it.
- `npm test` runs Japa; target suites/files with `node ace test --suites=unit` or `--files="tests/unit/pricing.spec.ts"`.
- `npm run lint`, `npm run typecheck`, and `npm run format` check quality.

## Coding & Testing Conventions

Use TypeScript, two-space indentation, single quotes, Prettier, and the AdonisJS ESLint preset. Use `PascalCase` for classes/components, `camelCase` for symbols, backend `snake_case.ts`, and frontend kebab-case files. Prefer `#services/*` and `@/*` aliases. Name Japa tests `*.spec.ts`; use unit tests for pure logic and functional tests for routes, authorization, persistence, and regressions.

For Inertia mutations that replace server-backed navigation or application configuration, disable preserved component state on success and invalidate prefetched pages so the persistent layout and edited page consume the same response snapshot.

The module settings page uses the full dashboard content width, with Save and conditional Reset actions right-aligned in the page-title header. Presets and the connected workflow share one configuration card whose header introduces the presets without duplicating that text in the content, with the four large equal module-style preset options constrained and centered above the workflow. Operational stages use constrained columns with visible gaps and frequent, closely staggered MagicUI-style `AnimatedBeam` connections; Reports is rendered as a separate subsection.

## Production Deployment & Data Safety

Run `./deploy.sh update` for releases; it always fast-forwards `main`, then migrates, seeds, and health-checks without backing up by default. `migrate-only` also skips seeders; `WITH_BACKUP=true` opts a release into a verified backup. Use reviewed expand/contract migrations. Never run `docker compose down -v`, `./deploy.sh nuke`, or destructive rollbacks; copy backups off-host.

## Commits, Pull Requests & Guide Maintenance

Use concise imperative commits, optionally prefixed with `feat:` or `fix:`. PRs describe behavior, database/configuration impact, verification, linked issues, and UI screenshots when relevant. Never commit secrets or generated output.

For every repository change, re-read and update `AGENTS.md` in the same patch so its architecture, commands, paths, and conventions remain accurate. Fold durable guidance into the relevant section; do not append a change log.
