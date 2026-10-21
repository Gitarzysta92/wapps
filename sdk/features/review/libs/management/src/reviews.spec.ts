import { createHash } from 'node:crypto';
import {
  ReviewConflictError,
  ReviewDeniedError,
  ReviewMissingError,
} from '@sdk/features/review/core';
import { Reviews } from './reviews';
import type {
  ReviewActor,
  ReviewAuthority,
  ReviewRecord,
  ReviewsRepository,
  ReviewTransaction,
} from './reviews.port';

const bindingKey = 'UnfamiliarConsumer|Catalog@v987/Item:ABC?x=1&y=2';
const actor: ReviewActor = {
  identityId: 'Author',
  tenantId: 'Tenant-A',
  roles: [],
};
const id = '10000000-0000-4000-8000-000000000001';
const content = {
  displayName: 'Author',
  rating: 4,
  text: 'A useful resource.',
};
const key = 'historical-command-001';
const fingerprint = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const summary = { total: 0, average: null, distribution: [0, 0, 0, 0, 0] };
const record: ReviewRecord = {
  id,
  ownerId: actor.identityId,
  content,
  revision: 2,
  contentRevision: 1,
  hidden: true,
  withdrawn: true,
  moderationReason: 'Reason',
  createdAt: 1,
  updatedAt: 1,
};

