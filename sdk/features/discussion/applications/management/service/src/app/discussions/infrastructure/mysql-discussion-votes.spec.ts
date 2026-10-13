import type { DataSource } from 'typeorm';
import { MysqlDiscussionVotes } from './mysql-discussion-votes';

describe('canonical discussion vote snapshots', () => {
  const query = jest.fn();
  const transaction = jest.fn((_isolation, work) => work({ query }));
  const reader = new MysqlDiscussionVotes({
    transaction,
  } as unknown as DataSource);
  beforeEach(() => {
    query.mockReset();
    transaction.mockClear();
  });
  it('reads totals and only the authenticated actor choice in the same repeatable-read revision', async () => {
    query
      .mockResolvedValueOnce([{ revision: '3', subjectKind: 'application' }])
      .mockResolvedValueOnce([
        { id: 'node', upvotes: '2', downvotes: '3', mine: '-1', invalid: '0' },
      ]);
    expect(await reader.read('thread', 3, 'Alice')).toEqual(
      new Map([['node', { upvotes: 2, downvotes: 3, mine: -1 }]])
    );
    expect(transaction).toHaveBeenCalledWith(
      'REPEATABLE READ',
      expect.any(Function)
    );
    expect(query.mock.calls[1][1]).toEqual(['Alice', 'thread', 2001]);
  });
  it('never accepts vote membership from a different thread revision or content family', async () => {
    for (const rows of [
      [],
      [{ revision: 4, subjectKind: 'application' }],
      [{ revision: 3, subjectKind: 'article' }],
    ]) {
      query.mockReset().mockResolvedValueOnce(rows);
      await expect(reader.read('thread', 3, null)).rejects.toThrow(
        'changed while loading'
      );
      expect(query).toHaveBeenCalledTimes(1);
    }
  });
  it('rejects corrupt stored values, missing nodes and inconsistent membership', async () => {
    for (const rows of [
      [],
      [{ id: 'node', upvotes: 1, downvotes: 0, mine: 0, invalid: 1 }],
      [{ id: 'node', upvotes: 1, downvotes: 0, mine: -1, invalid: 0 }],
    ]) {
      query
        .mockReset()
        .mockResolvedValueOnce([{ revision: 3, subjectKind: 'application' }])
        .mockResolvedValueOnce(rows);
      await expect(reader.read('thread', 3, 'Alice')).rejects.toThrow();
    }
  });
});
