import { AccountDiscussionMentions } from './account-discussion-mentions';

const profileId = '00000000-0000-4000-8000-000000000001';
const secret = 'a'.repeat(32);
const response = (body: unknown, status = 200, type = 'application/json') =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': type },
  });
function fixture(origin = 'http://account.test', credential = secret) {
  const request = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValue(
      response({ recipients: [{ profileId, identityId: 'Recipient' }] })
    );
  return {
    request,
    directory: new AccountDiscussionMentions(origin, credential, request),
  };
}
describe('bounded Account mention recipient adapter', () => {
  it('uses only the dedicated service credential and the exact validated request', async () => {
    const f = fixture();
    expect(await f.directory.resolve('Author', [profileId])).toEqual([
      { profileId, identityId: 'Recipient' },
    ]);
    const [url, options] = f.request.mock.calls[0];
    expect(String(url)).toBe(
      'http://account.test/api/internal/mention-recipients'
    );
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: { 'x-notification-worker': secret },
    });
    expect(JSON.parse(String(options?.body))).toEqual({
      authorId: 'Author',
      profileIds: [profileId],
    });
  });
  it('does not call Account for an empty selection', async () => {
    const f = fixture();
    expect(await f.directory.resolve('Author', [])).toEqual([]);
    expect(f.request).not.toHaveBeenCalled();
  });
  it.each([
    'http://user@account.test',
    'http://account.test/path',
    'ftp://account.test',
    'http://account.test?a=1',
    'http://account.test#x',
  ])('rejects invalid origins %s', async (url) => {
    const f = fixture(url);
    await expect(f.directory.resolve('Author', [profileId])).rejects.toThrow();
    expect(f.request).not.toHaveBeenCalled();
  });
  it('refuses missing or weak credentials before IO', async () => {
    const f = fixture('http://account.test', 'short');
    await expect(f.directory.resolve('Author', [profileId])).rejects.toThrow(
      'configured'
    );
    expect(f.request).not.toHaveBeenCalled();
  });
  it.each([
    { body: {}, status: 503 },
    { body: { recipients: [] }, type: 'text/plain' },
    {
      body: {
        recipients: [{ profileId, identityId: 'Recipient', private: 'secret' }],
      },
    },
    { body: { recipients: [], extra: true } },
    {
      body: {
        recipients: [
          {
            profileId: '00000000-0000-4000-8000-000000000002',
            identityId: 'Recipient',
          },
        ],
      },
    },
    { body: { recipients: [], padding: 'x'.repeat(8192) } },
  ])('fails closed on invalid responses %j', async ({ body, status, type }) => {
    const f = fixture();
    f.request.mockResolvedValue(response(body, status, type));
    await expect(f.directory.resolve('Author', [profileId])).rejects.toThrow(
      'unavailable'
    );
  });
  it('accepts an empty eligible subset without inventing recipients', async () => {
    const f = fixture();
    f.request.mockResolvedValue(response({ recipients: [] }));
    expect(await f.directory.resolve('Author', [profileId])).toEqual([]);
  });
});
