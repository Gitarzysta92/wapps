import { ProfileContractError } from './private-profile';
import { isPublicProfileId } from './public-profile';

export const PROFILE_BADGE_KINDS = ['verified', 'premium'] as const;
export type ProfileBadgeKind = (typeof PROFILE_BADGE_KINDS)[number];
export const PROFILE_BADGE_HISTORY_SIZE = 20;
export interface ProfileBadgeState {
  kind: ProfileBadgeKind;
  revision: number;
  active: boolean;
  awardedAt: number;
  updatedAt: number;
}
export interface ProfileBadgeSnapshot {
  profileId: string;
  revision: number;
  badges: ProfileBadgeState[];
}
export interface ProfileBadgeChange {
  expectedRevision: number;
  kind: ProfileBadgeKind;
  action: 'award' | 'revoke';
  reason: string;
}
export interface ProfileBadgeEvent {
  profileId: string;
  revision: number;
  kind: ProfileBadgeKind;
  action: 'award' | 'revoke';
  reason: string | null;
  actorId: string | null;
  at: number;
}
export interface ProfileBadgeAdministration extends ProfileBadgeSnapshot {
  name: string;
  active: boolean;
  events: ProfileBadgeEvent[];
  after: number | null;
}
export interface SharedProfileBadges {
  sharing: 'visible' | 'hidden';
  items: { kind: ProfileBadgeKind; awardedAt: number }[];
}
export class ProfileBadgeConflict extends Error {}

