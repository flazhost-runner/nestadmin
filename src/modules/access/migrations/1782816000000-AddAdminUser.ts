import { MigrationInterface, QueryRunner } from 'typeorm';
import { seedInitialData } from '../../../database/seeder';

// Mengikuti pola NodeAdmin (AddAdminUser): seed data awal lewat migration
// sehingga `npm run migration:run` saja sudah menghasilkan database siap
// login (admin@admin.com / 12345678) tanpa perlu `npm run seed` terpisah.
// Logika seed ada di src/database/seeder.ts dan idempoten (cek-dulu), jadi
// aman untuk DB yang sudah pernah di-seed oleh script lama.
export class AddAdminUser1782816000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await seedInitialData(queryRunner.manager);
  }

  public async down(): Promise<void> {
    // Seed data dibiarkan; tidak ada rollback (sama seperti NodeAdmin).
  }
}
