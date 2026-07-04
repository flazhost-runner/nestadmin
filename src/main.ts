import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import session from 'express-session';
import flash from 'connect-flash';
import methodOverride from 'method-override';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import * as express from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const expressLayouts = require('express-ejs-layouts');
import { AppModule } from './app.module';
import { AppExceptionFilter } from './filters/app-exception.filter';
import { DataSource } from 'typeorm';
import { buildSessionStore } from './services/sessionStore';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const port = config.get<number>('APP_PORT', 3000);
  const isProd = config.get('NODE_ENV') === 'production';

  // Fail-fast: require secrets in production
  if (isProd) {
    const sess = config.get('SESSION_SECRET', '');
    const jwt = config.get('JWT_SECRET', '');
    if (!sess || sess.length < 16)
      throw new Error('SESSION_SECRET required in production');
    if (!jwt || jwt.length < 16)
      throw new Error('JWT_SECRET required in production');
  }

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // managed per-route for EJS
    }),
  );

  // Compression
  app.use(compression());

  // Cookie parser
  app.use(cookieParser());

  // Method override: POST + ?_method=PUT|DELETE → override method before routing
  app.use(methodOverride('_method', { methods: ['POST'] }));

  // Session
  const sessionTtlHours = config.get<number>('SESSION_TTL_HOURS', 6);
  const sessionStore = buildSessionStore({
    driver: config.get<string>('SESSION_DRIVER', 'database'),
    redisUrl: config.get<string>('REDIS_URL', 'redis://127.0.0.1:6379'),
    dataSource: app.get(DataSource),
    ttlMs: sessionTtlHours * 60 * 60 * 1000,
    isTest: config.get('NODE_ENV') === 'test',
  });

  app.use(
    session({
      store: sessionStore,
      secret: config.get<string>('SESSION_SECRET', 'dev-secret'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: sessionTtlHours * 60 * 60 * 1000,
      },
    }),
  );

  // Flash messages
  app.use(flash());

  // Body parser HARUS terpasang SEBELUM csurf: bodyParser bawaan Nest baru
  // di-register saat listen() (setelah semua app.use() di bootstrap), sehingga
  // req.body._csrf selalu kosong dan SEMUA POST form web gagal EBADCSRFTOKEN.
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  // CSRF protection — 3 jalur: body._csrf, query._csrf, header x-csrf-token. Skip /api/ routes.
  if (config.get('NODE_ENV') !== 'test') {
    app.use((req: any, res: any, next: any) => {
      if (req.path.startsWith('/api/')) return next();
      return csurf({
        value: (r: any) =>
          r.body?._csrf || r.query?._csrf || r.headers?.['x-csrf-token'] || '',
      })(req, res, next);
    });
  }

  // EJS template engine
  const appMode = config.get('APP_MODE', 'full');
  if (appMode === 'full') {
    app.setViewEngine('ejs');
    // nest-cli copies src/**/*.ejs → dist/**/*.ejs (strips src/ prefix via sourceRoot:"src").
    // __dirname at runtime = dist/src/ — go up one to reach dist/modules and dist/resources.
    app.setBaseViewsDir([
      join(__dirname, '..', 'modules'),
      join(__dirname, '..', 'resources'),
    ]);
    // express-ejs-layouts: default layout = chrome wrapper (main.ejs)
    app.use(expressLayouts);
    app.set('layout', 'layouts/be/default/main');
    app.set('layout extractScripts', true);
    app.set('layout extractStyles', true);
    // public/ is at project root — process.cwd() is reliable across environments
    app.useStaticAssets(join(process.cwd(), 'public'));
  }

  // Global exception filter
  app.useGlobalFilters(new AppExceptionFilter());

  // Global validation pipe (class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Graceful shutdown
  const server = await app.listen(port, () => {
    console.log(
      `NestAdmin running on http://localhost:${port} (mode: ${appMode})`,
    );
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} already in use`);
      process.exit(1);
    }
    throw err;
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap();
