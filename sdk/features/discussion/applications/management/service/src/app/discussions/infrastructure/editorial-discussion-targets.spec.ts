import { EditorialDiscussionTargets } from './editorial-discussion-targets';

const target = {
  kind: 'article' as const,
  id: 'f56428fb-9bc2-4c34-814a-3c558ec92391',
};
const body = { id: target.id, tenantId: 'default', revision: 2 };
function fixture(
  response = new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
  })
) {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(response);
  return {
    request,
    targets: new EditorialDiscussionTargets(
      'http://editorial.test',
      'default',
      request
    ),
  };
}

describe('canonical Editorial comment target adapter', () => {
  it('checks canonical visibility without forwarding identity or reading a projection', async () => {
    const { request, targets } = fixture();
    expect(await targets.visible(target, 'default')).toBe(true);
    expect(String(request.mock.calls[0][0])).toBe(
      `http://editorial.test/api/catalog/article-visibility/${target.id}`
    );
    expect(request.mock.calls[0][1]).toMatchObject({
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
  });
  it('refuses a different tenant without making a request', async () => {
    const { targets, request } = fixture();
    expect(await targets.visible(target, 'other')).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it('resolves application bindings through their own canonical authority route', async () => {
    const { request, targets } = fixture();
    expect(
      await targets.visible({ ...target, kind: 'application' }, 'default')
    ).toBe(true);
    expect(String(request.mock.calls[0][0])).toBe(
      `http://editorial.test/api/catalog/application-visibility/${target.id}`
    );
  });
  it('treats canonical absence as unavailable to readers and writers', async () => {
    expect(
      await fixture(new Response('', { status: 404 })).targets.visible(
        target,
        'default'
      )
    ).toBe(false);
  });
  it.each([
    undefined,
    'file:///private',
    'http://user:pass@editorial.test',
    'http://editorial.test/path',
    'http://editorial.test/?x=1',
  ])(
    'fails closed on missing or invalid configured origin %j',
    async (origin) => {
      const { request } = fixture();
      await expect(
        new EditorialDiscussionTargets(origin, 'default', request).visible(
          target,
          'default'
        )
      ).rejects.toThrow();
      expect(request).not.toHaveBeenCalled();
    }
  );
  it.each([
    { ...body, id: 'other' },
    { ...body, tenantId: 'other' },
    { ...body, revision: 0 },
    { ...body, visible: true },
    { ...body, revision: '2' },
    null,
  ])('rejects malformed authority responses %#', async (value) => {
    await expect(
      fixture(
        new Response(JSON.stringify(value), {
          headers: { 'content-type': 'application/json' },
        })
      ).targets.visible(target, 'default')
    ).rejects.toThrow();
  });
  it('caps response bytes and does not convert outages into absence', async () => {
    await expect(
      fixture(
        new Response('x'.repeat(4097), {
          headers: { 'content-type': 'application/json' },
        })
      ).targets.visible(target, 'default')
    ).rejects.toThrow('limit');
    await expect(
      fixture(new Response('', { status: 503 })).targets.visible(
        target,
        'default'
      )
    ).rejects.toThrow('unavailable');
  });
});
