import { ProfileContractError } from './private-profile';

export const PROFILE_TOTAL_CATEGORIES = [
  'discussions',
  'favorites',
  'suites',
  'articles',
] as const;
export type ProfileTotalCategory = (typeof PROFILE_TOTAL_CATEGORIES)[number];
export type ProfileContentCategory = Exclude<ProfileTotalCategory, 'favorites'>;
/** Null means hidden by sharing policy. Zero is an observed empty collection. */
export type ProfileTotals = Record<ProfileTotalCategory, number | null>;
export type ProfileContentTotals = Partial<
  Record<ProfileContentCategory, number>
>;

function object(
  value: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== [...keys].sort().join(',')
  )
    throw new ProfileContractError('Invalid profile totals fields');
  return value as Record<string, unknown>;
}
export function profileTotal(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new ProfileContractError('Invalid profile total');
  return value;
}
export function parseProfileTotals(input: unknown): ProfileTotals {
  const row = object(input, PROFILE_TOTAL_CATEGORIES);
  const result: ProfileTotals = {
    discussions: null,
    favorites: null,
    suites: null,
    articles: null,
  };
  for (const key of PROFILE_TOTAL_CATEGORIES)
    result[key] = row[key] === null ? null : profileTotal(row[key]);
  return result;
}
export function profileTotalsRequest(
  input: unknown,
  allowed: readonly ProfileContentCategory[]
) {
  const row = object(input, ['ownerIdentityId', 'categories']);
  const owner = row['ownerIdentityId'],
    categories = row['categories'];
  if (
    typeof owner !== 'string' ||
    !owner ||
    owner.length > 128 ||
    owner.trim() !== owner ||
    [...owner].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ||
    !Array.isArray(categories) ||
    !categories.length ||
    categories.length > allowed.length ||
    new Set(categories).size !== categories.length ||
    !categories.every((c): c is ProfileContentCategory => allowed.includes(c))
  )
    throw new ProfileContractError('Invalid profile totals request');
  return { ownerIdentityId: owner, categories };
}
export function parseProfileContentTotals(
  input: unknown,
  categories: readonly ProfileContentCategory[]
): ProfileContentTotals {
  const row = object(input, categories),
    result: ProfileContentTotals = {};
  for (const key of categories) result[key] = profileTotal(row[key]);
  return result;
}
