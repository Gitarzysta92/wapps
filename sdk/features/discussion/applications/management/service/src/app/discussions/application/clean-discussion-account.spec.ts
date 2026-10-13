import {
  CleanDiscussionAccount,
  type DiscussionErasureCompletion,
} from './clean-discussion-account';

const request = { identityId: 'ErasedMember', revision: 3 };
function fixture(enabled = true) {
  const contributions = { advance: jest.fn().mockResolvedValue(false) };
  const payloads = { advance: jest.fn().mockResolvedValue(0) };
  const privateData = { advance: jest.fn().mockResolvedValue('drained') };
  const reviews = { advance: jest.fn().mockResolvedValue('drained') };
  const projections = { advance: jest.fn().mockResolvedValue('drained') };
  const completion: jest.Mocked<DiscussionErasureCompletion> = {
    state: jest.fn().mockResolvedValue('pending'),
    complete: jest.fn().mockResolvedValue('completed'),
  };
  return {
    contributions,
    payloads,
    privateData,
    reviews,
    projections,
    completion,
    cleanup: new CleanDiscussionAccount(
      contributions,
      payloads,
      privateData,
      reviews,
      projections,
      completion,
      enabled
    ),
  };
}

describe('Discussion account erasure composition', () => {
  it('keeps requests pending without the old-worker activation acknowledgement', async () => {
    const f = fixture(false);
    await expect(f.cleanup.advance(request)).resolves.toBe('pending');
    expect(f.contributions.advance).not.toHaveBeenCalled();
    expect(f.completion.complete).not.toHaveBeenCalled();
  });

  it.each([
    ['contributions', true, 'payloads'],
    ['payloads', 1, 'privateData'],
    ['privateData', 'pending', 'reviews'],
    ['reviews', 'pending', 'projections'],
    ['projections', 'pending', null],
  ] as const)(
    'does not advance past unfinished %s',
    async (phase, progress, next) => {
      const f = fixture();
      f[phase].advance.mockResolvedValue(progress);
      await expect(f.cleanup.advance(request)).resolves.toBe('pending');
      if (next) expect(f[next].advance).not.toHaveBeenCalled();
      expect(f.completion.complete).not.toHaveBeenCalled();
    }
  );

  it('requires durable completion after every store drains and preserves SQL pending', async () => {
    const f = fixture();
    f.completion.complete.mockResolvedValueOnce('pending');
    await expect(f.cleanup.advance(request)).resolves.toBe('pending');
    await expect(f.cleanup.advance(request)).resolves.toBe('completed');
    expect(f.projections.advance.mock.invocationCallOrder[0]).toBeLessThan(
      f.completion.complete.mock.invocationCallOrder[0]
    );
    expect(f.completion.complete).toHaveBeenCalledWith(request);
  });

  it('propagates a storage failure while the receipt is pending', async () => {
    const f = fixture();
    f.payloads.advance.mockRejectedValue(
      new Error('Object storage unavailable')
    );
    await expect(f.cleanup.advance(request)).rejects.toThrow(
      'Object storage unavailable'
    );
    expect(f.privateData.advance).not.toHaveBeenCalled();
    expect(f.completion.complete).not.toHaveBeenCalled();
  });

  it('accepts a verified concurrent completion after an in-flight phase loses its pending request', async () => {
    const f = fixture();
    f.projections.advance.mockRejectedValue(
      new Error('Request already completed')
    );
    f.completion.state
      .mockResolvedValueOnce('pending')
      .mockResolvedValueOnce('completed');
    await expect(f.cleanup.advance(request)).resolves.toBe('completed');
    expect(f.completion.complete).not.toHaveBeenCalled();
  });

  it('replays completed requests without accessing retired payloads or projections', async () => {
    const f = fixture(false);
    f.completion.state.mockResolvedValue('completed');
    await expect(f.cleanup.advance(request)).resolves.toBe('completed');
    expect(f.contributions.advance).not.toHaveBeenCalled();
    expect(f.projections.advance).not.toHaveBeenCalled();
  });
});
