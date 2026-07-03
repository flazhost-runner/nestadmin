import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { DataSource } from 'typeorm';
import { join } from 'path';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const rawType = process.env.DB_TYPE || 'sqlite';
const dbType = (rawType === 'sqlite' ? 'better-sqlite3' : rawType) as any;
const isSqlite = dbType === 'better-sqlite3';

const AppDataSource = new DataSource({
  type: dbType,
  database: isSqlite
    ? join(process.cwd(), process.env.DB_NAME || 'nestadmin.sqlite')
    : process.env.DB_NAME || 'nestadmin',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  entities: [join(__dirname, '../modules/**/*.entity{.ts,.js}')],
  synchronize: false,
});

async function seed() {
  await AppDataSource.initialize();

  const em = AppDataSource.manager;

  // Seed Setting (singleton - idempotent)
  const existingSetting = await em.query('SELECT id FROM settings LIMIT 1');
  if (existingSetting.length === 0) {
    await em.query(
      'INSERT INTO settings (id, initial, name, description, theme, fe_template, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [
        uuidv4(),
        'NA',
        'NestAdmin',
        'NestAdmin - Bootstrap Admin Panel',
        'Blue',
        'agency-consulting-002-creative-agency',
      ],
    );
    console.log('Setting seeded');
  }

  // Seed Administrator role
  let roleId: string;
  const existingRole = await em.query(
    "SELECT id FROM roles WHERE name = 'Administrator' LIMIT 1",
  );
  if (existingRole.length === 0) {
    roleId = uuidv4();
    await em.query(
      'INSERT INTO roles (id, name, guard_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [roleId, 'Administrator', 'web', 'Active'],
    );
    console.log('Administrator role seeded');
  } else {
    roleId = existingRole[0].id;
  }

  // Seed admin user (idempotent)
  const existingUser = await em.query(
    "SELECT id FROM users WHERE email = 'admin@admin.com' LIMIT 1",
  );
  if (existingUser.length === 0) {
    const userId = uuidv4();
    const hashedPwd = await bcrypt.hash(
      '12345678',
      parseInt(process.env.BCRYPT_ROUNDS || '10'),
    );
    await em.query(
      'INSERT INTO users (id, code, name, phone, email, email_verified_at, password, status, blocked, blocked_reason, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [
        userId,
        '0000000001',
        'Administrator',
        '12345678910',
        'admin@admin.com',
        hashedPwd,
        'Active',
        false,
        '',
        'Asia/Jakarta',
      ],
    );
    await em.query('INSERT INTO users_roles (user_id, role_id) VALUES (?, ?)', [
      userId,
      roleId,
    ]);
    console.log('Admin user seeded: admin@admin.com / 12345678');
  }

  await AppDataSource.destroy();
  console.log('Seed complete');
}

seed().catch(console.error);
