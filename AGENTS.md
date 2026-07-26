# Repository Guidelines

## Project Structure & Module Organization

AdonisJS 7 serves an Inertia/React frontend. Backend `app/` contains controllers, services, VineJS validators, and Lucid models. Routes and middleware live in `start/`, configuration in `config/`, providers in `providers/`, and migrations/seeders in `database/`. Frontend pages, components, layouts, and styles live under `inertia/`; Edge templates are in `resources/views/`. Tests are split among `tests/unit/`, `tests/functional/`, and `tests/browser/`.

## Backend Architecture & Request Flow

Define named routes in `start/routes.ts`; authenticated routes use session auth, Bouncer permissions, and—where applicable—`ensure_module_middleware.ts`. Controllers should remain thin: authorize with `bouncer`, validate with `request.validateUsing(...)`, call a service, flash a result, then render Inertia or redirect.

Put business rules and state transitions in `app/services/`. Multi-record writes must use Lucid transactions and row locks where concurrency matters. Record important mutations through `audit(...)` in the same transaction. Use `DomainError` subclasses for database-dependent rule failures; Vine handles request-shape errors.

Models extend generated schemas from `database/schema.ts`; never edit that file or `.adonisjs/` output manually. Module definitions and dependencies belong in `app/services/modules/registry.ts`. Files remain private in S3/MinIO and must stream through authorized app routes—never expose storage URLs. Web-only background schedules are registered by `providers/scheduler_provider.ts`.

## Build, Test, and Development Commands

- `npm install` installs dependencies; Node 24+ is required.
- `docker-compose -f docker-compose.dev.yml up -d` starts local infrastructure.
- `node ace migration:run && node ace db:seed` prepares the database.
- `npm run dev` starts AdonisJS and Vite with HMR; `npm run build` creates production output.
- `npm test` runs all Japa suites; target one with `node ace test --suites=unit` or `--files="tests/unit/pricing.spec.ts"`.
- `npm run lint`, `npm run typecheck`, and `npm run format` validate code quality.

## Coding & Testing Conventions

Use TypeScript, two-space indentation, single quotes, Prettier, and the AdonisJS ESLint preset. Use `PascalCase` for classes/components, `camelCase` for symbols, backend `snake_case.ts`, and frontend kebab-case files. Prefer `#services/*` and `@/*` aliases over deep relative imports. Name Japa tests `*.spec.ts`; keep pure logic unit-tested and cover routes, authorization, persistence, and regressions with functional tests.

## Commits, Pull Requests & Guide Maintenance

Use concise imperative commits, optionally prefixed with `feat:` or `fix:`. PRs must describe behavior, database/configuration impact, verification, linked issues, and UI screenshots when relevant. Never commit secrets or generated output.

For every repository change, re-read and update `AGENTS.md` in the same patch so its architecture, commands, paths, and conventions remain accurate. Fold durable guidance into the relevant section; do not append a change log.
