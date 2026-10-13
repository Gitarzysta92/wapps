import { PlatformMongoClient } from './mongo';
import { MongoClient } from 'mongodb';

jest.mock('mongodb', () => ({ MongoClient: jest.fn() }));

describe('PlatformMongoClient', () => {
  it('should work', () => {
    const client = new PlatformMongoClient();
    expect(client).toBeInstanceOf(PlatformMongoClient);
  });

  it('rejects access before connecting and rejects a missing host', async () => {
    const client = new PlatformMongoClient();
    expect(() => client.collection('items')).toThrow('not initialized');
    await expect(client.connect({ host: '' })).rejects.toThrow('MONGO_HOST');
    await expect(client.connect({ uri: '' })).rejects.toThrow('URI is required');
  });

  function driver() {
    const database = { collection: jest.fn().mockReturnValue({ name: 'items' }) };
    const client = { connect: jest.fn().mockResolvedValue(undefined), db: jest.fn().mockReturnValue(database), close: jest.fn().mockResolvedValue(undefined) };
    jest.mocked(MongoClient).mockImplementation(() => client as unknown as MongoClient);
    return { client, database };
  }

  it('encodes credentials and selects the configured database and collection', async () => {
    const { client: underlying, database } = driver();
    const client = new PlatformMongoClient();
    await expect(client.connect({ host: 'localhost', port: 27017, username: 'user@tenant', password: 'a/b', database: 'projection' })).resolves.toBe(database);
    expect(MongoClient).toHaveBeenLastCalledWith('mongodb://user%40tenant:a%2Fb@localhost:27017', undefined);
    expect(underlying.db).toHaveBeenCalledWith('projection');
    expect(client.collection('items')).toEqual({ name: 'items' });
    expect(database.collection).toHaveBeenCalledWith('items');
  });

  it('passes through connection failures', async () => {
    const { client: underlying } = driver();
    underlying.connect.mockRejectedValueOnce(new Error('offline'));
    await expect(new PlatformMongoClient().connect({ uri: 'mongodb://localhost' })).rejects.toThrow('offline');
  });

  it('closes once and disallows collection access after close', async () => {
    const { client: underlying } = driver();
    const client = new PlatformMongoClient();
    await client.connect({ uri: 'mongodb://localhost' });
    await client.close();
    await client.close();
    expect(underlying.close).toHaveBeenCalledTimes(1);
    expect(() => client.collection('items')).toThrow('not initialized');
  });
});
