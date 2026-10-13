import { ProfileContractError } from './private-profile';
import { isPublicProfileId } from './public-profile';

export const PROFILE_ACTIVITY_PAGE_SIZE = 10;
export const PROFILE_ACTIVITY_KINDS = [
  'application',
  'suite',
  'article',
  'release',
  'discussion',
  'reply',
  'comment',
  'review',
  'favorite-application',
  'favorite-suite',
  'favorite-article',
  'favorite-discussion',
] as const;
export type ProfileActivityKind = (typeof PROFILE_ACTIVITY_KINDS)[number];
export type ProfileActivityTarget =
  | { kind: 'application' | 'article'; id: string; slug: string }
  | { kind: 'suite'; id: string }
  | { kind: 'discussion' | 'review'; id: string; applicationSlug: string }
  | { kind: 'comment'; id: string; articleSlug: string }
  | { kind: 'release'; id: string; applicationSlug: string; version: string };
export interface ProfileActivity {
  kind: ProfileActivityKind;
  id: string;
  at: number;
  title: string;
  target: ProfileActivityTarget;
}
export interface ProfileActivityPosition {
  at: number;
  key: string;
}
/** Internal service contract. A cutoff includes hidden candidates and is never public. */
export interface ProfileActivityBatch {
  items: ProfileActivity[];
  through: ProfileActivityPosition | null;
}
export interface ProfileActivityPage {
  sharing: 'visible' | 'hidden';
  items: ProfileActivity[];
  after: string | null;
}
export interface ProfileActivitySharing {
  suites: boolean;
  discussions: boolean;
  favorites: boolean;
}

export function profileActivityRequest(input: unknown) {
  const row = activityObject(input, ['ownerIdentityId', 'after', 'sharing']);
  const ownerIdentityId = row['ownerIdentityId'];
  requireValue(
    typeof ownerIdentityId === 'string' &&
      ownerIdentityId.length > 0 &&
      ownerIdentityId.length <= 128 &&
      ownerIdentityId.trim() === ownerIdentityId &&
    !hasControlCharacters(ownerIdentityId)
  );
  return {
    ownerIdentityId,
    after: row['after'] === null ? null : profileActivityPosition(row['after']),
    sharing: profileActivitySharing(row['sharing']),
  };
}

function requireValue(value: unknown): asserts value {
  if (!value) throw new ProfileContractError('Invalid profile activity');
}
function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}
export function activityObject(
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
function timestamp(input: unknown): number {
  requireValue(
    typeof input === 'number' &&
      Number.isSafeInteger(input) &&
      input > 0 &&
      input <= 8_640_000_000_000_000
  );
  return input;
}
function id(input: unknown): string {
  requireValue(isPublicProfileId(input));
  return input;
}
function slug(input: unknown): string {
  requireValue(
    typeof input === 'string' &&
      input.length <= 255 &&
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input)
  );
  return input;
}
function kind(input: unknown): ProfileActivityKind {
  requireValue(
    typeof input === 'string' &&
      PROFILE_ACTIVITY_KINDS.some((value) => value === input)
  );
  return input as ProfileActivityKind;
}
export function profileActivityPosition(
  input: unknown
): ProfileActivityPosition {
  const row = activityObject(input, ['at', 'key']);
  requireValue(typeof row['key'] === 'string');
  const [name, value, extra] = row['key'].split(':');
  requireValue(extra === undefined);
  return { at: timestamp(row['at']), key: `${kind(name)}:${id(value)}` };
}
export function activityPosition(
  item: ProfileActivity
): ProfileActivityPosition {
  return { at: item.at, key: `${item.kind}:${item.id}` };
}
export function compareActivity(
  a: ProfileActivityPosition,
  b: ProfileActivityPosition
): number {
  return b.at - a.at || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}