function requireBadge(value: unknown): asserts value {
  if (!value) throw new ProfileContractError('Invalid profile badges');
}
export function badgeObject(
  input: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  requireBadge(
    input !== null && typeof input === 'object' && !Array.isArray(input)
  );
  requireBadge(
    Object.keys(input).length === keys.length &&
      keys.every((key) => Object.prototype.hasOwnProperty.call(input, key))
  );
  return input as Record<string, unknown>;
}
export function badgeRevision(value: unknown, minimum = 0): number {
  requireBadge(
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
  );
  return value;
}
function at(value: unknown) {
  const result = badgeRevision(value, 1);
  requireBadge(result <= 8_640_000_000_000_000);
  return result;
}
function kind(value: unknown): ProfileBadgeKind {
  requireBadge(value === 'verified' || value === 'premium');
  return value;
}
function action(value: unknown): 'award' | 'revoke' {
  requireBadge(value === 'award' || value === 'revoke');
  return value;
}
function id(value: unknown): string {
  requireBadge(isPublicProfileId(value));
  return value;
}
function reason(value: unknown): string {
  requireBadge(
    typeof value === 'string' &&
      value.trim() === value &&
      value.length >= 3 &&
      value.length <= 1000
  );
  requireBadge(
    ![...value].some((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && code !== 10) || code === 127;
    })
  );
  return value;
}
export function parseProfileBadgeChange(input: unknown): ProfileBadgeChange {
  const value = badgeObject(input, [
    'expectedRevision',
    'kind',
    'action',
    'reason',
  ]);
  return {
    expectedRevision: badgeRevision(value['expectedRevision']),
    kind: kind(value['kind']),
    action: action(value['action']),
    reason: reason(value['reason']),
  };
}
export function parseProfileBadgeEvent(input: unknown): ProfileBadgeEvent {
  const value = badgeObject(input, [
    'profileId',
    'revision',
    'kind',
    'action',
    'reason',
    'actorId',
    'at',
  ]);
  requireBadge((value['actorId'] === null) === (value['reason'] === null));
  return {
    profileId: id(value['profileId']),
    revision: badgeRevision(value['revision'], 1),
    kind: kind(value['kind']),
    action: action(value['action']),
    reason: value['reason'] === null ? null : reason(value['reason']),
    actorId: value['actorId'] === null ? null : id(value['actorId']),
    at: at(value['at']),
  };
}
export function parseProfileBadgeSnapshot(
  input: unknown
): ProfileBadgeSnapshot {
  const value = badgeObject(input, ['profileId', 'revision', 'badges']);
  const revision = badgeRevision(value['revision']);
  const rows = value['badges'];
  requireBadge(
    Array.isArray(rows) && rows.length <= PROFILE_BADGE_KINDS.length
  );
  const badges = rows.map((row): ProfileBadgeState => {
    const badge = badgeObject(row, [
      'kind',
      'revision',
      'active',
      'awardedAt',
      'updatedAt',
    ]);
    requireBadge(typeof badge['active'] === 'boolean');
    const result = {
      kind: kind(badge['kind']),
      revision: badgeRevision(badge['revision'], 1),
      active: badge['active'],
      awardedAt: at(badge['awardedAt']),
      updatedAt: at(badge['updatedAt']),
    };
    requireBadge(
      result.revision <= revision && result.updatedAt >= result.awardedAt
    );
    return result;
  });
  requireBadge(
    new Set(badges.map((badge) => badge.kind)).size === badges.length
  );
  requireBadge((revision === 0) === (badges.length === 0));
  requireBadge(
    revision === 0 || badges.some((badge) => badge.revision === revision)
  );
  return { profileId: id(value['profileId']), revision, badges };
}
export function changeProfileBadge(
  snapshot: ProfileBadgeSnapshot,
  input: ProfileBadgeChange,
  now: number
): ProfileBadgeSnapshot {
  const current = parseProfileBadgeSnapshot(snapshot),
    command = parseProfileBadgeChange(input);
  if (current.revision !== command.expectedRevision)
    throw new ProfileBadgeConflict('Badges changed. Reload before continuing.');
  const previous = current.badges.find((badge) => badge.kind === command.kind);
  if (command.action === 'award' ? previous?.active : !previous?.active)
    throw new ProfileBadgeConflict(
      command.action === 'award'
        ? 'This badge is already awarded.'
        : 'This badge is not currently awarded.'
    );
  const timestamp = at(now);
  requireBadge(current.badges.every((badge) => badge.updatedAt <= timestamp));
  const revision = badgeRevision(current.revision + 1, 1);
  const next = {
    kind: command.kind,
    revision,
    active: command.action === 'award',
    awardedAt: command.action === 'award' ? timestamp : previous?.awardedAt,
    updatedAt: timestamp,
  };
  return parseProfileBadgeSnapshot({
    profileId: current.profileId,
    revision,
    badges: [
      ...current.badges.filter((badge) => badge.kind !== command.kind),
      next,
    ].sort((a, b) => a.kind.localeCompare(b.kind)),
  });
}
export function parseSharedProfileBadges(input: unknown): SharedProfileBadges {
  const value = badgeObject(input, ['sharing', 'items']);
  requireBadge(value['sharing'] === 'visible' || value['sharing'] === 'hidden');
  requireBadge(
    Array.isArray(value['items']) &&
      value['items'].length <= PROFILE_BADGE_KINDS.length
  );
  const items = value['items'].map((row) => {
    const badge = badgeObject(row, ['kind', 'awardedAt']);
    return { kind: kind(badge['kind']), awardedAt: at(badge['awardedAt']) };
  });
  requireBadge(new Set(items.map((item) => item.kind)).size === items.length);
  requireBadge(value['sharing'] === 'visible' || !items.length);
  return { sharing: value['sharing'], items };
}
export function parseProfileBadgeAdministration(
  input: unknown
): ProfileBadgeAdministration {
  const value = badgeObject(input, [
    'profileId',
    'revision',
    'badges',
    'name',
    'active',
    'events',
    'after',
  ]);
  const snapshot = parseProfileBadgeSnapshot({
    profileId: value['profileId'],
    revision: value['revision'],
    badges: value['badges'],
  });
  requireBadge(
    typeof value['name'] === 'string' &&
      value['name'].trim().length > 0 &&
      value['name'].length <= 120
  );
  requireBadge(typeof value['active'] === 'boolean');
  requireBadge(
    Array.isArray(value['events']) &&
      value['events'].length <= PROFILE_BADGE_HISTORY_SIZE
  );
  const events = value['events'].map(parseProfileBadgeEvent);
  requireBadge(
    events.every(
      (event, index) =>
        event.profileId === snapshot.profileId &&
        event.revision <= snapshot.revision &&
        (index === 0 || events[index - 1].revision > event.revision)
    )
  );
  const after =
    value['after'] === null ? null : badgeRevision(value['after'], 1);
  requireBadge(
    after === null ||
      (events.length === PROFILE_BADGE_HISTORY_SIZE &&
        events[events.length - 1].revision === after)
  );
  return {
    ...snapshot,
    name: value['name'],
    active: value['active'],
    events,
    after,
  };
}
