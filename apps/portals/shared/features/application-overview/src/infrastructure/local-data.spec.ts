import { firstValueFrom } from 'rxjs';
import { APPLICATIONS } from '@portals/shared/data';
import { OverviewLocalService } from './overview-local.service';
import { LocalDiscussionsService } from './local-discussions.service';

describe('local application data', () => {
  beforeEach(() => localStorage.clear());
  it('resolves actual catalog records and rejects unknown slugs', async () => {
    const service = new OverviewLocalService();
    const result = await firstValueFrom(service.getOverview(APPLICATIONS[0].slug));
    expect(result.ok && result.value.name).toBe(APPLICATIONS[0].name);
    expect(await firstValueFrom(service.getOverview('does-not-exist'))).toMatchObject({ ok: false, error: { status: 404 } });
    if (result.ok) result.value.name = 'Changed copy';
    expect(APPLICATIONS[0].name).not.toBe('Changed copy');
  });
  it('persists threads and replies across service instances without leaking between apps', () => {
    const store = new LocalDiscussionsService();
    const created = store.create(APPLICATIONS[0].slug, ' Local topic ', ' First post ');
    new LocalDiscussionsService().reply(APPLICATIONS[0].slug, created.slug, ' Reply ');
    const persisted = new LocalDiscussionsService().threads(APPLICATIONS[0].slug).find(d => d.id === created.id)!;
    expect(persisted.title).toBe('Local topic');
    expect(persisted.replies[0].content).toBe('Reply');
    expect(Number.isFinite(persisted.replies[0].publishedTime.getTime())).toBe(true);
    expect(store.threads(APPLICATIONS[1].slug).some(d => d.id === created.id)).toBe(false);
    expect(() => store.reply(APPLICATIONS[1].slug, created.slug, 'wrong app')).toThrow();
    expect(store.previews(APPLICATIONS[0].slug).find(d => d.id === created.id)?.repliesCount).toBe(1);
  });
  it('rejects empty input and propagates storage failures without changing the view', () => {
    const store = new LocalDiscussionsService();
    expect(() => store.create(APPLICATIONS[0].slug, ' ', 'body')).toThrow();
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded'); });
    expect(() => store.create(APPLICATIONS[0].slug, 'title', 'body')).toThrow('Quota exceeded');
    expect(store.revision()).toBe(0);
    write.mockRestore();
  });
  it('tolerates malformed saved data', () => {
    localStorage.setItem('wapps.local-discussions.v1', 'not json');
    expect(() => new LocalDiscussionsService().threads(APPLICATIONS[0].slug)).not.toThrow();
    localStorage.setItem('wapps.local-discussions.v1', JSON.stringify([null, { id: 'bad' }]));
    expect(new LocalDiscussionsService().threads('unknown')).toEqual([]);
  });
});
