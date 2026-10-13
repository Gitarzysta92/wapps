import {
  EditorialFields,
  EditorialResourceKind,
  EditorialValidationError,
} from './editorial.ports';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resourceId(value: unknown): string {
  if (typeof value !== 'string' || !uuid.test(value))
    throw new EditorialValidationError('A valid resource UUID is required');
  return value.toLowerCase();
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new EditorialValidationError('A command object is required');
  return Object.fromEntries(Object.entries(value));
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new EditorialValidationError(`Invalid ${field}`);
  return value.trim();
}

function url(value: unknown, field: string): string | null {
  if (value === null) return null;
  const result = text(value, field, field === 'website' ? 2048 : 255);
  try {
    const parsed = new URL(result);
    if (
      !['https:', 'http:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new Error('Invalid URL');
  } catch {
    throw new EditorialValidationError(
      `${field} must be an HTTP(S) URL without credentials`
    );
  }
  return result;
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new EditorialValidationError(
      'Reference lists must contain at most 50 UUIDs'
    );
  const result = value.map(resourceId).sort();
  if (new Set(result).size !== result.length)
    throw new EditorialValidationError('Duplicate references are not allowed');
  return result;
}

export function parseEditorialInput(
  kind: EditorialResourceKind,
  type: 'create' | 'update' | 'delete',
  value: unknown
): { fields: EditorialFields; expectedRevision?: number } {
  const input = record(value);
  const allowed = type === 'delete' ? [] : ['name', 'slug'];
  if (type !== 'delete' && kind === 'app')
    allowed.push(
      'description',
      'website',
      'logoUrl',
      'bannerUrl',
      'isPwa',
      'categoryId',
      'tagIds',
      'platformIds',
      'deviceIds',
      'monetizationModelIds'
    );
  if (type !== 'delete' && kind === 'category') allowed.push('parentId');
  if (type !== 'create') allowed.push('expectedRevision');
  if (Object.keys(input).some((key) => !allowed.includes(key)))
    throw new EditorialValidationError('Unknown or protected command field');
  const expectedRevision = input.expectedRevision;
  if (
    type !== 'create' &&
    (typeof expectedRevision !== 'number' ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 1)
  )
    throw new EditorialValidationError(
      'A positive expectedRevision is required'
    );
  const fields: EditorialFields = {};
  if (type === 'create' || 'name' in input)
    fields.name = text(input.name, 'name', 255);
  if (type === 'create' || 'slug' in input) {
    fields.slug = text(input.slug, 'slug', 255);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.slug))
      throw new EditorialValidationError(
        'Slug must use lowercase letters, digits and single hyphens'
      );
  }
  if ('description' in input) {
    if (
      input.description !== null &&
      (typeof input.description !== 'string' ||
        Buffer.byteLength(input.description) > 32768)
    )
      throw new EditorialValidationError(
        'Description exceeds the 32 KiB limit'
      );
    fields.description = input.description;
  }
  for (const field of ['website', 'logoUrl', 'bannerUrl'] as const)
    if (field in input) fields[field] = url(input[field], field);
  if ('isPwa' in input) {
    if (typeof input.isPwa !== 'boolean')
      throw new EditorialValidationError('isPwa must be a boolean');
    fields.isPwa = input.isPwa;
  }
  for (const field of ['parentId', 'categoryId'] as const)
    if (field in input)
      fields[field] = input[field] === null ? null : resourceId(input[field]);
  for (const field of [
    'tagIds',
    'platformIds',
    'deviceIds',
    'monetizationModelIds',
  ] as const)
    if (field in input) fields[field] = ids(input[field]);
  if (type === 'update' && Object.keys(fields).length === 0)
    throw new EditorialValidationError(
      'At least one editable field is required'
    );
  return {
    fields,
    expectedRevision:
      typeof expectedRevision === 'number' ? expectedRevision : undefined,
  };
}
