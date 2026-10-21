import { MysqlClient } from './mysql';
import { createPool } from 'mysql2/promise';

jest.mock('mysql2/promise', () => ({ createPool: jest.fn() }));

describe('MysqlClient', () => {
  it('should work', () => {
    const client = new MysqlClient();
    expect(client).toBeInstanceOf(MysqlClient);
  });

  function connected() {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    };
    const pool = { getConnection: jest.fn().mockResolvedValue(connection), end: jest.fn().mockResolvedValue(undefined) };
    jest.mocked(createPool).mockReturnValue(pool as unknown as ReturnType<typeof createPool>);
    const client = new MysqlClient();
    client.connect({ host: 'test', port: 3306, user: 'test', password: 'test', database: 'test' });
    return { client, connection, pool };
  }

  it('commits only after the transactional work resolves and releases the connection', async () => {
    const { client, connection } = connected();
    const result = await client.withTransaction(async (conn) => {
      expect(conn).toBe(connection);
      expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(connection.commit).not.toHaveBeenCalled();
      return { revision: 3 };
    });
    expect(result).toEqual({ revision: 3 });
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it.each(['begin', 'work', 'commit'])('rolls back and releases on a %s failure', async (stage) => {
    const { client, connection } = connected();
    const failure = new Error(stage);
    if (stage === 'begin') connection.beginTransaction.mockRejectedValueOnce(failure);
    if (stage === 'commit') connection.commit.mockRejectedValueOnce(failure);
    const work = jest.fn(async () => {
      if (stage === 'work') throw failure;
      return 'result';
    });
    await expect(client.withTransaction(work)).rejects.toBe(failure);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.release).toHaveBeenCalledTimes(1);
    if (stage === 'begin') expect(work).not.toHaveBeenCalled();
  });

  it('preserves the write failure when rollback itself fails', async () => {
    const { client, connection } = connected();
    const failure = new Error('write');
    connection.rollback.mockRejectedValueOnce(new Error('connection lost'));
    await expect(client.withTransaction(async () => { throw failure; })).rejects.toBe(failure);
    expect(connection.release).toHaveBeenCalledTimes(1);
  });

  it('propagates connection acquisition failures without executing a write', async () => {
    const { client, pool } = connected();
    const work = jest.fn();
    pool.getConnection.mockRejectedValueOnce(new Error('offline'));
    await expect(client.withTransaction(work)).rejects.toThrow('offline');
    expect(work).not.toHaveBeenCalled();
  });

  it('requires connection setup and clears the pool after close', async () => {
    expect(() => new MysqlClient().getPool()).toThrow('not initialized');
    const { client, pool } = connected();
    await client.close();
    await client.close();
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(() => client.getPool()).toThrow('not initialized');
  });
});
