import { EditorialProfileDiscussionParents } from './editorial-profile-discussion-parents';
const id = '00000000-0000-4000-8000-000000000001';
describe('public profile parent metadata transport', () => {
  const request = jest.fn();
  const adapter = new EditorialProfileDiscussionParents(
    'http://editorial.test',
    request
  );
  beforeEach(() => request.mockReset());
  it('deduplicates both content families and uses bounded unsigned nonredirecting public reads', async () => {
    request.mockImplementation(
      async () =>
        new Response('{"items":[]}', {
          headers: { 'content-type': 'application/json' },
        })
    );
    expect(
      await adapter.select([
        { kind: 'application', id },
        { kind: 'application', id },
        { kind: 'article', id },
      ])
    ).toEqual([]);
    expect(request.mock.calls.map(([url]) => url)).toEqual([
      `http://editorial.test/api/catalog/app-selection?ids=${id}`,
      `http://editorial.test/api/catalog/article-selection?ids=${id}`,
    ]);
    for (const [, options] of request.mock.calls)
      expect(options).toEqual({
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: { Accept: 'application/json' },
      });
  });
  it('fails unavailable for dependency errors, malformed data and oversized bodies', async () => {
    for (const response of [
      new Response('{}', { status: 503 }),
      new Response('{}'),
      new Response('{"items":[{"id":"private"}]}', {
        headers: { 'content-type': 'application/json' },
      }),
      new Response('x'.repeat(1024 * 1024 + 1), {
        headers: { 'content-type': 'application/json' },
      }),
    ]) {
      request.mockResolvedValueOnce(response);
      await expect(
        adapter.select([{ kind: 'application', id }])
      ).rejects.toThrow();
    }
    expect(await adapter.select([])).toEqual([]);
    await expect(
      adapter.select(Array(11).fill({ kind: 'application', id }))
    ).rejects.toThrow('bounds');
  });
  it.each([
    'file:///tmp/targets',
    'http://user:pass@editorial.test',
    'http://editorial.test/path',
    'http://editorial.test/?tenant=other',
  ])('rejects unsafe origin %s', (origin) =>
    expect(() => new EditorialProfileDiscussionParents(origin)).toThrow()
  );
});
