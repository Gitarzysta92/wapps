import type {
  IConfirmedQueueChannel,
  IQueuedMessage,
} from '@sdk/platform/queue';
import { EDITORIAL_PROJECTION_FAILED_QUEUE } from '@apps/shared';
import {
  appSnapshot,
  editorialEvent,
} from '../../testing/editorial-projection-fixtures';
import {
  consumeEditorialProjection,
  parseEditorialProjectionRequest,
} from './editorial-projection-consumer';
import { InvalidEditorialSnapshot } from './editorial-materialization';

function fixture() {
  const message: IQueuedMessage = {
    content: Buffer.from(JSON.stringify(editorialEvent())),
    ack: jest.fn(),
    nack: jest.fn(),
  };
  const publishConfirmed = jest.fn().mockResolvedValue(undefined);
  const queue = { publishConfirmed } as unknown as IConfirmedQueueChannel;
  const reader = { read: jest.fn().mockResolvedValue(appSnapshot()) };
  const store = {
    publish: jest.fn().mockResolvedValue('published'),
    find: jest.fn(),
  };
  const wait = jest.fn().mockResolvedValue(undefined);
  return {
    message,
    queue,
    reader,
    store,
    wait,
    publishConfirmed,
    run: () =>
      consumeEditorialProjection(message, queue, reader, store, { wait }),
  };
}

describe('Editorial projection delivery recovery', () => {
  it('accepts suite requests with matching envelope and payload identities', () => {
    const event = editorialEvent();
    const request = {
      ...event,
      meta: {
        ...event.meta,
        subject: { ...event.meta.subject, entityType: 'suite' },
      },
      payload: { ...event.payload, kind: 'suite' },
    };
    expect(
      parseEditorialProjectionRequest(Buffer.from(JSON.stringify(request)))
    ).toEqual(request.payload);
  });
  it('acknowledges only after a complete projection has durably published', async () => {
    const f = fixture();
    f.store.publish.mockImplementation(async () => {
      expect(f.message.ack).not.toHaveBeenCalled();
      return 'published';
    });
    expect(await f.run()).toBe('materialized');
    expect(f.message.ack).toHaveBeenCalledTimes(1);
    expect(f.publishConfirmed).not.toHaveBeenCalled();
  });

  it('retries storage failures with bounded waits before transferring the retained request', async () => {
    const f = fixture();
    f.store.publish.mockRejectedValue(new Error('Mongo unavailable'));
    expect(await f.run()).toBe('dead-lettered');
    expect(f.store.publish).toHaveBeenCalledTimes(4);
    expect(f.wait.mock.calls.map(([time]) => time)).toEqual([
      1000, 5000, 30000,
    ]);
    expect(f.publishConfirmed).toHaveBeenCalledWith(
      EDITORIAL_PROJECTION_FAILED_QUEUE,
      f.message.content,
      expect.objectContaining({
        headers: {
          'x-wapps-failure': 'MaterializationFailed',
          'x-wapps-attempts': 4,
        },
      })
    );
    expect(f.message.ack).toHaveBeenCalledTimes(1);
    expect(f.message.nack).not.toHaveBeenCalled();
  });

  it('retries a behind SQL replica and then materializes its committed revision', async () => {
    const f = fixture();
    f.message.content = Buffer.from(JSON.stringify(editorialEvent(2)));
    f.reader.read
      .mockResolvedValueOnce(appSnapshot())
      .mockResolvedValue(appSnapshot({ revision: 2 }));
    expect(await f.run()).toBe('materialized');
    expect(f.wait).toHaveBeenCalledWith(1000);
    expect(f.store.publish).toHaveBeenCalledTimes(1);
  });

  it('confirms a poison-message transfer before acknowledging the original delivery', async () => {
    const f = fixture();
    f.message.content = Buffer.from('not-json');
    f.publishConfirmed.mockImplementation(async () => {
      expect(f.message.ack).not.toHaveBeenCalled();
    });
    expect(await f.run()).toBe('dead-lettered');
    expect(f.reader.read).not.toHaveBeenCalled();
    expect(f.wait).not.toHaveBeenCalled();
    expect(f.message.ack).toHaveBeenCalledTimes(1);
  });

  it('leaves unknown failed-queue transfer outcomes unacknowledged for host recovery', async () => {
    const f = fixture();
    f.message.content = Buffer.from('{}');
    f.publishConfirmed.mockRejectedValue(new Error('confirmation lost'));
    await expect(f.run()).rejects.toThrow('confirmation lost');
    expect(f.message.ack).not.toHaveBeenCalled();
    expect(f.message.nack).not.toHaveBeenCalled();
  });

  it('propagates acknowledgement failure after durable publication without sending completed work to the failed queue', async () => {
    const f = fixture();
    jest.mocked(f.message.ack).mockImplementation(() => {
      throw new Error('channel closed');
    });
    await expect(f.run()).rejects.toThrow('channel closed');
    expect(f.store.publish).toHaveBeenCalledTimes(1);
    expect(f.publishConfirmed).not.toHaveBeenCalled();
    expect(f.wait).not.toHaveBeenCalled();
  });

  it.each([4, 'invalid', -1])(
    'bounds repeated broker redeliveries %#',
    async (count) => {
      const f = fixture();
      f.message.headers = { 'x-delivery-count': count };
      expect(await f.run()).toBe('dead-lettered');
      expect(f.reader.read).not.toHaveBeenCalled();
    }
  );

  it('does not acknowledge or quarantine on deliberate shutdown', async () => {
    const f = fixture();
    const abort = new AbortController();
    abort.abort();
    await expect(
      consumeEditorialProjection(f.message, f.queue, f.reader, f.store, {
        signal: abort.signal,
      })
    ).rejects.toThrow('stopping');
    expect(f.message.ack).not.toHaveBeenCalled();
    expect(f.publishConfirmed).not.toHaveBeenCalled();
  });

  it.each([
    { payload: { ...editorialEvent().payload, resourceId: 'bad' } },
    { payload: { ...editorialEvent().payload, revision: '1' } },
    { payload: { ...editorialEvent().payload, tenantId: null } },
    { payload: { ...editorialEvent().payload, ownerIdentityId: 'injected' } },
    { meta: { ...editorialEvent().meta, version: 2 } },
    {
      meta: {
        ...editorialEvent().meta,
        subject: { entityType: 'tag', entityId: 'other' },
      },
    },
  ])('rejects malformed event contracts %#', (invalid) => {
    expect(() =>
      parseEditorialProjectionRequest(
        Buffer.from(JSON.stringify({ ...editorialEvent(), ...invalid }))
      )
    ).toThrow(InvalidEditorialSnapshot);
  });

  it('rejects oversized messages before parsing', () => {
    expect(() => parseEditorialProjectionRequest(Buffer.alloc(16385))).toThrow(
      'Oversized'
    );
  });
});
