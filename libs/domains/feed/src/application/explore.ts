import {
  classificationFields,
  type ClassifiedContent,
} from '@domains/publication/classification';
import { parseActivityDetails, type ActivityDetails } from './explore-details';

export const EXPLORE_PAGE_SIZE = 10;
export const EXPLORE_KINDS = [
  'application',
  'suite',
  'article',
  'release',
  'discussion',
  'review',
] as const;
export type ExploreKind = (typeof EXPLORE_KINDS)[number];
export const EXPLORE_READER = 'wapps-explore-reader';
export const EXPLORE_READER_ROLE = 'explore:reader';
export const EXPLORE_READER_SCOPE = 'explore';

export class ExploreInputError extends Error {}
export class ExploreUnavailableError extends Error {}

export interface ExplorePosition {
  at: number;
  key: string;
}
export type ExploreTarget =
  | { kind: 'application' | 'article'; id: string; slug: string }
  | { kind: 'suite'; id: string }
  | {
      kind: 'discussion' | 'review';
      id: string;
      applicationId: string;
      applicationSlug: string;
    }
  | {
      kind: 'release';
      id: string;
      applicationId: string;
      applicationSlug: string;
      version: string;
    };
export interface ExploreItem extends ClassifiedContent {
  details?: ActivityDetails;
  kind: ExploreKind;
  id: string;
  at: number;
  title: string;
  target: ExploreTarget;
  categories: string[];
  tags: string[];
  engagement: number | null;
}
/** Internal scan boundary may refer to hidden content; transport must never expose it publicly. */
export interface ExploreBatch {
  items: ExploreItem[];
  through: ExplorePosition | null;
}
export interface ExplorePage {
  items: ExploreItem[];
  after: string | null;
}
export interface ExploreSource {
  read(
    after: ExplorePosition | null,
    selectedKind?: ExploreKind,
    applicationId?: string
  ): Promise<ExploreBatch>;
}
export interface ExploreCursors {
  open(token: string): ExplorePosition;
  seal(position: ExplorePosition): string;
}

function requireValue(condition: unknown): asserts condition {
  if (!condition) throw new ExploreInputError('Invalid Explore data');
}
export function exploreObject(
  input: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  requireValue(
    input !== null && typeof input === 'object' && !Array.isArray(input)
  );
  requireValue(
    Object.keys(input).length === keys.length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(input, key))
  );
  return input as Record<string, unknown>;
}
export function exploreId(value: unknown): string {
  requireValue(
    typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        value
      )
  );
  return value;
}
function kind(value: unknown): ExploreKind {
  requireValue(EXPLORE_KINDS.some((k) => k === value));
  return value as ExploreKind;
}
function timestamp(value: unknown): number {
  requireValue(
    typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value > 0 &&
      value <= 8_640_000_000_000_000
  );
  return value;
}
function text(value: unknown, max: number): string {
  requireValue(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= max &&
      value.trim() === value &&
      ![...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  );
  return value;
}
function slug(value: unknown): string {
  const result = text(value, 255);
  requireValue(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result));
  return result;
}
function identifiers(value: unknown): string[] {
  requireValue(Array.isArray(value) && value.length <= 128);
  const result = value.map((item) => text(item, 255));
  requireValue(new Set(result).size === result.length);
  return result;
}
export function explorePosition(input: unknown): ExplorePosition {
  const row = exploreObject(input, ['at', 'key']);
  requireValue(typeof row['key'] === 'string');
  const [name, id, extra] = row['key'].split(':');
  requireValue(extra === undefined);
  return { at: timestamp(row['at']), key: `${kind(name)}:${exploreId(id)}` };
}
export function parseExploreRead(
  input: unknown,
  allowed: readonly ExploreKind[]
) {
  const selected =
    input !== null && typeof input === 'object' && 'kind' in input;
  const scoped =
    input !== null && typeof input === 'object' && 'applicationId' in input;
  const row = exploreObject(input, [
    'after',
    ...(selected ? ['kind'] : []),
    ...(scoped ? ['applicationId'] : []),
  ]);
  const selectedKind = selected ? kind(row['kind']) : undefined;
  requireValue(!selectedKind || allowed.includes(selectedKind));
  requireValue(!scoped || selectedKind !== 'article');
  return {
    after: row['after'] === null ? null : explorePosition(row['after']),
    selectedKind,
    applicationId: scoped ? exploreId(row['applicationId']) : undefined,
  };
}
export function exploreItemPosition(item: ExploreItem): ExplorePosition {
  return { at: item.at, key: `${item.kind}:${item.id}` };
}
export function compareExplore(a: ExplorePosition, b: ExplorePosition): number {
  return b.at - a.at || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}
