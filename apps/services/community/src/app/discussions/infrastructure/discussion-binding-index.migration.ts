import { TableIndex, type MigrationInterface, type QueryRunner } from 'typeorm';

/** Additive lookup index; canonical rows, receipts and immutable payloads are unchanged. */
export class DiscussionBindingIndex1792150000000 implements MigrationInterface {
  transaction = false;
  async up(runner: QueryRunner): Promise<void> {
    const name = 'discussion_write_aggregates';
    const table = await runner.getTable(name);
    if (!table?.findColumnByName('bindingKey'))
      throw new Error('Run discussion binding migration first');
    const columns = ['tenantId', 'bindingKey', 'pinned', 'createdAt', 'id'];
    const existing = table.indices.find(
      (index) => index.name === 'discussion_binding_page'
    );
    if (existing) {
      if (
        existing.isUnique ||
        JSON.stringify(existing.columnNames) !== JSON.stringify(columns)
      )
        throw new Error('Incompatible discussion binding index');
      return;
    }
    await runner.createIndex(
      name,
      new TableIndex({ name: 'discussion_binding_page', columnNames: columns })
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    const table = await runner.getTable('discussion_write_aggregates');
    if (
      table?.indices.some((index) => index.name === 'discussion_binding_page')
    )
      await runner.dropIndex(
        'discussion_write_aggregates',
        'discussion_binding_page'
      );
  }
}
