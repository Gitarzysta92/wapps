import { ok, err } from '@sdk/kernel/standard';
import type { AuthorityValidationService } from '@sdk/kernel/ontology/authority';
import { ProfileTotalsService } from './profile-totals.service';
import {
  PublicProfileNotFound,
  type PublicProfileSnapshot,
} from './ports/public-profile.port';

const id = 'b96a5238-d11b-422b-ae19-447880a0db8a';
const context = { identityId: 'owner', timestamp: 1, subject: { roles: [] } };
function setup() {
  const snapshot = { facts: {}, stamp: 'before' } as PublicProfileSnapshot;
  const authority = { validate: jest.fn().mockResolvedValue(ok(true)) };
  const audience = { evaluate: jest.fn().mockResolvedValue(ok(true)) };
  const profiles = {
    inspect: jest.fn().mockResolvedValue(snapshot),
    confirm: jest.fn().mockResolvedValue(snapshot),
    contentOwner: jest.fn().mockResolvedValue('owner'),
    profileFavorites: jest.fn().mockResolvedValue([{ kind: 'articles', id }]),
    avatar: jest.fn(),
    directory: jest.fn(),
    followers: jest.fn(),
    following: jest.fn(),
    prepareFollow: jest.fn(),
    changeFollow: jest.fn(),
  };
  const privateProfiles = {
    getProfile: jest
      .fn()
      .mockResolvedValue({ identityId: 'owner', revision: 4 }),
    updateProfile: jest.fn(),
  };
  const favorites = {
    read: jest.fn().mockResolvedValue({
      revision: 4,
      favorites: [{ kind: 'articles', id, addedAt: 100 }],
    }),
    inspectChange: jest.fn(),
    change: jest.fn(),
  };
  const targets = {
    select: jest.fn().mockResolvedValue([{ kind: 'articles', id }]),
  };
  const editorial = {
    read: jest
      .fn()
      .mockImplementation(async (_owner, categories) =>
        Object.fromEntries(
          categories.map((key: string) => [key, key === 'articles' ? 41 : 23])
        )
      ),
  };
  const discussion = { read: jest.fn().mockResolvedValue({ discussions: 72 }) };
  const service = new ProfileTotalsService(
    authority as unknown as AuthorityValidationService,
    audience,
    profiles,
    privateProfiles,
    favorites,
    targets,
    editorial,
    discussion
  );
  return {
    service,
    authority,
    audience,
    profiles,
    privateProfiles,
    favorites,
    targets,
    editorial,
    discussion,
  };
}
describe('profile totals use case', () => {
  it('returns complete owning counts and only resolved public favorites', async () => {
    const f = setup();
    expect(await f.service.shared(id, null)).toEqual(
      ok({ discussions: 72, favorites: 1, suites: 23, articles: 41 })
    );
    expect(f.profiles.confirm).toHaveBeenCalled();
    f.targets.select.mockResolvedValue([]);
    expect(await f.service.own(context)).toEqual(
      ok({ discussions: 72, favorites: 0, suites: 23, articles: 41 })
    );
    expect(f.targets.select).toHaveBeenLastCalledWith([
      { kind: 'articles', id },
    ]);
  });
  it('hides individual totals and avoids their dependencies, including owner preview', async () => {
    const f = setup();
    f.audience.evaluate.mockImplementation(async (action) =>
      ok(action === 'read')
    );
    expect(await f.service.shared(id, 'owner')).toEqual(
      ok({ discussions: null, favorites: null, suites: null, articles: null })
    );
    expect(f.editorial.read).not.toHaveBeenCalled();
    expect(f.discussion.read).not.toHaveBeenCalled();
    expect(f.targets.select).not.toHaveBeenCalled();
  });
  it('uses activity sharing for articles independently of suites', async () => {
    const f = setup();
    f.audience.evaluate.mockImplementation(async (action) =>
      ok(action !== 'read-activity')
    );
    const result = await f.service.shared(id, null);
    expect(result.ok && result.value.articles).toBe(null);
    expect(f.editorial.read).toHaveBeenCalledWith('owner', ['suites']);
  });
  it('rejects privacy or favorite changes during content I/O', async () => {
    const f = setup();
    f.profiles.confirm.mockResolvedValue(null);
    expect(await f.service.shared(id, null)).toEqual(
      err(expect.any(PublicProfileNotFound))
    );
  });
  it.each([false, new Error('policy down')])(
    'does not read after denied or unavailable policy %s',
    async (value) => {
      const f = setup();
      f.audience.evaluate.mockResolvedValue(
        value === false ? ok(false) : err(value)
      );
      expect((await f.service.shared(id, null)).ok).toBe(false);
      expect(f.editorial.read).not.toHaveBeenCalled();
    }
  );
  it('rejects dependencies returning incomplete totals, duplicate or unrelated favorites', async () => {
    const f = setup();
    f.editorial.read.mockResolvedValue({ suites: 2 });
    expect((await f.service.shared(id, null)).ok).toBe(false);
    const g = setup();
    g.targets.select.mockResolvedValue([
      { kind: 'articles', id },
      { kind: 'articles', id },
    ]);
    expect((await g.service.shared(id, null)).ok).toBe(false);
    g.targets.select.mockResolvedValue([{ kind: 'suites', id }]);
    expect((await g.service.shared(id, null)).ok).toBe(false);
  });
  it('requires self authorization before private reads', async () => {
    const f = setup();
    f.authority.validate.mockResolvedValue(ok(false));
    expect((await f.service.own(context)).ok).toBe(false);
    expect(f.privateProfiles.getProfile).not.toHaveBeenCalled();
  });
  it('private totals ignore public sharing and reject concurrent account changes', async () => {
    const f = setup();
    f.audience.evaluate.mockResolvedValue(ok(false));
    expect((await f.service.own(context)).ok).toBe(true);
    expect(f.audience.evaluate).not.toHaveBeenCalled();
    f.privateProfiles.getProfile
      .mockResolvedValueOnce({ revision: 4 })
      .mockResolvedValueOnce({ revision: 5 });
    expect((await f.service.own(context)).ok).toBe(false);
    f.favorites.read.mockResolvedValue({ revision: 3, favorites: [] });
    expect((await f.service.own(context)).ok).toBe(false);
  });
  it('never turns a source failure into zero', async () => {
    const f = setup();
    f.discussion.read.mockRejectedValue(new Error('down'));
    expect((await f.service.shared(id, null)).ok).toBe(false);
  });
});