export function parseProfileActivity(input: unknown): ProfileActivity {
  const row = activityObject(input, ['kind', 'id', 'at', 'title', 'target']);
  const name = kind(row['kind']);
  const targetKind =
    name === 'reply'
      ? 'discussion'
      : name.startsWith('favorite-')
      ? name.slice(9)
      : name;
  const fields =
    targetKind === 'suite'
      ? []
      : targetKind === 'application' || targetKind === 'article'
      ? ['slug']
      : targetKind === 'comment'
      ? ['articleSlug']
      : targetKind === 'release'
      ? ['applicationSlug', 'version']
      : ['applicationSlug'];
  const target = activityObject(row['target'], ['kind', 'id', ...fields]);
  requireValue(target['kind'] === targetKind);
  const parsed: Record<string, unknown> = {
    kind: targetKind,
    id: id(target['id']),
  };
  for (const field of fields) {
    if (field === 'version') {
      const value = target[field];
      requireValue(
        typeof value === 'string' &&
          /^[a-zA-Z0-9][a-zA-Z0-9.+_-]{0,79}$/.test(value)
      );
      parsed[field] = value;
    } else parsed[field] = slug(target[field]);
  }
  const title = row['title'];
  requireValue(
    typeof title === 'string' &&
      title.trim() === title &&
      title.length > 0 &&
      title.length <= 255 &&
    !hasControlCharacters(title)
  );
  const itemId = id(row['id']);
  requireValue(
    name === 'comment' || name === 'reply' || parsed['id'] === itemId
  );
  return {
    kind: name,
    id: itemId,
    at: timestamp(row['at']),
    title,
    target: parsed as unknown as ProfileActivityTarget,
  };
}
function items(input: unknown): ProfileActivity[] {
  requireValue(
    Array.isArray(input) && input.length <= PROFILE_ACTIVITY_PAGE_SIZE
  );
  const result = input.map(parseProfileActivity);
  requireValue(
    new Set(result.map((item) => activityPosition(item).key)).size ===
      result.length
  );
  requireValue(
    result.every(
      (item, i) =>
        i === 0 ||
        compareActivity(
          activityPosition(result[i - 1]),
          activityPosition(item)
        ) < 0
    )
  );
  return result;
}
export function profileActivityCursor(input: unknown): string | null {
  if (input === null) return null;
  requireValue(
    typeof input === 'string' && /^a1\.[A-Za-z0-9_-]{40,256}$/.test(input)
  );
  return input;
}
export function parseProfileActivityBatch(
  input: unknown
): ProfileActivityBatch {
  const row = activityObject(input, ['items', 'through']);
  const result = items(row['items']);
  const through =
    row['through'] === null ? null : profileActivityPosition(row['through']);
  requireValue(
    !through ||
      result.every(
        (item) => compareActivity(activityPosition(item), through) <= 0
      )
  );
  return { items: result, through };
}
export function parseProfileActivityPage(input: unknown): ProfileActivityPage {
  const row = activityObject(input, ['sharing', 'items', 'after']);
  requireValue(row['sharing'] === 'visible' || row['sharing'] === 'hidden');
  const result = items(row['items']),
    after = profileActivityCursor(row['after']);
  requireValue(
    row['sharing'] === 'visible' || (!result.length && after === null)
  );
  return { sharing: row['sharing'], items: result, after };
}
export function profileActivitySharing(input: unknown): ProfileActivitySharing {
  const row = activityObject(input, ['suites', 'discussions', 'favorites']);
  requireValue(
    typeof row['suites'] === 'boolean' &&
      typeof row['discussions'] === 'boolean' &&
      typeof row['favorites'] === 'boolean'
  );
  return {
    suites: row['suites'],
    discussions: row['discussions'],
    favorites: row['favorites'],
  };
}
export function activityIsShared(
  item: ProfileActivity,
  sharing: ProfileActivitySharing
): boolean {
  return (
    (!item.kind.startsWith('favorite-') || sharing.favorites) &&
    (item.target.kind !== 'suite' || sharing.suites) &&
    (!['discussion', 'comment'].includes(item.target.kind) ||
      sharing.discussions)
  );
}
/** Stop at the first unfinished source boundary; advancing farther could skip unseen items. */
export function mergeProfileActivity(
  batches: ProfileActivityBatch[],
  after: ProfileActivityPosition | null
): ProfileActivityBatch {
  requireValue(batches.length <= 3);
  const checked = batches.map(parseProfileActivityBatch);
  const cutoffs = checked
    .flatMap((batch) => (batch.through ? [batch.through] : []))
    .sort(compareActivity);
  const cutoff = cutoffs[0] ?? null;
  const all = checked
    .flatMap((batch) => batch.items)
    .sort((a, b) => compareActivity(activityPosition(a), activityPosition(b)));
  requireValue(
    new Set(all.map((item) => activityPosition(item).key)).size === all.length
  );
  requireValue(
    !after ||
      [...all.map(activityPosition), ...cutoffs].every(
        (point) => compareActivity(after, point) < 0
      )
  );
  const eligible = all.filter(
    (item) => !cutoff || compareActivity(activityPosition(item), cutoff) <= 0
  );
  const selected = eligible.slice(0, PROFILE_ACTIVITY_PAGE_SIZE);
  return {
    items: selected,
    through:
      eligible.length > PROFILE_ACTIVITY_PAGE_SIZE
        ? activityPosition(selected[selected.length - 1])
        : cutoff,
  };
}
