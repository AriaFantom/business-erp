/*
|--------------------------------------------------------------------------
| Docker entrypoint
|--------------------------------------------------------------------------
|
| Runs `node ace migration:run --force` before starting the HTTP server when
| MIGRATE=true. Keep it minimal — anything more belongs in a dedicated job.
|
*/

import { execSync } from 'node:child_process'

if (process.env.MIGRATE === 'true') {
  console.log('[entrypoint] running migrations…')
  execSync('node ace migration:run --force', { stdio: 'inherit' })
}

await import('./server.js')
