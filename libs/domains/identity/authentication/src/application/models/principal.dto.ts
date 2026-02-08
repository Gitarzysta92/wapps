export type PrincipalDto = {
  /**
   * External subject identifier (e.g. Firebase uid).
   */
  uid: string;

  /**
   * Optional stable internal identity id (if you later map uid -> identity graph).
   */
  identityId?: string;

  /**
   * Optional stable subject identifier (e.g. `firebase:<uid>`).
   * Useful for downstream event emission and internal tracing.
   */
  subjectId?: string;

  tenantId?: string;

  email?: string;
  authTime?: number;
  claims?: unknown;

  /**
   * True when the request is treated as anonymous (no/invalid token and optional validation).
   */
  anonymous?: boolean;
};

