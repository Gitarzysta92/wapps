import type { Collection } from 'mongodb';
import type { EditorialProjection } from '@apps/shared';
import {
  appContent,
  appSnapshot,
  editorialId,
} from '../../testing/editorial-projection-fixtures';
import { projectEditorialSnapshot } from '../application/editorial-materialization';
import { MongoEditorialProjections } from './mongo-editorial-projections';

function fixture() {
  const documents = new Map<string, EditorialProjection>();
  const clone = (value: EditorialProjection): EditorialProjection =>
    JSON.parse(JSON.stringify(value));
  const findOne = jest.fn(async ({ _id }: { _id: string }) => {
    const value = documents.get(_id);
    return value ? clone(value) : null;
  });
  const insertOne = jest.fn(async (value: EditorialProjection) => {
    await Promise.resolve();
    if (documents.has(value._id))
      throw Object.assign(new Error('duplicate'), { code: 11000 });
    documents.set(value._id, clone(value));
    return { acknowledged: true };
  });
  const replaceOne = jest.fn(
    async (
      filter: { _id: string; revision: number; fingerprint: string },
      value: EditorialProjection
    ) => {
      await Promise.resolve();
      const current = documents.get(filter._id);
      if (
        !current ||
        current.revision !== filter.revision ||
        current.fingerprint !== filter.fingerprint
      )
        return { matchedCount: 0 };
      documents.set(value._id, clone(value));
      return { matchedCount: 1 };
    }
  );
  const collection = {
    findOne,
    insertOne,
    replaceOne,
  } as unknown as Collection<EditorialProjection>;
  return {
    documents,
    findOne,
    insertOne,
    replaceOne,
    store: new MongoEditorialProjections(collection),
  };
}

describe('Editorial complete-document publication', () => {
  it('publishes complete content with majority+journal durability and replays without another write', async () => {
    const f = fixture();
    const projection = projectEditorialSnapshot(appSnapshot());
    expect(await f.store.publish(projection)).toBe('published');
    expect(f.insertOne).toHaveBeenCalledWith(projection, {
      writeConcern: { w: 'majority', j: true },
    });
    expect(await f.store.publish(projection)).toBe('unchanged');
    expect(f.insertOne).toHaveBeenCalledTimes(1);
    expect(f.replaceOne).not.toHaveBeenCalled();
    expect(f.findOne).toHaveBeenLastCalledWith(
      { _id: projection._id },
      {
        readConcern: { level: 'majority' },
        readPreference: 'primary',
        maxTimeMS: 3000,
      }
    );
  });

  it('converges concurrent first inserts and revision updates to the newest complete document', async () => {
    const f = fixture();
    const one = projectEditorialSnapshot(appSnapshot());
    const two = projectEditorialSnapshot(
      appSnapshot({ revision: 2, content: { ...appContent(), name: 'Second' } })
    );
    const three = projectEditorialSnapshot(
      appSnapshot({ revision: 3, content: { ...appContent(), name: 'Third' } })
    );
    await Promise.all([
      f.store.publish(two),
      f.store.publish(one),
      f.store.publish(three),
    ]);
    expect(await f.store.find('app', editorialId())).toEqual(three);
    expect(await f.store.publish(two)).toBe('superseded');
  });

  it('does not resurrect a tombstoned resource on stale delivery', async () => {
    const f = fixture();
    const live = projectEditorialSnapshot(appSnapshot());
    const deleted = projectEditorialSnapshot(
      appSnapshot({ revision: 2, deletedAt: 10, content: null })
    );
    await f.store.publish(live);
    await f.store.publish(deleted);
    expect(await f.store.publish(live)).toBe('superseded');
    expect(await f.store.find('app', editorialId())).toEqual(deleted);
  });

  it('rejects different authoritative content at one revision', async () => {
    const f = fixture();
    await f.store.publish(projectEditorialSnapshot(appSnapshot()));
    await expect(
      f.store.publish(
        projectEditorialSnapshot(
          appSnapshot({ content: { ...appContent(), name: 'Conflicting' } })
        )
      )
    ).rejects.toThrow('one revision');
    expect(f.replaceOne).not.toHaveBeenCalled();
  });

  it('detects projection corruption rather than trusting only its stored fingerprint', async () => {
    const f = fixture();
    const projection = projectEditorialSnapshot(appSnapshot());
    f.documents.set(projection._id, {
      ...projection,
      content: { ...appContent(), name: 'Corrupt' },
    });
    await expect(f.store.publish(projection)).rejects.toThrow(
      'Conflicting projection'
    );
  });

  it('keeps the old complete document if replacement fails', async () => {
    const f = fixture();
    const before = projectEditorialSnapshot(appSnapshot());
    await f.store.publish(before);
    f.replaceOne.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(
      f.store.publish(projectEditorialSnapshot(appSnapshot({ revision: 2 })))
    ).rejects.toThrow('storage unavailable');
    expect(await f.store.find('app', editorialId())).toEqual(before);
  });

  it('bounds compare-and-replace contention for caller retry', async () => {
    const f = fixture();
    await f.store.publish(projectEditorialSnapshot(appSnapshot()));
    f.replaceOne.mockResolvedValue({ matchedCount: 0 });
    await expect(
      f.store.publish(projectEditorialSnapshot(appSnapshot({ revision: 2 })))
    ).rejects.toThrow('Concurrent');
    expect(f.replaceOne).toHaveBeenCalledTimes(4);
  });
});
