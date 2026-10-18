/** Consumer-owned opaque binding. Discussion never parses namespaces or schema versions. */
export function discussionKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,256}$/.test(value))
    throw new DiscussionKeyError(
      'A discussion key must contain 1 to 256 printable ASCII characters without spaces'
    );
  return value;
}

export class DiscussionKeyError extends Error {}
