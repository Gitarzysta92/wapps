import { createHash } from 'node:crypto';
import { ok, err } from '@sdk/kernel/standard';
import {
  ReviewConflictError,
  ReviewDeniedError,
  ReviewMissingError,
} from '@sdk/features/review/core';
import { type ReviewPage } from '@domains/community';
import { ApplicationReviews } from './application-reviews';
import type {
  ReviewRecord,
  ReviewsRepository,
  ReviewTransaction,
} from './reviews.port';

const app = '10000000-0000-4000-8000-000000000001';
const reviewId = '10000000-0000-4000-8000-000000000002';
const actor = { identityId: 'Alice', tenantId: 'default', roles: [] };
const admin = { ...actor, identityId: 'Moderator', roles: ['admin'] };
const content = {
  displayName: 'Public name',
  rating: 4,
  text: 'Useful application.',
};
const page: ReviewPage = {
  items: [],
  mine: null,
  next: null,
  canModerate: false,
  summary: { total: 0, average: null, distribution: [0, 0, 0, 0, 0] },
};
const record: ReviewRecord = {
  id: reviewId,
  ownerId: actor.identityId,
  content,
  revision: 1,
  contentRevision: 1,
  hidden: false,
  withdrawn: false,
  moderationReason: null,
  createdAt: 1000,
  updatedAt: 1000,
};

