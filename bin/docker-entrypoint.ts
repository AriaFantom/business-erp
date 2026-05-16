/*
|--------------------------------------------------------------------------
| Docker entrypoint
|--------------------------------------------------------------------------
|
| Runs migrations (and optionally seeders) before booting the HTTP server.
| Both steps are idempotent — seeders use `updateOrCreate`, migrations track
| state in the `adonis_schema` table — so it's safe to keep them on by default.
|
*/

import { execSync } from 'node:child_process'

if (process.env.MIGRATE === 'true') {
  console.log('[entrypoint] running migrations…')
  execSync('node ace migration:run --force', { stdio: 'inherit' })
}

if (process.env.SEED === 'true') {
  console.log('[entrypoint] running seeders…')
  execSync('node ace db:seed', { stdio: 'inherit' })
}

await import('./server.js')