describe('consumer-independent Review commands and queries', () => {
  let repository: jest.Mocked<ReviewsRepository>,
    authority: jest.Mocked<ReviewAuthority>;
  let tx: jest.Mocked<ReviewTransaction>, reviews: Reviews;
  beforeEach(() => {
    tx = {
      receipt: jest.fn().mockResolvedValue(null),
      own: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue(record),
      commit: jest
        .fn()
        .mockImplementation(async ({ record }) => ({
          id: record.id,
          revision: record.revision,
        })),
    };
    repository = {
      transaction: jest
        .fn()
        .mockImplementation(async (_scope, _actor, work) => work(tx)),
      summary: jest.fn().mockResolvedValue({ value: summary, revision: 2 }),
      page: jest
        .fn()
        .mockResolvedValue({
          value: {
            items: [],
            next: null,
            mine: null,
            summary,
            canModerate: false,
          },
          revision: 2,
        }),
      read: jest.fn().mockResolvedValue({ value: null, revision: 2 }),
      reports: jest
        .fn()
        .mockResolvedValue({ value: { items: [], next: null }, revision: 2 }),
      revision: jest.fn().mockResolvedValue(2),
    };
    authority = {
      visible: jest.fn().mockResolvedValue(true),
      authorize: jest
        .fn()
        .mockResolvedValue({ allowed: true, moderator: false }),
    };
    reviews = new Reviews(
      repository,
      authority,
      { next: () => id, fingerprint },
      actor.tenantId,
      () => 10
    );
  });
  const publishBody = { content, expectedRevision: 0 };
  const publish = (reviews: Reviews, context = bindingKey, member = actor) =>
    reviews.change(context, null, 'publish', publishBody, member, key);

  it.each([bindingKey, bindingKey.toLowerCase(), bindingKey + '2'])(
    'passes an unfamiliar exact key to authority and storage: %s',
    async (context) => {
      expect(await publish(reviews, context)).toEqual({ id, revision: 1 });
      expect(repository.transaction).toHaveBeenCalledWith(
        { bindingKey: context, tenantId: actor.tenantId },
        actor.identityId,
        expect.any(Function),
        null
      );
      expect(authority.visible).toHaveBeenNthCalledWith(2, {
        bindingKey: context,
        tenantId: actor.tenantId,
      });
      expect(tx.receipt).toHaveBeenCalledWith({
        actorId: actor.identityId,
        key,
        fingerprint: fingerprint(
          JSON.stringify({
            id: null,
            change: { type: 'publish', expectedRevision: 0, content },
          })
        ),
      });
    }
  );
  it('leaves tenant policy to the consumer while preserving exact tenant scope', async () => {
    await publish(reviews, bindingKey, { ...actor, tenantId: 'Tenant-B' });
    expect(repository.transaction.mock.calls[0][0]).toEqual({
      bindingKey,
      tenantId: 'Tenant-B',
    });
  });
  it('returns the stored receipt without replaying the transition or publishing new content', async () => {
    tx.receipt.mockResolvedValue({ id, revision: 1 });
    expect(await publish(reviews)).toEqual({ id, revision: 1 });
    expect(tx.own).not.toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });
  it('rechecks revoked parent access inside the transaction before receipt replay', async () => {
    tx.receipt.mockResolvedValue({ id, revision: 1 });
    authority.visible.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(publish(reviews)).rejects.toBeInstanceOf(ReviewMissingError);
    expect(tx.receipt).not.toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });
  it('fails closed on denied or unavailable consumer authority', async () => {
    authority.authorize
      .mockResolvedValueOnce({ allowed: false, moderator: true })
      .mockRejectedValueOnce(new Error('Authority unavailable'));
    await expect(publish(reviews)).rejects.toBeInstanceOf(ReviewDeniedError);
    await expect(publish(reviews)).rejects.toThrow('Authority unavailable');
    expect(repository.transaction).not.toHaveBeenCalled();
  });
  it('does not infer moderation authority from role names', async () => {
    await expect(
      reviews.page(bindingKey, { ...actor, roles: ['admin'] }, null, true)
    ).rejects.toBeInstanceOf(ReviewDeniedError);
    authority.authorize.mockResolvedValue({ allowed: true, moderator: true });
    await reviews.page(bindingKey, actor, null, true);
    expect(repository.page).toHaveBeenCalledWith(
      { bindingKey, tenantId: actor.tenantId },
      { actorId: actor.identityId, moderator: true },
      null,
      true
    );
  });
  it('keeps staff restoration independent from author withdrawal', async () => {
    authority.authorize.mockResolvedValue({ allowed: true, moderator: true });
    await reviews.change(
      bindingKey,
      id,
      'moderate',
      { expectedRevision: 2, hidden: false, reason: 'Restored' },
      { ...actor, identityId: 'Staff' },
      key
    );
    expect(tx.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({
          withdrawn: true,
          hidden: false,
          revision: 3,
        }),
      })
    );
  });
  it('keeps author publication independent from staff hiding', async () => {
    tx.own.mockResolvedValue(record);
    await reviews.change(
      bindingKey,
      null,
      'publish',
      { expectedRevision: 2, content },
      actor,
      key
    );
    expect(tx.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({
          hidden: true,
          withdrawn: false,
          contentRevision: 3,
        }),
      })
    );
  });
  it('checks parent authority again after a canonical snapshot and rejects revision drift', async () => {
    repository.revision.mockResolvedValueOnce(3);
    await expect(reviews.page(bindingKey, actor, null)).rejects.toBeInstanceOf(
      ReviewConflictError
    );
    authority.visible.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(reviews.summary(bindingKey, null)).rejects.toBeInstanceOf(
      ReviewMissingError
    );
  });
  it.each(['', 'x'.repeat(257), ' key', 'key\n', 'Key\u0000'])(
    'rejects invalid binding %j before persistence',
    async (context) => {
      await expect(publish(reviews, context)).rejects.toThrow();
      expect(repository.transaction).not.toHaveBeenCalled();
    }
  );
  it('rejects authenticated scope forgery and anonymous mutation', async () => {
    await expect(
      publish(reviews, bindingKey, { ...actor, identityId: '' })
    ).rejects.toBeInstanceOf(ReviewDeniedError);
    await expect(
      publish(reviews, bindingKey, null as unknown as ReviewActor)
    ).rejects.toBeInstanceOf(ReviewDeniedError);
    expect(repository.transaction).not.toHaveBeenCalled();
  });
});
