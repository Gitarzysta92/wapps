/** Opaque identifier for content. The core does not interpret the value. */
export type ContentId = string & { readonly __brand: 'ContentId' };

export function asContentId(id: string): ContentId {
  return id as ContentId;
}
