/*
|--------------------------------------------------------------------------
| Test runner entrypoint
|--------------------------------------------------------------------------
|
| The "test.ts" file is the entrypoint for running tests using Japa.
|
| Either you can run this file directly or use the "test"
| command to run this file and monitor file changes.
|
*/

import { existsSync, readFileSync } from 'node:fs'

process.env.NODE_ENV = 'test'

// Never let Japa's truncate helpers fall back to the development database.
const readDatabaseName = (file: URL): string | undefined => {
  if (!existsSync(file)) return undefined
  return readFileSync(file, 'utf8').match(/^DB_DATABASE\s*=\s*["']?([^\s"'#]+)["']?/m)?.[1]
}
const developmentDatabase = readDatabaseName(new URL('../.env', import.meta.url))
const configuredDatabase = process.env.DB_DATABASE ?? developmentDatabase
const testDatabase =
  process.env.TEST_DB_DATABASE ??
  readDatabaseName(new URL('../.env.test', import.meta.url)) ??
  (configuredDatabase?.endsWith('_test') ? configuredDatabase : `${configuredDatabase}_test`)
if (
  !configuredDatabase ||
  !testDatabase.endsWith('_test') ||
  testDatabase === developmentDatabase
) {
  throw new Error(
    'Tests require a dedicated *_test database distinct from the development database.'
  )
}
process.env.DB_DATABASE = testDatabase

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'
import { configure, processCLIArgs, run } from '@japa/runner'

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .testRunner()
  .configure(async (app) => {
    const { runnerHooks, ...config } = await import('../tests/bootstrap.js')

    processCLIArgs(process.argv.splice(2))
    configure({
      ...app.rcFile.tests,
      ...config,
      ...{
        setup: runnerHooks.setup,
        teardown: runnerHooks.teardown.concat([() => app.terminate()]),
      },
    })
  })
  .run(() => run())
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