describe('Application review authorization and consistency', () => {
  let repository: jest.Mocked<ReviewsRepository>;
  let tx: jest.Mocked<ReviewTransaction>;
  let visible: jest.Mock;
  let evaluate: jest.Mock;
  let service: ApplicationReviews;
  beforeEach(() => {
    tx = {
      receipt: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue(record),
      own: jest.fn().mockResolvedValue(null),
      commit: jest.fn().mockImplementation(async (input) => ({
        id: input.record.id,
        revision: input.record.revision,
      })),
    };
    repository = {
      summary: jest
        .fn()
        .mockResolvedValue({ value: page.summary, revision: 1 }),
      transaction: jest
        .fn()
        .mockImplementation(async (_scope, _actorId, work) => work(tx)),
      page: jest.fn().mockResolvedValue({ value: page, revision: 1 }),
      read: jest.fn().mockResolvedValue({ value: null, revision: 1 }),
      reports: jest
        .fn()
        .mockResolvedValue({ value: { items: [], next: null }, revision: 1 }),
      revision: jest.fn().mockResolvedValue(1),
    };
    visible = jest.fn().mockResolvedValue(true);
    evaluate = jest.fn().mockResolvedValue(ok(true));
    service = new ApplicationReviews(
      repository,
      { visible },
      { evaluate },
      {
        next: () => reviewId,
        fingerprint: (value) =>
          createHash('sha256').update(value).digest('hex'),
      },
      'default',
      () => 2000
    );
  });
  const key = 'review-command-0001';
  function publish(expectedRevision = 0) {
    return service.change(
      app,
      null,
      'publish',
      { content, expectedRevision },
      actor,
      key
    );
  }

  it('authorizes canonical self scope before persistence and checks visibility again under lock', async () => {
    expect(await publish()).toEqual({ id: reviewId, revision: 1 });
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: 'Alice',
        tenantId: 'default',
        actionName: 'review.publish',
        resource: {
          type: 'application-review-workspace',
          id: 'Alice',
          tenantId: 'default',
        },
      })
    );
    expect(visible).toHaveBeenCalledTimes(2);
    expect(repository.transaction).toHaveBeenCalledWith(
      { tenantId: 'default', applicationId: app },
      actor.identityId,
      expect.any(Function),
      null
    );
    expect(tx.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        record: { ...record, createdAt: 2000, updatedAt: 2000 },
      })
    );
  });
  it('fails closed on false policy and policy outage without database access', async () => {
    evaluate
      .mockResolvedValueOnce(ok(false))
      .mockResolvedValueOnce(err(new Error('OPA offline')));
    await expect(publish()).rejects.toBeInstanceOf(ReviewDeniedError);
    await expect(publish()).rejects.toThrow('OPA offline');
    expect(repository.transaction).not.toHaveBeenCalled();
  });
  it('does not commit when the application becomes private while waiting for the lock', async () => {
    visible.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(publish()).rejects.toBeInstanceOf(ReviewMissingError);
    expect(tx.receipt).not.toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });
  it('replays the historical receipt without reading/reapplying a newer review', async () => {
    tx.receipt.mockResolvedValue({ id: reviewId, revision: 1 });
    expect(await publish()).toEqual({ id: reviewId, revision: 1 });
    expect(tx.own).not.toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });
  it('does not let a fresh create key overwrite the existing author slot', async () => {
    tx.own.mockResolvedValue(record);
    await expect(publish()).rejects.toBeInstanceOf(ReviewConflictError);
    expect(tx.commit).not.toHaveBeenCalled();
  });
  it('edits the stable author slot without clearing moderation or helpful metadata', async () => {
    tx.own.mockResolvedValue({
      ...record,
      hidden: true,
      moderationReason: 'Spam',
    });
    expect(await publish(1)).toEqual({ id: reviewId, revision: 2 });
    expect(tx.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({
          hidden: true,
          moderationReason: 'Spam',
          contentRevision: 2,
        }),
      })
    );
  });
  it("does not let an administrator withdraw somebody else's review", async () => {
    await expect(
      service.change(
        app,
        reviewId,
        'withdraw',
        { expectedRevision: 1 },
        admin,
        key
      )
    ).rejects.toBeInstanceOf(ReviewDeniedError);
    expect(tx.commit).not.toHaveBeenCalled();
  });
  it('keeps anonymous ownership during later independent moderation', async () => {
    tx.find.mockResolvedValue({
      ...record,
      ownerId: null,
      content: { ...content, displayName: 'Deleted account' },
    });
    await service.change(
      app,
      reviewId,
      'moderate',
      { expectedRevision: 1, hidden: true, reason: 'Spam' },
      admin,
      key
    );
    expect(tx.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({ ownerId: null }),
      })
    );
  });
  it.each(['helpful', 'report', 'moderate'] as const)(
    'refuses self %s',
    async (type) => {
      const body =
        type === 'helpful'
          ? { helpful: true }
          : type === 'report'
          ? { reason: 'Spam' }
          : { hidden: true, reason: 'Spam' };
      await expect(
        service.change(
          app,
          reviewId,
          type,
          { ...body, expectedRevision: 1 },
          { ...actor, roles: ['admin'] },
          key
        )
      ).rejects.toBeInstanceOf(ReviewDeniedError);
      expect(tx.commit).not.toHaveBeenCalled();
    }
  );
  it('requires staff both for moderation mutation and its report queue', async () => {
    await expect(
      service.change(
        app,
        reviewId,
        'moderate',
        { hidden: true, reason: 'Spam', expectedRevision: 1 },
        actor,
        key
      )
    ).rejects.toBeInstanceOf(ReviewDeniedError);
    await expect(service.page(app, actor, null, true)).rejects.toBeInstanceOf(
      ReviewDeniedError
    );
    await expect(
      service.reports(app, reviewId, actor, null)
    ).rejects.toBeInstanceOf(ReviewDeniedError);
    expect(repository.transaction).not.toHaveBeenCalled();
    expect(repository.reports).not.toHaveBeenCalled();
  });
  it('requires the moderation policy even when an admin reads a detail or ordinary listing', async () => {
    evaluate.mockResolvedValue(ok(false));
    await expect(service.read(app, reviewId, admin)).rejects.toBeInstanceOf(
      ReviewDeniedError
    );
    await expect(service.page(app, admin, null)).rejects.toBeInstanceOf(
      ReviewDeniedError
    );
    expect(repository.read).not.toHaveBeenCalled();
    expect(repository.page).not.toHaveBeenCalled();
  });
  it('refuses foreign tenant and forged actor or body scope before database access', async () => {
    await expect(
      service.change(
        app,
        null,
        'publish',
        { content, expectedRevision: 0 },
        { ...actor, tenantId: 'other' },
        key
      )
    ).rejects.toBeInstanceOf(ReviewMissingError);
    await expect(
      service.change(
        app,
        null,
        'publish',
        { content, expectedRevision: 0 },
        { ...actor, identityId: '' },
        key
      )
    ).rejects.toBeInstanceOf(ReviewDeniedError);
    await expect(
      service.change(
        app,
        null,
        'publish',
        { content, expectedRevision: 0, ownerId: 'Bob' },
        actor,
        key
      )
    ).rejects.toThrow();
    expect(repository.transaction).not.toHaveBeenCalled();
  });
  it.each(['', 'short', 'bad key with spaces', 'x'.repeat(129)])(
    'rejects malformed command key',
    async (value) => {
      await expect(
        service.change(
          app,
          null,
          'publish',
          { content, expectedRevision: 0 },
          actor,
          value
        )
      ).rejects.toThrow();
      expect(repository.transaction).not.toHaveBeenCalled();
    }
  );
  it('returns a genuine empty public summary without authorizing anonymous identities', async () => {
    expect(await service.page(app, null, null)).toEqual(page);
    expect(evaluate).not.toHaveBeenCalled();
    expect(repository.page).toHaveBeenCalledWith(
      { tenantId: 'default', applicationId: app },
      { actorId: null, moderator: false },
      null,
      false
    );
  });
  it('rejects a result if moderation/withdrawal changes during the final external visibility request', async () => {
    repository.revision.mockResolvedValue(2);
    await expect(service.page(app, null, null)).rejects.toBeInstanceOf(
      ReviewConflictError
    );
  });
  it('does not return a snapshot after parent withdrawal or target outage', async () => {
    visible.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(service.page(app, null, null)).rejects.toBeInstanceOf(
      ReviewMissingError
    );
    visible.mockRejectedValue(new Error('Catalog unavailable'));
    await expect(service.page(app, null, null)).rejects.toThrow(
      'Catalog unavailable'
    );
  });
});
