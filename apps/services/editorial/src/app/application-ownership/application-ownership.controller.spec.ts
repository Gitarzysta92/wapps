import { ApplicationOwnership } from './application-ownership';
import {
  ApplicationOwnershipController,
  ApplicationOwnershipReviewController,
} from './application-ownership.controller';
import { ok } from '@sdk/kernel/standard';

describe('ownership list transport validation', () => {
  const actor = {
    identityId: 'Reviewer',
    tenantId: 'default',
    roles: ['editorial:ownership-reviewer'],
  };
  const list = jest.fn();
  const store = {
    list,
    read: jest.fn(),
    create: jest.fn(),
    change: jest.fn(),
    reserveCheck: jest.fn(),
    finishCheck: jest.fn(),
  };
  const ownership = new ApplicationOwnership(
    store,
    { matches: jest.fn() },
    { evaluate: async () => ok(true) },
    { id: jest.fn(), token: jest.fn() }
  );
  const self = new ApplicationOwnershipController(ownership);
  const staff = new ApplicationOwnershipReviewController(ownership);
  beforeEach(() => jest.clearAllMocks());
  it('defaults to pending review and exposes a separate, paginated active-grants view', async () => {
    await staff.list(actor, {});
    expect(list).toHaveBeenLastCalledWith(actor, true, 1, false);
    await staff.list(actor, { page: '2', view: 'grants' });
    expect(list).toHaveBeenLastCalledWith(actor, true, 2, true);
    await staff.list(actor, { view: 'pending' });
    expect(list).toHaveBeenLastCalledWith(actor, true, 1, false);
    await self.list(actor, {});
    expect(list).toHaveBeenLastCalledWith(actor, false, 1, false);
  });
  it.each([
    { view: 'all' },
    { view: ['grants'] },
    { page: '0' },
    { page: '10001' },
    { page: ['1'] },
    { tenantId: 'other' },
    { ownerId: 'other' },
  ])(
    'rejects invalid or authority-overriding staff query %j',
    async (query) => {
      await expect(
        Promise.resolve().then(() => staff.list(actor, query))
      ).rejects.toThrow();
      expect(list).not.toHaveBeenCalled();
    }
  );
  it('does not expose staff views through the claimant route', () => {
    expect(() => self.list(actor, { view: 'grants' })).toThrow();
    expect(list).not.toHaveBeenCalled();
  });
});
