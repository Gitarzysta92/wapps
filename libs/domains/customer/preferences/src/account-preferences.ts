import {
  DEFAULT_CUSTOMER_PREFERENCES,
  type CustomerPreferencesDto,
} from './customer-preferences.dto';

export interface AccountPreferences {
  identityId: string;
  revision: number;
  updatedAt: number | null;
  preferences: CustomerPreferencesDto;
}

export interface PreferencesUpdate {
  expectedRevision: number;
  preferences: CustomerPreferencesDto;
}

export interface PreferencesUpdateReceipt {
  identityId: string;
  revision: number;
}

export type PreferencesPatch = {
  [K in keyof CustomerPreferencesDto]?: Partial<CustomerPreferencesDto[K]>;
};

export class PreferencesContractError extends Error {}

type Decoder<T> = (value: unknown) => T;

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PreferencesContractError(message);
}

function struct<T extends object>(shape: {
  [K in keyof T]: Decoder<T[K]>;
}): Decoder<T> {
  return (value) => {
    requireValue(
      value !== null && typeof value === 'object' && !Array.isArray(value),
      'Expected preferences object'
    );
    const source = value as Record<string, unknown>;
    const fields = Object.keys(shape);
    requireValue(
      Object.keys(source).length === fields.length &&
        Object.keys(source).every((key) => fields.includes(key)),
      'Missing or unknown preference field'
    );
    return Object.fromEntries(
      (Object.entries(shape) as [string, Decoder<unknown>][]).map(
        ([key, decode]) => [key, decode(source[key])]
      )
    ) as T;
  };
}

function choice<T extends string | number>(values: readonly T[]): Decoder<T> {
  return (value) => {
    requireValue(
      values.some((item) => item === value),
      'Unsupported preference value'
    );
    return value as T;
  };
}

const boolean: Decoder<boolean> = (value) => {
  requireValue(typeof value === 'boolean', 'Expected boolean preference');
  return value;
};

function boundedText(value: unknown, max: number): string {
  requireValue(
    typeof value === 'string' &&
      value.length > 0 &&
      value.length <= max &&
      value === value.trim() &&
      ![...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
    'Invalid preference text'
  );
  return value;
}

const language: Decoder<string> = (value) => {
  const text = boundedText(value, 35);
  requireValue(
    /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(text),
    'Invalid language tag'
  );
  return text;
};

const timezone: Decoder<string> = (value) => {
  const text = boundedText(value, 64);
  try {
    new Intl.DateTimeFormat('en', { timeZone: text }).format(0);
  } catch {
    throw new PreferencesContractError('Invalid timezone');
  }
  return text;
};

const identifiers: Decoder<string[]> = (value) => {
  requireValue(
    Array.isArray(value) && value.length <= 100,
    'Expected at most 100 filter identifiers'
  );
  const result = Array.from(value, (item) => {
    const id = boundedText(item, 128);
    requireValue(
      /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id),
      'Invalid filter identifier'
    );
    return id;
  });
  requireValue(
    new Set(result).size === result.length,
    'Duplicate filter identifiers'
  );
  return result.sort();
};

const decodePreferences = struct<CustomerPreferencesDto>({
  display: struct({
    theme: choice(['light', 'dark', 'auto'] as const),
    language,
    timezone,
    dateFormat: choice(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const),
    defaultView: choice(['grid', 'list'] as const),
    itemsPerPage: choice([10, 20, 50, 100]),
  }),
  content: struct({
    feedSortOrder: choice(['recent', 'popular', 'recommended'] as const),
    showMatureContent: boolean,
    contentFilters: struct({
      preferredCategories: identifiers,
      excludedCategories: identifiers,
      preferredTags: identifiers,
    }),
  }),
  notifications: struct({
    email: struct({
      enabled: boolean,
      frequency: choice(['instant', 'daily', 'weekly', 'never'] as const),
      newDiscussions: boolean,
      discussionReplies: boolean,
      newArticles: boolean,
      favoriteUpdates: boolean,
      suiteUpdates: boolean,
      systemAnnouncements: boolean,
      weeklyDigest: boolean,
    }),
    inApp: struct({
      enabled: boolean,
      discussionMentions: boolean,
      discussionReplies: boolean,
      favoriteUpdates: boolean,
      systemAlerts: boolean,
    }),
    push: struct({ enabled: boolean, criticalOnly: boolean }),
  }),
  privacy: struct({
    profileVisibility: choice(['public', 'private', 'followers'] as const),
    showEmail: boolean,
    showBadges: boolean,
    showActivityHistory: boolean,
    showFavorites: boolean,
    showDiscussions: boolean,
    showSuites: boolean,
    allowAnalytics: boolean,
    allowPersonalization: boolean,
  }),
  accessibility: struct({
    reducedMotion: boolean,
    highContrast: boolean,
    fontSize: choice(['small', 'medium', 'large', 'x-large'] as const),
    screenReaderOptimized: boolean,
  }),
});

export function parseCustomerPreferences(
  value: unknown
): CustomerPreferencesDto {
  const result = decodePreferences(value);
  const filters = result.content.contentFilters;
  requireValue(
    !filters.preferredCategories.some((id) =>
      filters.excludedCategories.includes(id)
    ),
    'A category cannot be both preferred and excluded'
  );
  return result;
}

/** Account defaults never import browser demo data or opt into public exposure. */
export function defaultAccountPreferences(): CustomerPreferencesDto {
  const value = parseCustomerPreferences(DEFAULT_CUSTOMER_PREFERENCES);
  value.privacy = {
    profileVisibility: 'private',
    showEmail: false,
    showBadges: false,
    showActivityHistory: false,
    showFavorites: false,
    showDiscussions: false,
    showSuites: false,
    allowAnalytics: false,
    allowPersonalization: false,
  };
  value.notifications.email.enabled = false;
  return value;
}

const revision: Decoder<number> = (value) => {
  requireValue(
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
    'Invalid account revision'
  );
  return value;
};
const identity: Decoder<string> = (value) => boundedText(value, 128);
const updatedAt: Decoder<number | null> = (value) => {
  if (value === null) return null;
  const result = revision(value);
  requireValue(
    result <= 8_640_000_000_000_000,
    'Invalid preferences timestamp'
  );
  return result;
};

export const parseAccountPreferences = struct<AccountPreferences>({
  identityId: identity,
  revision,
  updatedAt,
  preferences: parseCustomerPreferences,
});
export const parsePreferencesUpdate = struct<PreferencesUpdate>({
  expectedRevision: revision,
  preferences: parseCustomerPreferences,
});
export const parsePreferencesUpdateReceipt = struct<PreferencesUpdateReceipt>({
  identityId: identity,
  revision,
});

export function mergePreferences(
  current: CustomerPreferencesDto,
  patch: PreferencesPatch
): CustomerPreferencesDto {
  const result = parseCustomerPreferences(current);
  requireValue(
    patch !== null && typeof patch === 'object' && !Array.isArray(patch),
    'Invalid preferences change'
  );
  for (const key of Object.keys(patch)) {
    requireValue(
      Object.prototype.hasOwnProperty.call(result, key),
      'Unknown preference section'
    );
    const section = key as keyof CustomerPreferencesDto;
    const update = patch[section];
    requireValue(
      update !== null && typeof update === 'object' && !Array.isArray(update),
      'Invalid preference section'
    );
    Object.assign(result, { [section]: { ...result[section], ...update } });
  }
  return parseCustomerPreferences(result);
}
