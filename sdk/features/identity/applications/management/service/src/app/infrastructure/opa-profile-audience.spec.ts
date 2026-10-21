import axios, { type AxiosInstance } from 'axios';
import { err, ok } from '@sdk/kernel/standard';
import { OpaProfileAudience } from './opa-profile-audience';

describe('profile audience OPA transport', () => {
  const facts = { ownerId: '00000000-0000-4000-8000-000000000001', viewerId: null, ownerActive: true, viewerActive: true, viewerRegistered: false, approved: false, visibility: 'public' as const };
  afterEach(() => jest.restoreAllMocks());
  function fixture() {
    const post = jest.fn();
    const create = jest.spyOn(axios, 'create').mockReturnValue({ post } as unknown as AxiosInstance);
    return { post, create, policy: new OpaProfileAudience('http://opa.test') };
  }
  it('passes only explicit canonical facts to the dedicated audience endpoint', async () => {
    const f = fixture(); f.post.mockResolvedValue({ data: { result: true } });
    expect(await f.policy.evaluate('read', facts)).toEqual(ok(true));
    expect(f.post).toHaveBeenCalledWith('/v1/data/wapps/profile_audience/authz/allow', { input: { ...facts, action: 'read', requesterId: null } });
    expect(f.create).toHaveBeenCalledWith(expect.objectContaining({ timeout: 1500, maxRedirects: 0, maxContentLength: 1024 }));
  });
  it('preserves explicit policy denial', async () => {
    const f = fixture(); f.post.mockResolvedValue({ data: { result: false } });
    expect(await f.policy.evaluate('read', facts)).toEqual(ok(false));
  });
  it.each([null, undefined, 'true', 1, {}])('fails closed on missing or malformed policy results: %j', async result => {
    const f = fixture(); f.post.mockResolvedValue({ data: { result } });
    expect(await f.policy.evaluate('read', facts)).toEqual(err(new Error('Profile authorization unavailable')));
  });
  it('withholds internal network diagnostics on transport failure', async () => {
    const f = fixture(); f.post.mockRejectedValue(new Error('internal OPA host and token'));
    expect(await f.policy.evaluate('read', facts)).toEqual(err(new Error('Profile authorization unavailable')));
  });
});
