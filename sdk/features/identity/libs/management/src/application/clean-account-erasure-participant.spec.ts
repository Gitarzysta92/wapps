import { CleanAccountErasureParticipant } from './clean-account-erasure-participant';

describe('owning-service erasure cleanup orchestration', () => {
  const input = { identityId: 'Member', revision: 7 };
  function fixture(state = 'pending') {
    const request = jest
      .fn()
      .mockResolvedValue({ ...input, participant: 'account', state });
    const advance = jest.fn().mockResolvedValue('completed');
    return {
      request,
      advance,
      participant: new CleanAccountErasureParticipant(
        { name: 'account', request },
        { advance }
      ),
    };
  }
  it('durably accepts the barrier before cleanup can advance', async () => {
    const f = fixture();
    expect(await f.participant.request(input)).toEqual({
      ...input,
      participant: 'account',
      state: 'completed',
    });
    expect(f.request.mock.invocationCallOrder[0]).toBeLessThan(
      f.advance.mock.invocationCallOrder[0]
    );
    expect(f.advance).toHaveBeenCalledWith(input);
  });
  it('preserves bounded pending work and completed receipt replay', async () => {
    const f = fixture();
    f.advance.mockResolvedValue('pending');
    expect((await f.participant.request(input)).state).toBe('pending');
    const complete = fixture('completed');
    expect((await complete.participant.request(input)).state).toBe('completed');
    expect(complete.advance).not.toHaveBeenCalled();
  });
  it('does not clean up after an invalid or failed durable request', async () => {
    const f = fixture();
    f.request.mockResolvedValue({
      ...input,
      participant: 'account',
      state: 'pending',
      revision: 8,
    });
    await expect(f.participant.request(input)).rejects.toThrow(
      'does not match'
    );
    f.request.mockRejectedValue(new Error('offline'));
    await expect(f.participant.request(input)).rejects.toThrow('offline');
    expect(f.advance).not.toHaveBeenCalled();
  });
  it('never converts a failed cleanup batch into completion', async () => {
    const f = fixture();
    f.advance.mockRejectedValue(new Error('rollback'));
    await expect(f.participant.request(input)).rejects.toThrow('rollback');
  });
});
