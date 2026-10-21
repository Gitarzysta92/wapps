import { defaultAccountPreferences } from '@domains/customer/preferences';
import { ClassifiedNotifications } from './classified-notifications';
import { CanonicalIdentityAccessDenied } from '@sdk/features/identity/core';

function fixture() {
  const saved = {
    identityId: 'Alice',
    revision: 1,
    updatedAt: null,
    preferences: defaultAccountPreferences(),
  };
  const preferences = {
    getPreferences: jest
      .fn()
      .mockImplementation(async () => structuredClone(saved)),
  };
  const source = {
    claim: jest.fn(),
    settle: jest.fn(),
    resolve: jest
      .fn()
      .mockResolvedValue([
        { id: 'general', classification: 'general' },
        { id: 'mature', classification: 'mature' },
        { id: 'legacy' },
      ]),
  };
  return {
    saved,
    source,
    preferences,
    service: new ClassifiedNotifications(source, preferences),
  };
}

describe('recipient content choices at the notification consumer boundary', () => {
  it('settles inactive recipients as suppressed without reading private target metadata', async () => {
    const f = fixture();
    f.preferences.getPreferences.mockRejectedValueOnce(
      new CanonicalIdentityAccessDenied('Inactive')
    );
    expect(await f.service.resolve('Alice', ['general'])).toEqual([]);
    expect(f.source.resolve).not.toHaveBeenCalled();
  });
  it('hides mature and unclassified metadata, and rechecks each independent read', async () => {
    const f = fixture();
    expect(
      await f.service.resolve('Alice', ['general', 'mature', 'legacy'])
    ).toEqual([{ id: 'general', classification: 'general' }]);
    f.saved.preferences.content.showMatureContent = true;
    f.saved.revision++;
    expect(
      await f.service.resolve('Alice', ['general', 'mature', 'legacy'])
    ).toHaveLength(3);
    f.saved.preferences.content.showMatureContent = false;
    f.saved.revision++;
    expect(
      await f.service.resolve('Alice', ['general', 'mature', 'legacy'])
    ).toHaveLength(1);
  });
  it('rejects a concurrent preference change instead of returning an old permitted result', async () => {
    const f = fixture();
    f.source.resolve.mockImplementation(async () => {
      f.saved.revision++;
      return [{ id: 'general', classification: 'general' }];
    });
    await expect(f.service.resolve('Alice', ['general'])).rejects.toThrow(
      'changed'
    );
  });
  it('fails closed for unavailable or substituted preference authority', async () => {
    const f = fixture();
    f.preferences.getPreferences.mockRejectedValueOnce(new Error('offline'));
    await expect(f.service.resolve('Alice', ['general'])).rejects.toThrow(
      'offline'
    );
    expect(f.source.resolve).not.toHaveBeenCalled();
    f.saved.identityId = 'alice';
    await expect(f.service.resolve('Alice', ['general'])).rejects.toThrow(
      'changed'
    );
  });
});
