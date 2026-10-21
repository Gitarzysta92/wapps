import { defaultAccountPreferences } from '@domains/customer/preferences';
import {
  PortalContentPreferences,
  filterClassifiedPage,
} from './portal-content-preferences';
import { PortalPreferencesClient } from './portal-preferences.client';

describe('portal content preferences', () => {
  const actor = { identityId: 'Alice', headers: {} };
  const page = {
    items: [
      { classification: 'general' as const, title: 'General' },
      {
        classification: 'mature' as const,
        title: 'Sensitive',
        nested: { title: 'Private metadata' },
      },
      { title: 'Unclassified' },
    ],
    after: 'opaque-continuation',
  };
  function fixture() {
    const saved = {
      identityId: 'Alice',
      revision: 1,
      updatedAt: null,
      preferences: defaultAccountPreferences(),
    };
    const read = jest
      .fn()
      .mockImplementation(async () => structuredClone(saved));
    const client = { read } as unknown as PortalPreferencesClient;
    return { saved, read, service: new PortalContentPreferences(client) };
  }
  it('filters anonymous and signed-in metadata while retaining scan progress', async () => {
    const f = fixture();
    for (const viewer of [{ identityId: null, headers: {} }, actor]) {
      const result = await f.service.read(
        viewer,
        async () => page,
        filterClassifiedPage
      );
      expect(result).toEqual({ items: [page.items[0]], after: page.after });
      expect(JSON.stringify(result)).not.toContain('Private metadata');
    }
    expect(f.read).toHaveBeenCalledTimes(2);
  });
  it('uses current choices on successive sessions without caching', async () => {
    const f = fixture();
    f.saved.preferences.content.showMatureContent = true;
    expect(
      await f.service.read(actor, async () => page, filterClassifiedPage)
    ).toEqual(page);
    f.saved.preferences.content.showMatureContent = false;
    f.saved.revision++;
    expect(
      (await f.service.read(actor, async () => page, filterClassifiedPage))
        .items
    ).toHaveLength(1);
  });
  it('rejects a preference change during downstream composition and source failures', async () => {
    const f = fixture();
    await expect(
      f.service.read(
        actor,
        async () => {
          f.saved.revision++;
          return page;
        },
        filterClassifiedPage
      )
    ).rejects.toThrow('changed');
    f.read.mockRejectedValueOnce(new Error('unavailable'));
    const load = jest.fn(async () => page);
    await expect(
      f.service.read(actor, load, filterClassifiedPage)
    ).rejects.toThrow('unavailable');
    expect(load).not.toHaveBeenCalled();
  });
});
