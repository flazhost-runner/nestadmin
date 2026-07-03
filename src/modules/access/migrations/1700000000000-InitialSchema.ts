import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // users
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'code', type: 'varchar', length: '20', isNullable: false },
          { name: 'name', type: 'varchar', length: '50', isNullable: false },
          { name: 'phone', type: 'varchar', length: '15', isNullable: true },
          { name: 'email', type: 'varchar', length: '255', isNullable: false },
          { name: 'email_verified_at', type: 'timestamp', isNullable: true },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'password_otp',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'password_otp_expires', type: 'bigint', isNullable: true },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'Active'",
          },
          { name: 'picture', type: 'varchar', length: '255', isNullable: true },
          { name: 'blocked', type: 'boolean', default: false },
          {
            name: 'blocked_reason',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'timezone',
            type: 'varchar',
            length: '255',
            default: "'UTC'",
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({ name: 'users__id', columnNames: ['id'] }),
    );
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'users__code',
        columnNames: ['code'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'users',
      new TableIndex({ name: 'users__name', columnNames: ['name'] }),
    );
    await queryRunner.createIndex(
      'users',
      new TableIndex({ name: 'users__phone', columnNames: ['phone'] }),
    );
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'users__email',
        columnNames: ['email'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'users',
      new TableIndex({ name: 'users__status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'users',
      new TableIndex({ name: 'users__blocked', columnNames: ['blocked'] }),
    );
    await queryRunner.createIndex(
      'users',
      new TableIndex({ name: 'users__timezone', columnNames: ['timezone'] }),
    );

    // roles
    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'guard_name',
            type: 'varchar',
            length: '20',
            default: "'web'",
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'Active'",
          },
          { name: 'desc', type: 'varchar', length: '255', isNullable: true },
          {
            name: 'created_by',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'roles',
      new TableIndex({ name: 'roles__id', columnNames: ['id'] }),
    );
    await queryRunner.createIndex(
      'roles',
      new TableIndex({
        name: 'roles__name',
        columnNames: ['name'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'roles',
      new TableIndex({ name: 'roles__status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'roles',
      new TableIndex({ name: 'roles__desc', columnNames: ['desc'] }),
    );

    // permissions — canonical schema: method NOT NULL, guard_name nullable default 'web'
    await queryRunner.createTable(
      new Table({
        name: 'permissions',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'name', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'guard_name',
            type: 'varchar',
            length: '20',
            isNullable: true,
            default: "'web'",
          },
          { name: 'method', type: 'varchar', length: '255', isNullable: false },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: "'Active'",
          },
          { name: 'desc', type: 'varchar', length: '255', isNullable: true },
          {
            name: 'created_by',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'permissions',
      new TableIndex({ name: 'permissions__id', columnNames: ['id'] }),
    );
    await queryRunner.createIndex(
      'permissions',
      new TableIndex({ name: 'permissions__name', columnNames: ['name'] }),
    );
    await queryRunner.createIndex(
      'permissions',
      new TableIndex({
        name: 'permissions__guard',
        columnNames: ['guard_name'],
      }),
    );
    await queryRunner.createIndex(
      'permissions',
      new TableIndex({ name: 'permissions__method', columnNames: ['method'] }),
    );
    await queryRunner.createIndex(
      'permissions',
      new TableIndex({ name: 'permissions__status', columnNames: ['status'] }),
    );
    await queryRunner.createIndex(
      'permissions',
      new TableIndex({ name: 'permissions__desc', columnNames: ['desc'] }),
    );

    // settings (singleton)
    await queryRunner.createTable(
      new Table({
        name: 'settings',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'initial', type: 'varchar', length: '255', isNullable: true },
          { name: 'name', type: 'varchar', length: '255', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'icon', type: 'varchar', length: '255', isNullable: true },
          { name: 'logo', type: 'varchar', length: '255', isNullable: true },
          { name: 'favicon', type: 'varchar', length: '255', isNullable: true },
          {
            name: 'login_image',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'phone', type: 'varchar', length: '255', isNullable: true },
          { name: 'address', type: 'varchar', length: '255', isNullable: true },
          { name: 'email', type: 'varchar', length: '255', isNullable: true },
          {
            name: 'copyright',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          { name: 'theme', type: 'varchar', length: '20', default: "'Blue'" },
          {
            name: 'fe_template',
            type: 'varchar',
            length: '80',
            default: "'agency-consulting-002-creative-agency'",
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'varchar',
            length: '36',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // users_roles join table
    await queryRunner.createTable(
      new Table({
        name: 'users_roles',
        columns: [
          { name: 'user_id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'role_id', type: 'varchar', length: '36', isPrimary: true },
        ],
      }),
      true,
    );

    // roles_permissions join table
    await queryRunner.createTable(
      new Table({
        name: 'roles_permissions',
        columns: [
          { name: 'role_id', type: 'varchar', length: '36', isPrimary: true },
          {
            name: 'permission_id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('roles_permissions', true);
    await queryRunner.dropTable('users_roles', true);
    await queryRunner.dropTable('settings', true);
    await queryRunner.dropTable('permissions', true);
    await queryRunner.dropTable('roles', true);
    await queryRunner.dropTable('users', true);
  }
}
