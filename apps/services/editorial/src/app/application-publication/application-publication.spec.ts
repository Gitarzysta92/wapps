import { err, ok } from '@sdk/kernel/standard';
import {
  ApplicationPublication,
  assertApplicationPublicationAccess,
  type ApplicationPublicationStore,
} from './application-publication';

const id = '019a0010-0000-7000-8000-000000000001';
const actor = { identityId: 'Alice', tenantId: 'default', roles: [] };
describe('application publication authorization', () => {
  const store: jest.Mocked<ApplicationPublicationStore> = {
    read: jest.fn(),
    reviews: jest.fn(),
    commit: jest.fn(),
  };
  beforeEach(() => jest.clearAllMocks());
  it.each(['submit', 'approve', 'reject', 'withdraw'] as const)(
    'denies %s before persistence',
    async (action) => {
      const service = new ApplicationPublication(store, {
        evaluate: async () => ok(false),
      });
      await expect(
        service.change(
          actor,
          id,
          action,
          { expectedRevision: 2, submittedRevision: 1 },
          'key'
        )
      ).rejects.toThrow();
      expect(store.commit).not.toHaveBeenCalled();
    }
  );
  it('fails closed for review reads and policy outages', async () => {
    const denied = new ApplicationPublication(store, {
      evaluate: async () => ok(false),
    });
    await expect(denied.read(actor, id, true)).rejects.toThrow();
    await expect(denied.reviews(actor, 1)).rejects.toThrow();
    const offline = new ApplicationPublication(store, {
      evaluate: async () => err(new Error('offline')),
    });
    await expect(
      offline.change(actor, id, 'submit', { expectedRevision: 1 }, 'key')
    ).rejects.toThrow('unavailable');
    expect(store.read).not.toHaveBeenCalled();
    expect(store.reviews).not.toHaveBeenCalled();
    expect(store.commit).not.toHaveBeenCalled();
  });
  it('denies self review and cross-tenant access even for an administrator', () => {
    const owner = {
      tenantId: actor.tenantId,
      ownerIdentityId: actor.identityId,
    };
    expect(() =>
      assertApplicationPublicationAccess(
        { ...actor, roles: ['admin'] },
        owner,
        true
      )
    ).toThrow();
    expect(() =>
      assertApplicationPublicationAccess(
        { ...actor, identityId: 'Bob', tenantId: 'other' },
        owner,
        true
      )
    ).toThrow();
    expect(() =>
      assertApplicationPublicationAccess(
        { ...actor, identityId: 'Bob' },
        owner,
        false
      )
    ).toThrow();
  });
  it('authorizes reviewer permission separately from workspace self-access', async () => {
    const policy = { evaluate: jest.fn(async () => ok(true)) };
    const service = new ApplicationPublication(store, policy);
    await service.change(
      actor,
      id,
      'approve',
      { expectedRevision: 2, submittedRevision: 1 },
      'approve'
    );
    expect(policy.evaluate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionName: 'editorial.application.review',
        resource: { type: 'application-review', id, tenantId: 'default' },
      })
    );
    await service.change(
      actor,
      id,
      'submit',
      { expectedRevision: 2 },
      'submit'
    );
    expect(policy.evaluate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        actionName: 'editorial.application.submit',
        resource: {
          type: 'application-workspace',
          id: 'Alice',
          tenantId: 'default',
        },
      })
    );
  });
});
