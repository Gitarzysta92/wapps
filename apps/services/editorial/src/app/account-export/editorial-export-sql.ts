import type { MysqlSnapshotReader } from '@sdk/extras/mysql';
import {
  AccountExportSourceInvalid,
  type AccountExportEntry,
} from '@sdk/features/identity/core';
import {
  isEditorialResourceId,
  isEditorialScope,
} from '../application/editorial-materialization';

export type ExportRow = Record<string, unknown>;
export interface EditorialExportContext {
  reader: MysqlSnapshotReader;
  owner: string;
  signal: AbortSignal;
  entry(collection: string, data: unknown): AccountExportEntry;
}
export function invalidExport(): never {
  throw new AccountExportSourceInvalid(
    'Invalid canonical Editorial export data'
  );
}
export function decodeExport<T>(operation: () => T): T {
  try {
    return operation();
  } catch {
    return invalidExport();
  }
}
export function exportId(value: unknown): string {
  if (!isEditorialResourceId(value)) return invalidExport();
  return value;
}
export function exportScope(value: unknown): string {
  if (!isEditorialScope(value)) return invalidExport();
  return value;
}
export function exportInteger(value: unknown, minimum = 0): number {
  const number =
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (
    typeof number !== 'number' ||
    !Number.isSafeInteger(number) ||
    number < minimum
  )
    return invalidExport();
  return number;
}
export function exportNullableInteger(
  value: unknown,
  minimum = 0
): number | null {
  return value === null ? null : exportInteger(value, minimum);
}
export function exportJson(value: unknown): unknown {
  return decodeExport(() =>
    typeof value === 'string' ? JSON.parse(value) : value
  );
}
export function exportText(value: unknown, maximum: number): string {
  if (typeof value !== 'string' || value.length > maximum)
    return invalidExport();
  return value;
}
export function exportChoice<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T {
  for (const candidate of allowed) if (candidate === value) return candidate;
  return invalidExport();
}
export function exportOwner(
  row: ExportRow,
  owner: string,
  field = 'ownerIdentityId'
): string {
  if (row[field] !== owner) return invalidExport();
  return exportScope(row.tenantId);
}
export function exportDraftMetadata(row: ExportRow, owner: string) {
  const createdAt = exportInteger(row.createdAt),
    updatedAt = exportInteger(row.updatedAt),
    deletedAt = exportNullableInteger(row.deletedAt);
  if (updatedAt < createdAt) return invalidExport();
  return {
    id: exportId(row.id),
    tenantId: exportOwner(row, owner),
    revision: exportInteger(row.revision, 1),
    createdAt,
    updatedAt,
    deletedAt,
  };
}

/** Query text and key definitions are static adapter code; callers supply only parameter values. */
export async function* exportRows(
  reader: MysqlSnapshotReader,
  sql: string,
  parameters: unknown[],
  keys: { column: string; field: string }[]
): AsyncIterable<ExportRow> {
  let after: unknown[] | null = null;
  for (;;) {
    const rows: ExportRow[] = await reader.query(
      `${sql}${
        after
          ? ` AND (${keys.map((key) => key.column).join(',')}) > (${keys
              .map(() => '?')
              .join(',')})`
          : ''
      } ORDER BY ${keys.map((key) => key.column).join(',')} LIMIT 128`,
      [...parameters, ...(after ?? [])]
    );
    for (const row of rows) yield row;
    if (rows.length < 128) return;
    const last = rows[rows.length - 1];
    after = keys.map((key) => {
      const value = last[key.field];
      if (
        (typeof value !== 'string' || !value) &&
        (typeof value !== 'number' || !Number.isSafeInteger(value))
      )
        return invalidExport();
      return value;
    });
  }
}
export const exportKey = (
  column: string,
  field = column.split('.').slice(-1)[0] ?? column
) => [{ column, field }];
