/**
 * app-factory.ts — bootstraps a full NestJS application for API/smoke/security tests.
 *
 * Pattern:
 *   const { app, ds } = await createTestApp()
 *   // ... tests ...
 *   await app.close()
 */
import 'reflect-metadata'
import { INestApplication } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import session from 'express-session'
import flash from 'connect-flash'
import methodOverride from 'method-override'
import cookieParser from 'cookie-parser'
import { join } from 'path'
import { AppModule } from '../../src/app.module'
import { AppExceptionFilter } from '../../src/filters/app-exception.filter'
import { seedTestDb } from './jest.setup'

// express-ejs-layouts has no type declarations
// eslint-disable-next-line @typescript-eslint/no-require-imports
const expressLayouts = require('express-ejs-layouts')

export interface TestApp {
  app: INestApplication
  ds: DataSource
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleRef.createNestApplication<NestExpressApplication>()

  // --- Express middleware (mirrors main.ts, minus compression/helmet for speed) ---
  app.use(cookieParser())
  app.use(methodOverride('_method', { methods: ['POST'] }))
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'test-session-secret-32chars-minimum',
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', secure: false },
    }),
  )
  app.use(flash())

  // EJS view engine (needed for web/smoke routes)
  app.setViewEngine('ejs')
  app.setBaseViewsDir([
    join(process.cwd(), 'src', 'modules'),
    join(process.cwd(), 'src', 'resources'),
  ])
  app.use(expressLayouts)
  app.set('layout', 'layouts/be/default/main')
  app.set('layout extractScripts', true)
  app.set('layout extractStyles', true)

  app.useGlobalFilters(new AppExceptionFilter())

  await app.init()

  // AppModule runs migrations automatically (migrationsRun: true when NODE_ENV=test)
  const ds = app.get(DataSource)

  // Seed initial data
  await seedTestDb(ds)

  return { app, ds }
}
