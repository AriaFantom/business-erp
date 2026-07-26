# Repository Guidelines

## Project Structure & Module Organization

This repository is a single AdonisJS 7 application serving an Inertia/React frontend. Backend code lives in `app/`: controllers handle HTTP requests, services contain business logic, validators define VineJS input rules, and models map Lucid entities. Routes and middleware registration are in `start/`; runtime configuration is in `config/`. Database migrations and idempotent seeders belong under `database/`.

Frontend pages live in `inertia/pages/`, shared components in `inertia/components/`, layouts in `inertia/layouts/`, and global styles in `inertia/css/`. Edge templates are under `resources/views/`. Place Japa specs in `tests/unit/`, `tests/functional/`, or `tests/browser/` according to scope. Do not edit generated files such as `database/schema.ts` or `.adonisjs/` output directly.

## Build, Test, and Development Commands

- `npm install` installs dependencies; Node.js 24 or newer is required.
- `docker-compose -f docker-compose.dev.yml up -d` starts PostgreSQL, Redis, MinIO, and InfluxDB for local development.
- `node ace migration:run && node ace db:seed` prepares the database.
- `npm run dev` starts AdonisJS and Vite with hot module replacement.
- `npm run build` creates the production build; `npm start` runs it.
- `npm test` runs all Japa suites. Target work with `node ace test --suites=unit` or `node ace test --files="tests/unit/pricing.spec.ts"`.
- `npm run lint`, `npm run typecheck`, and `npm run format` check linting, both TypeScript projects, and formatting.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation, single quotes, and the repository Prettier preset. ESLint extends the AdonisJS application configuration. Name classes and React components in `PascalCase`, variables and functions in `camelCase`, and files in `snake_case` on the backend (`order_service.ts`) or kebab-case for frontend components (`data-table.tsx`). Prefer configured aliases such as `#services/*` and `@/components/*` over deep relative imports.

## Testing Guidelines

Use Japa and name specs `*.spec.ts`. Keep pure logic in unit tests; use functional tests for routes, authorization, persistence, and integrations. Browser tests should cover only flows requiring a real browser. No fixed coverage threshold is configured, so add focused regression tests for changed behavior and run the affected suite before the full test command.

## Commit & Pull Request Guidelines

Write concise, imperative commit subjects, optionally using prefixes seen in history (`feat:`, `fix:`, `README:`). Keep each commit focused. Pull requests should explain the behavior change, database or configuration impact, and verification performed; link relevant issues and include screenshots for visible UI changes. Never commit `.env`, credentials, generated build output, or service data.
