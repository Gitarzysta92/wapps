import {
  classificationFields,
  type ClassifiedContent,
} from '@domains/publication/classification';
import {
  parseApplicationImageSet,
  type ApplicationImageSet,
} from '@domains/catalog/media';

export const APPLICATION_DRAFT_LIMIT = 100;

export interface ApplicationDraftFields extends ClassifiedContent {
  name: string;
  slug: string;
  website: string;
  description: string;
}
export interface ApplicationDraft extends ApplicationDraftFields {
  images?: ApplicationImageSet;
  id: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  editing?: ApplicationEditingTarget;
}
export interface ApplicationEditingTarget {
  applicationId: string;
  claimId: string;
  sourcePublicationRevision: number;
}
export interface ApplicationEditingSource extends ApplicationEditingTarget {
  images?: ApplicationImageSet;
  fields: ApplicationDraftFields;
}
export interface ApplicationDraftReceipt {
  id: string;
  revision: number;
  deleted: boolean;
}
export class ApplicationDraftInputError extends Error {}
export class ApplicationDraftConflictError extends Error {}
export class ApplicationDraftNotFoundError extends Error {}
export class ApplicationDraftUnavailableError extends Error {}

export function applicationDraftObject(
  input: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !keys.includes(key))
  )
    throw new ApplicationDraftInputError('Invalid application draft fields');
  return Object.fromEntries(Object.entries(input));
}
export function applicationDraftId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      value
    )
  )
    throw new ApplicationDraftInputError('Invalid application draft ID');
  return value;
}
export function applicationDraftRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1)
    throw new ApplicationDraftInputError(
      'A valid expectedRevision is required'
    );
  return value;
}
export function isApplicationDraftSlug(value: string): boolean {
  return value.length <= 80 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
export function isApplicationDraftUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      value.length <= 2048 &&
      !/\s/.test(value) &&
      ['http:', 'https:'].includes(url.protocol) &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function text(value: unknown, min: number, max: number, label: string): string {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.trim().length > max ||
    [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
    })
  )
    throw new ApplicationDraftInputError(
      `Use ${label} of ${min}-${max} characters`
    );
  return value.trim();
}
export function parseApplicationDraftFields(
  input: unknown
): ApplicationDraftFields {
  const value = applicationDraftObject(input, [
    'name',
    'slug',
    'website',
    'description',
    'classification',
  ]);
  const name = text(value['name'], 2, 100, 'an application name');
  const slug = text(value['slug'], 1, 80, 'a slug');
  const website = text(value['website'], 1, 2048, 'a website URL');
  const description = text(value['description'], 20, 2000, 'a description');
  if (!isApplicationDraftSlug(slug))
    throw new ApplicationDraftInputError(
      'Use lowercase letters, numbers and single hyphens for the slug'
    );
  if (!isApplicationDraftUrl(website))
    throw new ApplicationDraftInputError(
      'Use a complete HTTP or HTTPS website without credentials or whitespace'
    );
  return {
    name,
    slug,
    website,
    description,
    ...classificationFields(
      value['classification'],
      ApplicationDraftInputError
    ),
  };
}
export function parseApplicationDraft(input: unknown): ApplicationDraft {
  const value = applicationDraftObject(input, [
    'id',
    'revision',
    'name',
    'slug',
    'website',
    'description',
    'classification',
    'createdAt',
    'updatedAt',
    'editing',
    'images',
  ]);
  const createdAt = applicationDraftRevision(value['createdAt']);
  const updatedAt = applicationDraftRevision(value['updatedAt']);
  if (createdAt > updatedAt || updatedAt > 8_640_000_000_000_000)
    throw new ApplicationDraftInputError(
      'Invalid application draft timestamps'
    );
  return {
    ...parseApplicationDraftFields({
      name: value['name'],
      slug: value['slug'],
      website: value['website'],
      description: value['description'],
      classification: value['classification'],
    }),
    id: applicationDraftId(value['id']),
    revision: applicationDraftRevision(value['revision']),
    createdAt,
    updatedAt,
    ...(value['images'] === undefined
      ? {}
      : { images: parseApplicationImageSet(value['images']) }),
    ...(value['editing'] === undefined
      ? {}
      : { editing: parseApplicationEditingTarget(value['editing']) }),
  };
}
export function parseApplicationEditingTarget(
  input: unknown
): ApplicationEditingTarget {
  const value = applicationDraftObject(input, [
    'applicationId',
    'claimId',
    'sourcePublicationRevision',
  ]);
  return {
    applicationId: applicationDraftId(value['applicationId']),
    claimId: applicationDraftId(value['claimId']),
    sourcePublicationRevision: applicationDraftRevision(
      value['sourcePublicationRevision']
    ),
  };
}
/** Existing catalog content may need corrections before it meets new-draft validation. */
export function parseApplicationEditingSource(
  input: unknown
): ApplicationEditingSource {
  const value = applicationDraftObject(input, [
    'applicationId',
    'claimId',
    'sourcePublicationRevision',
    'fields',
    'images',
  ]);
  const fields = applicationDraftObject(value['fields'], [
    'name',
    'slug',
    'website',
    'description',
    'classification',
  ]);
  const readText = (key: string, limit: number) => {
    const content = fields[key];
    if (typeof content !== 'string' || content.length > limit)
      throw new ApplicationDraftInputError(
        'Invalid canonical application content'
      );
    return content;
  };
  return {
    ...parseApplicationEditingTarget({
      applicationId: value['applicationId'],
      claimId: value['claimId'],
      sourcePublicationRevision: value['sourcePublicationRevision'],
    }),
    ...(value['images'] === undefined
      ? {}
      : { images: parseApplicationImageSet(value['images']) }),
    fields: {
      name: readText('name', 255),
      slug: readText('slug', 255),
      website: readText('website', 2048),
      description: readText('description', 65536),
      ...classificationFields(
        fields['classification'],
        ApplicationDraftInputError
      ),
    },
  };
}
export function parseApplicationDraftReceipt(
  input: unknown
): ApplicationDraftReceipt {
  const value = applicationDraftObject(input, ['id', 'revision', 'deleted']);
  if (typeof value['deleted'] !== 'boolean')
    throw new ApplicationDraftInputError('Invalid draft receipt');
  return {
    id: applicationDraftId(value['id']),
    revision: applicationDraftRevision(value['revision']),
    deleted: value['deleted'],
  };
}
export function parseApplicationDraftList(input: unknown): ApplicationDraft[] {
  if (!Array.isArray(input) || input.length > APPLICATION_DRAFT_LIMIT)
    throw new ApplicationDraftInputError('Invalid application draft list');
  const items = input.map(parseApplicationDraft);
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    new Set(items.map((item) => item.slug)).size !== items.length
  )
    throw new ApplicationDraftInputError('Duplicate application draft');
  return items;
}
