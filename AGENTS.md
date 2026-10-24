# Repository Guidelines

## Project Structure & Module Organization

AdonisJS 7 serves an Inertia/React frontend. Backend `app/` contains controllers, services, VineJS validators, and Lucid models. Routes/middleware live in `start/`, configuration in `config/`, providers in `providers/`, and migrations/seeders in `database/`. Frontend code is under `inertia/`; Edge templates are in `resources/views/`.

## Backend Architecture & Request Flow

Define routes in `start/routes.ts`; authenticated routes use session auth, Bouncer, and—where applicable—`ensure_module_middleware.ts`. Controllers authorize, validate, call a service, then render or redirect.

Put business rules and state transitions in `app/services/`. Multi-record writes use Lucid transactions and row locks where needed. Record mutations through `audit(...)` in the same transaction. Use `DomainError` for database-dependent failures; Vine handles request-shape errors.

Invitation and login email matching trims and lowercases addresses without removing dots or tags. Existing provider-normalized accounts remain accessible through a password-verified legacy lookup when no exact account matches; never rewrite or merge those accounts. Invitation acceptance locks and consumes the invitation inside the user-creation transaction; delivery state is separate from pending/accepted status. Keep all pending invitations visible, including expired links, so they can be retried; refresh the list on focus and at 15-second intervals while visible.

Roles have a persisted, highest-first `rankPosition`. The old `parentRoleId` remains only for compatibility; authorization and the management UI use rank order. The Owner rank stays fixed first. Managers with `roles.update` can drag only ranks below their own highest assigned role, with all of their own roles fixed. Feature permissions are still the union of assigned roles. Serialize role creation, deletion, reorder, and assignment with the shared database lock, recheck authorization after acquiring it, and audit writes in the same transaction. Preserve custom rank positions when seeding. User role editing exposes server-calculated editability and allowed roles; never allow self-editing, Owner editing, or an empty role set.

User revocation is reversible (`users.isActive`); preserve accounts and records. Deny revoked users at login and terminate their existing sessions on the next request. Revoke/restore is target-aware (`users.remove`), excluding self and Owner and respecting ranked-role boundaries; serialize and audit access changes.

Dashboard branding lives in `app_settings` under `dashboard_branding`. Only the owner may rename the dashboard or upload/remove its private icon; share current branding through Inertia and stream the icon through an authenticated route. The shared branding drives the sidebar, browser page-title suffix, and authenticated favicon; keep the client document metadata synchronized after Inertia navigation and branding updates. Audit setting changes in their transaction and clean up replaced images after commit.

Models extend generated `database/schema.ts`; never edit it or `.adonisjs/` manually. Configurable module definitions belong in `app/services/modules/registry.ts`; reports are always available and remain protected by `reports.view`, not the module gate. S3/MinIO files stay private and stream through authorized app routes. Web-only schedules are registered by `providers/scheduler_provider.ts`.
New routes must also pass a clean production build where `.adonisjs/` is regenerated from the committed source. Avoid making controller compilation depend on locally stale generated route-name types; use explicit redirect paths when the route is introduced in the same change.

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

Vite pre-bundles `motion/react` for the lazy-loaded Modules and Production Floor pages. Browser tests use a separate Vite cache so they cannot invalidate assets served by an active development session.
The test runner forces a distinct `*_test` PostgreSQL database (default `dev_test`, override with `TEST_DB_DATABASE`) before application boot. Create and migrate that database before running Japa; never point tests at `dev`, since existing test helpers truncate tables. Test HTTP sessions use the in-memory store so Japa's session and CSRF clients share fixture state; development and production keep their configured store.

## Coding & Testing Conventions

Use TypeScript, two-space indentation, single quotes, Prettier, and the AdonisJS ESLint preset. Use `PascalCase` for classes/components, `camelCase` for symbols, backend `snake_case.ts`, and frontend kebab-case files. Prefer `#services/*` and `@/*` aliases. Name Japa tests `*.spec.ts`; use unit tests for pure logic and functional tests for routes, authorization, persistence, and regressions.

For Inertia mutations that replace server-backed navigation or application configuration, disable preserved component state on success and invalidate prefetched pages so the persistent layout and edited page consume the same response snapshot.

The products list offers both a primary, mobile-friendly three-step Basics, Details, Review dialog in `inertia/components/catalog/new-product-dialog.tsx` and a one-page quick add dialog. Keep the guided form's client-side step checks aligned with `createProductValidator`, and keep its fields mounted across steps so `SkuField` remembers manually edited SKUs. Quick add collects name, SKU, category, and an optional product picture; it omits description and percentages. Both forms submit through `products.store`, which inherits omitted profit and tax percentages from the selected category and saves an optional image using catalog image storage. Cover default inheritance, explicit overrides, and image creation in `tests/functional/products.spec.ts`.

The module settings page uses the full dashboard content width, with Save and conditional Reset actions right-aligned in the page-title header. Presets and the connected workflow share one configuration card whose header introduces the presets without duplicating that text in the content, with the four large equal module-style preset options constrained and centered above the workflow. Operational stages use constrained columns with visible gaps and frequent, closely staggered MagicUI-style `AnimatedBeam` connections. Reports are not configurable and must not appear in this workflow or its presets.

## Production Deployment & Data Safety

Run `./deploy.sh update` for releases; it always fast-forwards `main`, then migrates, seeds, and health-checks without backing up by default. `migrate-only` also skips seeders; `WITH_BACKUP=true` opts a release into a verified backup. Use reviewed expand/contract migrations. Never run `docker compose down -v`, `./deploy.sh nuke`, or destructive rollbacks; copy backups off-host.

When `INFLUX_ENABLED=true`, HTTP startup requires a reachable InfluxDB 2.x `/ready` endpoint and a token-accessible configured organization/bucket; incomplete configuration or an unavailable store must fail startup. Keep the boot probe independent of container-resolved services such as the application logger because it runs before the container is ready. Railway's `InfluxDB` service uses a persistent `/var/lib/influxdb2` volume and the app connects over its private domain on port 8086; keep its initialization token in Railway variables, never in the repository. Local development may leave Influx disabled.

## Commits, Pull Requests & Guide Maintenance

Use concise imperative commits, optionally prefixed with `feat:` or `fix:`. PRs describe behavior, database/configuration impact, verification, linked issues, and UI screenshots when relevant. Never commit secrets or generated output.

For every repository change, re-read and update `AGENTS.md` in the same patch so its architecture, commands, paths, and conventions remain accurate. Fold durable guidance into the relevant section; do not append a change log.
