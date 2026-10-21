import { ConfigService } from '@nestjs/config';
import { EditorialCatalogProjections } from './editorial-catalog-projections';
import { projectEditorialSnapshot } from '../application/editorial-materialization';
import { appSnapshot } from '../../testing/editorial-projection-fixtures';

const connect = jest.fn();
const close = jest.fn();
const findOne = jest.fn();
const collection = jest.fn();
const insertOne = jest.fn();
jest.mock('@sdk/extras/mongo', () => ({
  PlatformMongoClient: jest.fn().mockImplementation(() => ({
    connect: (...args: unknown[]) => connect(...args),
    close: () => close(),
    collection: (...args: unknown[]) => collection(...args),
  })),
}));

describe('catalog projection connection lifecycle', () => {
  const config = new ConfigService({
    MONGO_HOST: 'mongo',
    MONGO_PORT: '27017',
    MONGO_USERNAME: 'reader',
    MONGO_PASSWORD: 'local-test',
    MONGO_DATABASE: 'editorial',
  });
  const id = '019a0010-0000-7000-8000-000000000001';
  beforeEach(() => {
    for (const mock of [connect, close, findOne, collection, insertOne])
      mock.mockReset();
    close.mockResolvedValue(undefined);
    collection.mockReturnValue({ findOne, insertOne });
    findOne.mockResolvedValue(null);
  });

  it('shares the configured connection for durable erasure publication and readback', async () => {
    connect.mockResolvedValue(undefined);
    insertOne.mockResolvedValue({ acknowledged: true });
    const store = new EditorialCatalogProjections(config);
    const projection = projectEditorialSnapshot(appSnapshot({ revision: 2 }));
    await expect(store.publish(projection)).resolves.toBe('published');
    expect(insertOne).toHaveBeenCalledWith(projection, {
      writeConcern: { w: 'majority', j: true },
    });
    findOne.mockResolvedValue(projection);
    await expect(store.find('app', id)).resolves.toEqual(projection);
    expect(connect).toHaveBeenCalledTimes(1);
    await store.onModuleDestroy();
    await expect(store.publish(projection)).rejects.toThrow('stopped');
  });

  it('connects lazily, shares attempts and closes on shutdown', async () => {
    let ready: () => void = () => undefined;
    connect.mockReturnValue(
      new Promise<void>((resolve) => {
        ready = resolve;
      })
    );
    const reader = new EditorialCatalogProjections(config);
    expect(connect).not.toHaveBeenCalled();
    const first = reader.find('app', id);
    const second = reader.find('app', id);
    expect(connect).toHaveBeenCalledTimes(1);
    ready();
    await expect(Promise.all([first, second])).resolves.toEqual([null, null]);
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          maxPoolSize: 20,
          serverSelectionTimeoutMS: 3000,
          socketTimeoutMS: 5000,
        }),
      })
    );
    expect(findOne).toHaveBeenCalledWith(
      { _id: `app:${id}` },
      {
        readConcern: { level: 'majority' },
        readPreference: 'primary',
        maxTimeMS: 3000,
      }
    );
    await reader.onModuleDestroy();
    expect(close).toHaveBeenCalledTimes(1);
    await expect(reader.find('app', id)).rejects.toThrow('stopped');
  });

  it('releases failed connections and retries instead of retaining a permanent rejection', async () => {
    connect
      .mockRejectedValueOnce(new Error('Mongo down'))
      .mockResolvedValueOnce(undefined);
    const reader = new EditorialCatalogProjections(config);
    await expect(reader.find('app', id)).rejects.toThrow('Mongo down');
    expect(close).toHaveBeenCalledTimes(1);
    await expect(reader.find('app', id)).resolves.toBeNull();
    expect(connect).toHaveBeenCalledTimes(2);
    await reader.onModuleDestroy();
  });

  it('reports missing configuration without selecting another database or starting I/O', async () => {
    const reader = new EditorialCatalogProjections(new ConfigService());
    await expect(reader.find('app', id)).rejects.toThrow('Missing MONGO_HOST');
    expect(connect).not.toHaveBeenCalled();
    await reader.onModuleDestroy();
  });
});
