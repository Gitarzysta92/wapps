import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateIdentities1788566400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'identities',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'identity_id', type: 'varchar', length: '255' },
        { name: 'claim', type: 'varchar', length: '255', isUnique: true },
        { name: 'kind', type: 'varchar', length: '64' },
        { name: 'is_active', type: 'boolean', default: true },
        { name: 'is_suspended', type: 'boolean', default: false },
        { name: 'is_deleted', type: 'boolean', default: false },
        { name: 'provider_type', type: 'varchar', length: '64' },
        { name: 'provider_secret', type: 'varchar', length: '255', isNullable: true },
        { name: 'created_at', type: 'bigint' },
        { name: 'updated_at', type: 'bigint' },
        { name: 'deleted_at', type: 'bigint', default: 0 },
      ],
    }), true);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('identities');
  }
}
