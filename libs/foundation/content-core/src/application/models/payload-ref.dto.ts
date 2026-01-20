/**
 * Opaque reference to the actual content payload. The core does not interpret it.
 * Payloads may live in object storage, CMS, catalog services, etc.
 */
export type PayloadRef = {
  readonly storage: string;
  readonly key: string;
};
