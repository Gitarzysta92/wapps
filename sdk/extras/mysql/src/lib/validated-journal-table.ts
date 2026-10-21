import type { QueryRunner } from 'typeorm';

export interface JournalTableDefinition {
  name: string;
  migration: string;
  create: string;
  columns: Record<
    string,
    {
      type: string;
      nullable?: boolean;
      collation?: string;
      initial?: string;
    }
  >;
  indexes: Record<string, { columns: string[]; unique: boolean }>;
}

/** New journal installation is restartable; recorded schema loss requires explicit repair. */
export async function ensureJournalTable(
  runner: QueryRunner,
  definition: JournalTableDefinition
): Promise<void> {
  const history = runner.connection.options.migrationsTableName ?? 'migrations';
  const applied: unknown[] = (await runner.hasTable(history))
    ? await runner.query(
        `SELECT name FROM ${runner.connection.driver.escape(
          history
        )} WHERE name=?`,
        [definition.migration]
      )
    : [];
  if (!(await runner.hasTable(definition.name))) {
    if (applied.length)
      throw new Error(`Applied journal ${definition.name} is missing`);
    await runner.query(definition.create);
  }
  const columns: {
    name: string;
    type: string;
    nullable: string;
    collation: string | null;
    initial: string | null;
    extra: string;
    engine: string;
  }[] = await runner.query(
    'SELECT c.COLUMN_NAME name,c.COLUMN_TYPE type,c.IS_NULLABLE nullable,c.COLLATION_NAME collation,c.COLUMN_DEFAULT initial,c.EXTRA extra,t.ENGINE engine FROM information_schema.COLUMNS c JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME WHERE c.TABLE_SCHEMA=DATABASE() AND c.TABLE_NAME=?',
    [definition.name]
  );
  if (columns.length !== Object.keys(definition.columns).length)
    throw new Error(`Unexpected journal columns in ${definition.name}`);
  for (const row of columns) {
    const expected = definition.columns[row.name];
    if (
      !expected ||
      row.type !== expected.type ||
      (row.nullable === 'YES') !== !!expected.nullable ||
      row.collation !== (expected.collation ?? null) ||
      row.initial !== (expected.initial ?? null) ||
      row.extra !== '' ||
      row.engine !== 'InnoDB'
    )
      throw new Error(
        `Incompatible journal column ${definition.name}.${row.name}`
      );
  }
  const indexes: {
    name: string;
    column: string;
    position: number | string;
    nonUnique: number | string;
    prefix: number | null;
    visible: string;
    direction: string;
  }[] = await runner.query(
    'SELECT INDEX_NAME name,COLUMN_NAME `column`,SEQ_IN_INDEX position,NON_UNIQUE nonUnique,SUB_PART prefix,IS_VISIBLE visible,COLLATION direction FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY INDEX_NAME,SEQ_IN_INDEX',
    [definition.name]
  );
  if (
    new Set(indexes.map((row) => row.name)).size !==
    Object.keys(definition.indexes).length
  )
    throw new Error(`Unexpected journal indexes in ${definition.name}`);
  for (const [name, expected] of Object.entries(definition.indexes)) {
    const rows = indexes.filter((row) => row.name === name);
    if (
      rows.length !== expected.columns.length ||
      rows.some(
        (row, i) =>
          row.column !== expected.columns[i] ||
          Number(row.position) !== i + 1 ||
          Number(row.nonUnique) !== (expected.unique ? 0 : 1) ||
          row.prefix !== null ||
          row.visible !== 'YES' ||
          row.direction !== 'A'
      )
    )
      throw new Error(`Incompatible journal index ${definition.name}.${name}`);
  }
  const triggers: unknown[] = await runner.query(
    'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE=?',
    [definition.name]
  );
  const foreignKeys: unknown[] = await runner.query(
    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_TYPE IN ('FOREIGN KEY','CHECK')",
    [definition.name]
  );
  if (triggers.length || foreignKeys.length)
    throw new Error(`Unexpected journal constraints in ${definition.name}`);
}
