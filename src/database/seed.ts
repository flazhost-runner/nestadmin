import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import dataSource from '../config/ormconfig';
import { seedInitialData } from './seeder';

// Script seed standalone (dipakai Docker entrypoint). Logika seed yang
// sebenarnya ada di src/database/seeder.ts dan juga dijalankan oleh
// migration AddAdminUser1782816000000 — keduanya idempoten, jadi aman
// dijalankan dalam urutan apa pun.
async function seed() {
  await dataSource.initialize();
  try {
    await seedInitialData(dataSource.manager);
  } finally {
    await dataSource.destroy();
  }
  console.log('Seed complete');
}

seed().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
