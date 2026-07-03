import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddGuardNameFavicon1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const rolesHasGuardName = await queryRunner.hasColumn(
      'roles',
      'guard_name',
    );
    if (!rolesHasGuardName) {
      await queryRunner.addColumn(
        'roles',
        new TableColumn({
          name: 'guard_name',
          type: 'varchar',
          length: '20',
          default: "'web'",
          isNullable: false,
        }),
      );
    }

    const settingsHasFavicon = await queryRunner.hasColumn(
      'settings',
      'favicon',
    );
    if (!settingsHasFavicon) {
      await queryRunner.addColumn(
        'settings',
        new TableColumn({
          name: 'favicon',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const settingsHasFavicon = await queryRunner.hasColumn(
      'settings',
      'favicon',
    );
    if (settingsHasFavicon) await queryRunner.dropColumn('settings', 'favicon');

    const rolesHasGuardName = await queryRunner.hasColumn(
      'roles',
      'guard_name',
    );
    if (rolesHasGuardName) await queryRunner.dropColumn('roles', 'guard_name');
  }
}
