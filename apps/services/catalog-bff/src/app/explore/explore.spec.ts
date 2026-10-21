import { ExploreService } from './explore.service';
import { EncryptedExploreCursors } from './explore-cursors';
import { HttpExploreSource } from './explore-source';
import type { ExploreItem } from '@domains/feed';
const secret = 'explore-qualification-only-distinct-secret-2026';
const position = {
  at: 1000,
  key: 'application:10000000-0000-4000-8000-000000000001',
};

describe('Explore aggregation', () => {
  it('encrypts hidden scan positions, survives process recreation, and rejects tampering/expiry/rotation', () => {
    const cursors = new EncryptedExploreCursors(secret, () => 1000);
    const token = cursors.seal(position);
    expect(Buffer.from(token.slice(3), 'base64url').toString()).not.toContain(
      position.key
    );
    expect(new EncryptedExploreCursors(secret, () => 1001).open(token)).toEqual(
      position
    );
    const tampered = Buffer.from(token.slice(3), 'base64url');
    tampered[0] ^= 1;
    expect(() =>
      cursors.open('e1.' + tampered.toString('base64url'))
    ).toThrow();
    expect(() =>
      new EncryptedExploreCursors(secret, () => 86_401_000).open(token)
    ).toThrow();
    expect(() =>
      new EncryptedExploreCursors(secret + 'rotated', () => 1000).open(token)
    ).toThrow();
  });
  it('does not invent a successful partial page during a source failure', async () => {
    const publications = {
        read: jest.fn().mockResolvedValue({ items: [], through: null }),
      },
      community = { read: jest.fn().mockRejectedValue(new Error('offline')) };
    await expect(
      new ExploreService(
        publications,
        community,
        new EncryptedExploreCursors(secret)
      ).read({})
    ).rejects.toThrow('temporarily unavailable');
  });
  it('uses opaque continuations for empty hidden scans and never exposes the raw boundary', async () => {
    const source = {
        read: jest.fn().mockResolvedValue({ items: [], through: position }),
      },
      other = {
        read: jest.fn().mockResolvedValue({ items: [], through: null }),
      };
    const cursors = new EncryptedExploreCursors(secret),
      service = new ExploreService(source, other, cursors);
    const page = await service.read({});
    expect(page.items).toEqual([]);
    expect(Object.keys(page)).toEqual(['items', 'after']);
    expect(cursors.open(page.after!)).toEqual(position);
    source.read.mockResolvedValue({ items: [], through: null });
    await service.read({ after: page.after });
    expect(source.read).toHaveBeenLastCalledWith(position);
  });
  it('rejects unsupported filters, malformed cursors and missing configuration', async () => {
    const source = { read: jest.fn() },
      service = new ExploreService(
        source,
        source,
        new EncryptedExploreCursors(secret)
      );
    await expect(service.read({ owner: 'member' })).rejects.toThrow();
    await expect(service.read({ after: ['bad'] })).rejects.toThrow();
    expect(source.read).not.toHaveBeenCalled();
    await expect(
      new HttpExploreSource(undefined, undefined, []).read(null)
    ).rejects.toThrow('configuration');
  });
  it('keeps source credentials private, bounds response sizes and validates source kinds', async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], through: null }), {
        headers: { 'content-type': 'application/json' },
      })
    );
    const source = new HttpExploreSource(
      'http://127.0.0.1:1337',
      secret,
      ['application'],
      fetcher
    );
    expect(await source.read(null)).toEqual({ items: [], through: null });
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:1337/api/internal/explore',
      expect.objectContaining({
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-explore-reader': secret,
        },
        body: '{"after":null}',
      })
    );
    fetcher.mockResolvedValue(
      new Response(' '.repeat(512 * 1024 + 1), {
        headers: { 'content-type': 'application/json' },
      })
    );
    await expect(source.read(null)).rejects.toThrow('bounds');
    const item: ExploreItem = {
      kind: 'suite',
      id: position.key.split(':')[1],
      at: 1000,
      title: 'Suite',
      target: { kind: 'suite', id: position.key.split(':')[1] },
      categories: [],
      tags: [],
      engagement: null,
    };
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ items: [item], through: null }), {
        headers: { 'content-type': 'application/json' },
      })
    );
    await expect(source.read(null)).rejects.toThrow('kind');
  });
});
