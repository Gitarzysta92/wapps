/** Existing durable jobs use this fixed plan. A roster change requires an explicit data migration. */
export const ACCOUNT_EXPORT_SOURCES = Object.freeze([
  'account',
  'credentials',
  'editorial',
  'discussion',
] as const);
export const ACCOUNT_ERASURE_PARTICIPANTS = Object.freeze([
  'account',
  'editorial',
  'discussion',
] as const);
