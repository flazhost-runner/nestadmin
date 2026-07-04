import { EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Seeder inti yang dipakai bersama oleh migration (AddAdminUser) dan script
// `npm run seed` (src/database/seed.ts) — satu sumber kebenaran.
//
// Pola mengikuti NodeAdmin (migrations InitSetting/AddAdminUser):
// - Raw query (bukan entity/QueryBuilder ber-target entity) agar tak terikat
//   metadata entity — kolom ber-default yang ditambah migration BERIKUTNYA
//   belum ada di tabel saat migration ini jalan di fresh install.
// - Placeholder & quoting identifier portabel lintas-dialect lewat
//   driver.createParameter (? / $1) dan driver.escape (`col` / "col").
// - Idempoten mutlak: cek-dulu sebelum insert, aman dijalankan berulang dan
//   di DB yang sudah pernah di-seed oleh script lama.

function escape(em: EntityManager, identifier: string): string {
  return em.connection.driver.escape(identifier);
}

function param(em: EntityManager, index: number): string {
  return em.connection.driver.createParameter(`p${index}`, index);
}

async function findId(
  em: EntityManager,
  table: string,
  column: string,
  value: string,
): Promise<string | null> {
  const rows: Array<{ id: string }> = await em.query(
    `SELECT ${escape(em, 'id')} FROM ${escape(em, table)} WHERE ${escape(em, column)} = ${param(em, 0)} LIMIT 1`,
    [value],
  );
  return rows.length > 0 ? rows[0].id : null;
}

// Insert dengan kolom eksplisit. `row` dibind sebagai parameter; `rawRow`
// disisipkan sebagai literal SQL (mis. CURRENT_TIMESTAMP) — portabel untuk
// nilai tanggal tanpa tergantung format datetime tiap driver.
async function insertRow(
  em: EntityManager,
  table: string,
  row: Record<string, string>,
  rawRow: Record<string, string> = {},
): Promise<void> {
  const cols = Object.keys(row);
  const rawCols = Object.keys(rawRow);
  const colList = [...cols, ...rawCols].map((c) => escape(em, c)).join(', ');
  const valueList = [
    ...cols.map((_, i) => param(em, i)),
    ...rawCols.map((c) => rawRow[c]),
  ].join(', ');
  await em.query(
    `INSERT INTO ${escape(em, table)} (${colList}) VALUES (${valueList})`,
    Object.values(row),
  );
}

const NOW = {
  created_at: 'CURRENT_TIMESTAMP',
  updated_at: 'CURRENT_TIMESTAMP',
};

export async function seedInitialData(em: EntityManager): Promise<void> {
  // Seed Setting (singleton - idempotent)
  const existingSetting: Array<{ id: string }> = await em.query(
    `SELECT ${escape(em, 'id')} FROM ${escape(em, 'settings')} LIMIT 1`,
  );
  if (existingSetting.length === 0) {
    await insertRow(
      em,
      'settings',
      {
        id: uuidv4(),
        initial: 'NA',
        name: 'NestAdmin',
        description: 'NestAdmin - Bootstrap Admin Panel',
        theme: 'Blue',
        fe_template: 'agency-consulting-002-creative-agency',
      },
      NOW,
    );
    console.log('Setting seeded');
  }

  // Seed Administrator role (idempotent)
  let roleId = await findId(em, 'roles', 'name', 'Administrator');
  if (!roleId) {
    roleId = uuidv4();
    await insertRow(
      em,
      'roles',
      {
        id: roleId,
        name: 'Administrator',
        guard_name: 'web',
        status: 'Active',
      },
      NOW,
    );
    console.log('Administrator role seeded');
  }

  // Seed admin user (idempotent)
  let userId = await findId(em, 'users', 'email', 'admin@admin.com');
  if (!userId) {
    userId = uuidv4();
    const hashedPwd = await bcrypt.hash(
      '12345678',
      parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    );
    await insertRow(
      em,
      'users',
      {
        id: userId,
        code: '0000000001',
        name: 'Administrator',
        phone: '12345678910',
        email: 'admin@admin.com',
        password: hashedPwd,
        status: 'Active',
        blocked_reason: '',
        timezone: 'Asia/Jakarta',
      },
      { email_verified_at: 'CURRENT_TIMESTAMP', ...NOW },
    );
    console.log('Admin user seeded: admin@admin.com / 12345678');
  }

  // Link user <-> role (idempotent, dicek terpisah agar aman di DB lama yang
  // punya user tapi belum punya relasi)
  const existingLink: Array<{ user_id: string }> = await em.query(
    `SELECT ${escape(em, 'user_id')} FROM ${escape(em, 'users_roles')} WHERE ${escape(em, 'user_id')} = ${param(em, 0)} AND ${escape(em, 'role_id')} = ${param(em, 1)} LIMIT 1`,
    [userId, roleId],
  );
  if (existingLink.length === 0) {
    await insertRow(em, 'users_roles', { user_id: userId, role_id: roleId });
    console.log('Admin user linked to Administrator role');
  }
}
