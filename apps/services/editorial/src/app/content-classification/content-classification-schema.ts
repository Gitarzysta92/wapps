import { TableColumn, type Table } from 'typeorm';

export const CLASSIFICATION_TABLES = [
  'app_records',
  'application_drafts',
  'application_submissions',
  'private_suites',
  'suite_submissions',
  'suite_publications',
] as const;

export function classificationColumn(): TableColumn {
  return new TableColumn({
    name: 'classification',
    type: 'varchar',
    length: '7',
    charset: 'utf8mb4',
    collation: 'utf8mb4_bin',
    isNullable: true,
  });
}

/** Older migration validators also accept the exact additive column after upgrade. */
export function includeClassificationColumn(expected: Table, actual?: Table) {
  if (
    CLASSIFICATION_TABLES.some((name) => name === expected.name) &&
    actual?.findColumnByName('classification')
  )
    expected.addColumn(classificationColumn());
}