export function parseExploreItem(input: unknown): ExploreItem {
  const row = exploreObject(input, [
    'kind',
    'id',
    'at',
    'title',
    'target',
    'categories',
    'tags',
    'engagement',
    ...(input !== null && typeof input === 'object' && 'details' in input
      ? ['details']
      : []),
    ...(input !== null && typeof input === 'object' && 'classification' in input
      ? ['classification']
      : []),
  ]);
  const name = kind(row['kind']),
    id = exploreId(row['id']);
  const fields =
    name === 'suite'
      ? []
      : name === 'application' || name === 'article'
      ? ['slug']
      : name === 'release'
      ? ['applicationId', 'applicationSlug', 'version']
      : ['applicationId', 'applicationSlug'];
  const target = exploreObject(row['target'], ['kind', 'id', ...fields]);
  requireValue(target['kind'] === name && target['id'] === id);
  const parsed: Record<string, unknown> = { kind: name, id };
  for (const field of fields) {
    if (field === 'applicationId') parsed[field] = exploreId(target[field]);
    else if (field === 'version') {
      const version = text(target[field], 80);
      requireValue(/^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,79}$/.test(version));
      parsed[field] = version;
    } else parsed[field] = slug(target[field]);
  }
  const engagement = row['engagement'];
  requireValue(
    engagement === null ||
      (typeof engagement === 'number' && Number.isSafeInteger(engagement))
  );
  requireValue(
    name === 'discussion' || name === 'review' || engagement === null
  );
  requireValue(name !== 'review' || engagement === null || engagement >= 0);
  let details: ActivityDetails | undefined;
  if ('details' in row) {
    try {
      details = parseActivityDetails(row['details'], name);
    } catch {
      throw new ExploreInputError('Invalid activity details');
    }
    requireValue(details.kind !== 'discussion' || details.posts[0].id === id);
  }
  return {
    kind: name,
    id,
    at: timestamp(row['at']),
    title: text(row['title'], 255),
    target: parsed as unknown as ExploreTarget,
    categories: identifiers(row['categories']),
    tags: identifiers(row['tags']),
    engagement,
    ...(details ? { details } : {}),
    ...classificationFields(row['classification'], ExploreInputError),
  };
}
function items(input: unknown): ExploreItem[] {
  requireValue(Array.isArray(input) && input.length <= EXPLORE_PAGE_SIZE);
  const parsed = input.map(parseExploreItem);
  requireValue(
    parsed.every(
      (item, i) =>
        i === 0 ||
        compareExplore(
          exploreItemPosition(parsed[i - 1]),
          exploreItemPosition(item)
        ) < 0
    )
  );
  requireValue(
    new Set(parsed.map((i) => exploreItemPosition(i).key)).size ===
      parsed.length
  );
  return parsed;
}
export function parseExploreBatch(input: unknown): ExploreBatch {
  const row = exploreObject(input, ['items', 'through']),
    result = items(row['items']);
  const through =
    row['through'] === null ? null : explorePosition(row['through']);
  requireValue(
    !through ||
      result.every(
        (item) => compareExplore(exploreItemPosition(item), through) <= 0
      )
  );
  return { items: result, through };
}
export function exploreCursor(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  requireValue(
    typeof input === 'string' && /^e1\.[A-Za-z0-9_-]{40,512}$/.test(input)
  );
  return input;
}
export function parseExplorePage(input: unknown): ExplorePage {
  const row = exploreObject(input, ['items', 'after']);
  requireValue(row['after'] !== undefined);
  return { items: items(row['items']), after: exploreCursor(row['after']) };
}
/** Stop at the earliest unfinished scan, including hidden candidates, so merging cannot skip a source. */
export function mergeExplore(
  batches: readonly ExploreBatch[],
  after: ExplorePosition | null
): ExploreBatch {
  requireValue(batches.length === 2);
  const checked = batches.map(parseExploreBatch);
  const boundaries = checked
    .flatMap((batch) => (batch.through ? [batch.through] : []))
    .sort(compareExplore);
  const cutoff = boundaries[0] ?? null;
  const all = checked
    .flatMap((batch) => batch.items)
    .sort((a, b) =>
      compareExplore(exploreItemPosition(a), exploreItemPosition(b))
    );
  requireValue(
    new Set(all.map((item) => exploreItemPosition(item).key)).size ===
      all.length
  );
  requireValue(
    !after ||
      [...all.map(exploreItemPosition), ...boundaries].every(
        (point) => compareExplore(after, point) < 0
      )
  );
  const eligible = all.filter(
    (item) => !cutoff || compareExplore(exploreItemPosition(item), cutoff) <= 0
  );
  const selected = eligible.slice(0, EXPLORE_PAGE_SIZE);
  return {
    items: selected,
    through:
      eligible.length > EXPLORE_PAGE_SIZE
        ? exploreItemPosition(selected[selected.length - 1])
        : cutoff,
  };
}
