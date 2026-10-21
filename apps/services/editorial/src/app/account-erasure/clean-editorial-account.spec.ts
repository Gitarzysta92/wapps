import {
  CleanEditorialAccount,
  type EditorialErasureCompletion,
} from './clean-editorial-account';

const request = { identityId: 'ErasedAuthor', revision: 8 };
function fixture(enabled = true) {
  const contributions = { advance: jest.fn().mockResolvedValue(false) };
  const workspace = { advance: jest.fn().mockResolvedValue('drained') };
  const audit = { advance: jest.fn().mockResolvedValue('drained') };
  const projections = { advance: jest.fn().mockResolvedValue('drained') };
  const completion: jest.Mocked<EditorialErasureCompletion> = {
    state: jest.fn().mockResolvedValue('pending'),
    complete: jest.fn().mockResolvedValue('completed'),
  };
  return {
    contributions,
    workspace,
    audit,
    projections,
    completion,
    cleanup: new CleanEditorialAccount(
      contributions,
      workspace,
      audit,
      projections,
      completion,
      enabled
    ),
  };
}

describe('Editorial erasure composition', () => {
  it('requires an exact request and checks durable state before cleanup', async () => {
    const f = fixture();
    await expect(
      f.cleanup.advance({ ...request, revision: 0 })
    ).rejects.toThrow();
    expect(f.completion.state).not.toHaveBeenCalled();
    f.completion.state.mockRejectedValue(new Error('Missing request'));
    await expect(f.cleanup.advance(request)).rejects.toThrow('Missing request');
    expect(f.contributions.advance).not.toHaveBeenCalled();
  });
  it('keeps pending requests untouched until old writers are fenced', async () => {
    const f = fixture(false);
    await expect(f.cleanup.advance(request)).resolves.toBe('pending');
    expect(f.contributions.advance).not.toHaveBeenCalled();
    expect(f.completion.complete).not.toHaveBeenCalled();
  });
  it.each([
    ['contributions', true, 'workspace'],
    ['workspace', 'pending', 'audit'],
    ['workspace', 'media-pending', 'audit'],
    ['audit', 'pending', 'projections'],
    ['projections', 'pending', null],
  ] as const)(
    'does not skip unfinished %s (%s)',
    async (phase, state, next) => {
      const f = fixture();
      f[phase].advance.mockResolvedValue(state);
      await expect(f.cleanup.advance(request)).resolves.toBe('pending');
      if (next) expect(f[next].advance).not.toHaveBeenCalled();
      expect(f.completion.complete).not.toHaveBeenCalled();
    }
  );
  it('requires every phase in order and preserves a final residual check returning pending', async () => {
    const f = fixture();
    f.completion.complete.mockResolvedValueOnce('pending');
    await expect(f.cleanup.advance(request)).resolves.toBe('pending');
    await expect(f.cleanup.advance(request)).resolves.toBe('completed');
    const calls = [
      f.contributions.advance,
      f.workspace.advance,
      f.audit.advance,
      f.projections.advance,
      f.completion.complete,
    ];
    for (let i = 0; i < calls.length; i++) {
      expect(calls[i]).toHaveBeenCalledWith(request);
      if (i)
        expect(calls[i - 1].mock.invocationCallOrder[0]).toBeLessThan(
          calls[i].mock.invocationCallOrder[0]
        );
    }
  });
  it.each(['contributions', 'workspace', 'audit', 'projections'] as const)(
    'propagates %s failure without completing',
    async (phase) => {
      const f = fixture();
      f[phase].advance.mockRejectedValue(new Error('Store unavailable'));
      await expect(f.cleanup.advance(request)).rejects.toThrow(
        'Store unavailable'
      );
      expect(f.completion.complete).not.toHaveBeenCalled();
    }
  );
  it('accepts independently confirmed concurrent completion after an in-flight failure', async () => {
    const f = fixture();
    f.projections.advance.mockRejectedValue(new Error('Request completed'));
    f.completion.state
      .mockResolvedValueOnce('pending')
      .mockResolvedValueOnce('completed');
    await expect(f.cleanup.advance(request)).resolves.toBe('completed');
    expect(f.completion.complete).not.toHaveBeenCalled();
  });
  it('replays durable completion without using Mongo or erased private state even when activation is off', async () => {
    const f = fixture(false);
    f.completion.state.mockResolvedValue('completed');
    await expect(f.cleanup.advance(request)).resolves.toBe('completed');
    expect(f.contributions.advance).not.toHaveBeenCalled();
    expect(f.projections.advance).not.toHaveBeenCalled();
  });
});
