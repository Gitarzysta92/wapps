import {
  classificationFields,
  type ClassifiedContent,
} from '@domains/publication/classification';
export const SUITE_LIMITS = {
  title: 100,
  description: 1000,
  members: 50,
  perOwner: 100,
} as const;

export interface SuiteFields extends ClassifiedContent {
  title: string;
  description: string;
  applicationIds: string[];
}
export interface PrivateSuite extends SuiteFields {
  id: string;
  revision: number;
  visibility: 'private';
  createdAt: number;
  updatedAt: number;
}
export interface SuiteReceipt {
  id: string;
  revision: number;
  deleted: boolean;
}
export class SuiteInputError extends Error {}
export class SuiteConflictError extends Error {}
export class SuiteNotFoundError extends Error {}
export class SuiteUnavailableError extends Error {}

export function suiteId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value
    )
  )
    throw new SuiteInputError('Invalid suite or application ID');
  return value;
}

export function suiteRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new SuiteInputError('A valid expectedRevision is required');
  return value;
}

export function suiteObject(
  value: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new SuiteInputError('Invalid suite fields');
  return Object.fromEntries(Object.entries(value));
}

export function parseSuiteFields(value: unknown): SuiteFields {
  const input = suiteObject(value, [
    'title',
    'description',
    'applicationIds',
    'classification',
  ]);
  if (
    typeof input['title'] !== 'string' ||
    !input['title'].trim() ||
    input['title'].trim().length > SUITE_LIMITS.title ||
    typeof input['description'] !== 'string' ||
    input['description'].trim().length > SUITE_LIMITS.description ||
    [...(input['title'] + input['description'])].some((character) => {
      const code = character.charCodeAt(0);
      return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
    })
  )
    throw new SuiteInputError(
      'Use a title of 1-100 characters and a description of at most 1000 characters'
    );
  if (
    !Array.isArray(input['applicationIds']) ||
    input['applicationIds'].length < 1 ||
    input['applicationIds'].length > SUITE_LIMITS.members
  )
    throw new SuiteInputError('Select between 1 and 50 applications');
  const applicationIds = input['applicationIds'].map(suiteId);
  if (new Set(applicationIds).size !== applicationIds.length)
    throw new SuiteInputError('An application can only appear once in a suite');
  return {
    title: input['title'].trim(),
    description: input['description'].trim(),
    applicationIds,
    ...classificationFields(input['classification'], SuiteInputError),
  };
}

export function parsePrivateSuite(value: unknown): PrivateSuite {
  const input = suiteObject(value, [
    'id',
    'revision',
    'visibility',
    'title',
    'description',
    'applicationIds',
    'classification',
    'createdAt',
    'updatedAt',
  ]);
  const fields = parseSuiteFields({
    title: input['title'],
    description: input['description'],
    applicationIds: input['applicationIds'],
    classification: input['classification'],
  });
  if (
    input['visibility'] !== 'private' ||
    typeof input['createdAt'] !== 'number' ||
    typeof input['updatedAt'] !== 'number' ||
    !Number.isSafeInteger(input['createdAt']) ||
    input['createdAt'] < 0 ||
    !Number.isSafeInteger(input['updatedAt']) ||
    input['updatedAt'] < input['createdAt']
  )
    throw new SuiteInputError('Invalid suite snapshot');
  return {
    ...fields,
    id: suiteId(input['id']),
    revision: suiteRevision(input['revision']),
    visibility: 'private',
    createdAt: input['createdAt'],
    updatedAt: input['updatedAt'],
  };
}

export function parseSuiteReceipt(value: unknown): SuiteReceipt {
  const input = suiteObject(value, ['id', 'revision', 'deleted']);
  if (typeof input['deleted'] !== 'boolean')
    throw new SuiteInputError('Invalid suite receipt');
  return {
    id: suiteId(input['id']),
    revision: suiteRevision(input['revision']),
    deleted: input['deleted'],
  };
}
