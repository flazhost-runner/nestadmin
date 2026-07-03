import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

// 'sqlite' in env maps to 'better-sqlite3' (TypeORM CLI driver name)
const rawType = process.env.DB_TYPE || 'sqlite';
const dbType = (rawType === 'sqlite' ? 'better-sqlite3' : rawType) as any;
const isSqlite = dbType === 'better-sqlite3';

// DB_DATABASE/DB_USERNAME/DB_PASSWORD adalah nama kanonik (dipakai CI);
// DB_NAME/DB_USER/DB_PASS dipertahankan sebagai alias backward-compat.
const dbDatabase = process.env.DB_DATABASE || process.env.DB_NAME;
const dbUsername = process.env.DB_USERNAME || process.env.DB_USER || 'root';
const dbPassword = process.env.DB_PASSWORD ?? process.env.DB_PASS ?? '';

const baseOptions: DataSourceOptions = {
  type: dbType,
  ...(isSqlite
    ? {
        database:
          dbDatabase === ':memory:'
            ? ':memory:'
            : join(process.cwd(), dbDatabase || 'nestadmin.sqlite'),
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        username: dbUsername,
        password: dbPassword,
        database: dbDatabase || 'nestadmin',
      }),
  entities: [join(__dirname, '../modules/**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../modules/**/migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export default new DataSource(baseOptions);
