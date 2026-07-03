import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateSessionTable1782815996498 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'sessions',
        columns: [
          { name: 'id', type: 'varchar', length: '128', isPrimary: true },
          { name: 'data', type: 'text' },
          // 'timestamp' portabel lintas MySQL/Postgres/SQLite ('datetime' invalid di Postgres)
          { name: 'expires_at', type: 'timestamp' },
        ],
      }),
      true,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('sessions', true);
  }
}
