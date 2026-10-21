import { DEFAULT_CUSTOMER_PREFERENCES } from './customer-preferences.dto';
import {
  defaultAccountPreferences,
  mergePreferences,
  parseAccountPreferences,
  parseCustomerPreferences,
  parsePreferencesUpdate,
  parsePreferencesUpdateReceipt,
} from './account-preferences';

describe('account preferences contract', () => {
  it('uses isolated, private account defaults without changing demo defaults', () => {
    const first = defaultAccountPreferences();
    expect(first.privacy.profileVisibility).toBe('private');
    expect(first.privacy.allowAnalytics).toBe(false);
    expect(first.notifications.email.enabled).toBe(false);
    first.content.contentFilters.preferredTags.push('changed');
    expect(
      defaultAccountPreferences().content.contentFilters.preferredTags
    ).toEqual([]);
    expect(DEFAULT_CUSTOMER_PREFERENCES.privacy.profileVisibility).toBe(
      'public'
    );
  });
  it('normalizes unordered filter sets for reproducible commands', () => {
    const current = defaultAccountPreferences();
    current.content.contentFilters.preferredCategories = ['b', 'a'];
    expect(
      parseCustomerPreferences(current).content.contentFilters
        .preferredCategories
    ).toEqual(['a', 'b']);
    expect(current.content.contentFilters.preferredCategories).toEqual([
      'b',
      'a',
    ]);
  });
  it.each([
    ['display', 'theme', 'unknown'],
    ['display', 'itemsPerPage', 1],
    ['display', 'itemsPerPage', '20'],
    ['display', 'dateFormat', 'random'],
    ['display', 'language', '../en'],
    ['display', 'timezone', 'Invalid/Place'],
    ['display', 'defaultView', 'cards'],
    ['content', 'feedSortOrder', 'other'],
    ['content', 'showMatureContent', 'true'],
    ['privacy', 'profileVisibility', 'friends'],
    ['privacy', 'allowAnalytics', 1],
    ['accessibility', 'fontSize', 'huge'],
    ['accessibility', 'reducedMotion', null],
    ['privacy', 'injected', true],
  ])('rejects malformed %s.%s values', (section, field, value) => {
    const current = defaultAccountPreferences();
    expect(() =>
      parseCustomerPreferences({
        ...current,
        [section]: {
          ...current[section as keyof typeof current],
          [field]: value,
        },
      })
    ).toThrow();
  });
  it.each([
    null,
    [],
    {},
    { preferences: defaultAccountPreferences() },
    { ...defaultAccountPreferences(), roles: ['admin'] },
  ])('rejects missing/unknown sections: %j', (input) => {
    expect(() => parseCustomerPreferences(input)).toThrow();
  });
  it.each([
    ['a', 'a'],
    ['../secret'],
    [''],
    Array.from({ length: 101 }, (_, i) => `id-${i}`),
    new Array(1),
  ])('rejects invalid filter identifiers', (preferredTags) => {
    const current = defaultAccountPreferences();
    current.content.contentFilters.preferredTags = preferredTags;
    expect(() => parseCustomerPreferences(current)).toThrow();
  });
  it('rejects conflicting category filters and nested notification injection', () => {
    const current = defaultAccountPreferences();
    current.content.contentFilters.preferredCategories = ['a'];
    current.content.contentFilters.excludedCategories = ['a'];
    expect(() => parseCustomerPreferences(current)).toThrow('both');
    const valid = defaultAccountPreferences();
    expect(() =>
      parseCustomerPreferences({
        ...valid,
        notifications: {
          ...valid.notifications,
          email: { ...valid.notifications.email, target: 'someone' },
        },
      })
    ).toThrow();
  });
  it('merges section changes without mutating other settings or accepting unknown fields', () => {
    const current = defaultAccountPreferences();
    const next = mergePreferences(current, {
      display: { theme: 'dark' },
      privacy: { showEmail: true },
    });
    expect(next.display).toEqual({ ...current.display, theme: 'dark' });
    expect(next.privacy.showEmail).toBe(true);
    expect(current.privacy.showEmail).toBe(false);
    expect(() =>
      mergePreferences(current, { display: { unexpected: true } } as never)
    ).toThrow();
    expect(() =>
      mergePreferences(current, { unrelated: {} } as never)
    ).toThrow();
  });
  it('validates identity, revision, timestamps and command/receipt field boundaries', () => {
    const preferences = defaultAccountPreferences();
    const snapshot = {
      identityId: 'Uid',
      revision: 1,
      updatedAt: null,
      preferences,
    };
    expect(parseAccountPreferences(snapshot)).toEqual(snapshot);
    expect(
      parsePreferencesUpdate({ expectedRevision: 1, preferences })
    ).toEqual({ expectedRevision: 1, preferences });
    expect(
      parsePreferencesUpdateReceipt({ identityId: 'Uid', revision: 2 })
    ).toEqual({ identityId: 'Uid', revision: 2 });
    for (const revision of [0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1, '1']) {
      expect(() =>
        parseAccountPreferences({ ...snapshot, revision })
      ).toThrow();
      expect(() =>
        parsePreferencesUpdate({ expectedRevision: revision, preferences })
      ).toThrow();
    }
    for (const identityId of ['', ' Uid', 'Uid\n', 'x'.repeat(129)])
      expect(() =>
        parseAccountPreferences({ ...snapshot, identityId })
      ).toThrow();
    for (const updatedAt of [0, -1, '100', 8_640_000_000_000_001])
      expect(() =>
        parseAccountPreferences({ ...snapshot, updatedAt })
      ).toThrow();
    expect(() =>
      parsePreferencesUpdate({
        expectedRevision: 1,
        preferences,
        identityId: 'Other',
      })
    ).toThrow();
  });
});
