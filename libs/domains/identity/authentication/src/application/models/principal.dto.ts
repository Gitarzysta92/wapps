export type PrincipalDto = {
  /**
   * External subject identifier as issued by the upstream IdP.
   */
  uid: string;

  /**
   * Optional stable internal identity id (if you later map uid -> identity graph).
   */
  identityId?: string;

  /**
   * Optional stable subject identifier (e.g. `<provider>:<claim>`).
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

