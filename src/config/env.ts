import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  APP_NAME: Joi.string().default('NestAdmin'),
  APP_PORT: Joi.number().default(3000),
  APP_MODE: Joi.string().valid('full', 'api').default('full'),

  // Database
  DB_TYPE: Joi.string()
    .valid('sqlite', 'better-sqlite3', 'mysql', 'mariadb', 'postgres')
    .default('better-sqlite3'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(3306),
  DB_USERNAME: Joi.string().default('root'),
  DB_USER: Joi.string().default('root'), // backward-compat alias
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_PASS: Joi.string().allow('').default(''), // backward-compat alias
  DB_DATABASE: Joi.string().default('nestadmin.sqlite'),
  DB_NAME: Joi.string().default('nestadmin.sqlite'), // backward-compat alias

  // Session & Auth
  SESSION_DRIVER: Joi.string().valid('redis', 'database').default('database'),
  SESSION_SECRET: Joi.string().min(16).required(),
  SESSION_TTL_HOURS: Joi.number().default(6),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  BCRYPT_ROUNDS: Joi.number().default(10),
  OTP_EXPIRY_MINUTES: Joi.number().default(10),
  DEFAULT_PAGE_SIZE: Joi.number().default(10),

  // Redis
  REDIS_URL: Joi.string().default('redis://127.0.0.1:6379'),

  // Storage (generic local/OSS/S3 adapter)
  STORAGE_DRIVER: Joi.string().valid('local', 'oss', 's3').default('local'),
  // Local driver: base dir where objects are written (relative → resolved from
  // process.cwd()). URL prefix is decoupled (always `/storage`) so an absolute
  // path (e.g. /var/data in Docker) still renders a valid URL.
  STORAGE_BASE_PATH: Joi.string().default('public/storage'),
  STORAGE_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  STORAGE_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  STORAGE_ENDPOINT: Joi.string().allow('').default(''),
  STORAGE_BUCKET: Joi.string().allow('').default(''),
  STORAGE_REGION: Joi.string().allow('').default(''),
  STORAGE_SSL: Joi.boolean().default(true),

  // Mail
  MAIL_HOST: Joi.string().allow('').default(''),
  MAIL_PORT: Joi.number().default(587),
  MAIL_SECURE: Joi.boolean().default(false),
  MAIL_USERNAME: Joi.string().allow('').default(''),
  MAIL_PASSWORD: Joi.string().allow('').default(''),
  MAIL_FROM_NAME: Joi.string().allow('').default('NestAdmin'),
  MAIL_FROM_ADDRESS: Joi.string().allow('').default(''),

  FE_CATALOG_TTL_HOURS: Joi.number().default(6),
});
