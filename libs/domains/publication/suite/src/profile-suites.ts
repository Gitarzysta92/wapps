import {
  SUITE_LIMITS,
  SuiteInputError,
  suiteId,
  suiteObject,
} from './private-suite';

export const PROFILE_SUITES_PAGE_SIZE = 20;
export interface ProfileSuiteSummary {
  id: string;
  title: string;
  description: string;
}
export interface ProfileSuitesPage {
  sharing: 'visible' | 'hidden';
  items: ProfileSuiteSummary[];
  after: string | null;
}

export function profileSuitesCursor(value: unknown): string | null {
  return value === null ? null : suiteId(value);
}

export function parseProfileSuiteSummary(input: unknown): ProfileSuiteSummary {
  const row = suiteObject(input, ['id', 'title', 'description']);
  const title = row['title'],
    description = row['description'];
  if (
    typeof title !== 'string' ||
    !title ||
    title !== title.trim() ||
    title.length > SUITE_LIMITS.title ||
    typeof description !== 'string' ||
    description !== description.trim() ||
    description.length > SUITE_LIMITS.description ||
    [...(title + description)].some(
      (character) =>
        character.charCodeAt(0) === 127 ||
        (character.charCodeAt(0) < 32 &&
          ![9, 10, 13].includes(character.charCodeAt(0)))
    )
  )
    throw new SuiteInputError('Invalid profile suite metadata');
  return { id: suiteId(row['id']), title, description };
}

export function parseProfileSuitesPage(input: unknown): ProfileSuitesPage {
  const row = suiteObject(input, ['sharing', 'items', 'after']);
  if (
    (row['sharing'] !== 'visible' && row['sharing'] !== 'hidden') ||
    !Array.isArray(row['items']) ||
    row['items'].length > PROFILE_SUITES_PAGE_SIZE
  )
    throw new SuiteInputError('Invalid profile suites page');
  const items = row['items'].map(parseProfileSuiteSummary);
  const after = profileSuitesCursor(row['after']);
  if (
    (row['sharing'] === 'hidden' && (items.length || after !== null)) ||
    items.some((item, index) => index > 0 && items[index - 1].id >= item.id) ||
    (after !== null &&
      (items.length !== PROFILE_SUITES_PAGE_SIZE ||
        after !== items[items.length - 1].id))
  )
    throw new SuiteInputError('Invalid profile suites continuation');
  return { sharing: row['sharing'], items, after };
}

export function parseProfileSuitesQuery(input: unknown): {
  after: string | null;
} {
  const query = suiteObject(input, ['after']);
  if (query['after'] !== undefined && typeof query['after'] !== 'string')
    throw new SuiteInputError('Invalid suite cursor');
  return {
    after:
      query['after'] === undefined ? null : profileSuitesCursor(query['after']),
  };
}

export function profileSuitesPage(
  input: ProfileSuiteSummary[],
  cursor: string | null
): ProfileSuitesPage {
  const after = profileSuitesCursor(cursor);
  if (input.length > PROFILE_SUITES_PAGE_SIZE + 1)
    throw new SuiteInputError('Profile suite page exceeds capacity');
  const selected = input.map(parseProfileSuiteSummary);
  if (
    selected.some(
      (item, index) =>
        (after !== null && item.id <= after) ||
        (index > 0 && selected[index - 1].id >= item.id)
    )
  )
    throw new SuiteInputError('Invalid profile suite order');
  const items = selected.slice(0, PROFILE_SUITES_PAGE_SIZE);
  return parseProfileSuitesPage({
    sharing: 'visible',
    items,
    after: selected.length > items.length ? items[items.length - 1].id : null,
  });
}
