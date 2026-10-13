import { createHash } from 'node:crypto';
import {
  DISCUSSION_GENERATION_DEAD_LETTER_QUEUE,
  DiscussionSnapshot,
} from '@apps/shared';
import { IConfirmedQueueChannel, IQueuedMessage } from '@sdk/platform/queue';
import { consumeGeneration } from './generation-consumer';
import {
  DiscussionGenerationStore,
  DiscussionSnapshotReader,
} from './materialization';

const id = '00000000-0000-4000-8000-000000000001';
const body = Buffer.from('{"content":"body"}');
const snapshot: DiscussionSnapshot = {
  discussionId: id,
  tenantId: 'default',
  revision: 1,
  subjectId: null,
  subjectReferenceKey: null,
  nodes: [
    {
      id,
      referenceKey: id,
      kind: 'discussion',
      parentId: null,
      ownerIdentityId: 'owner',
      state: 'published',
      visibility: 'public',
      createdAt: 1,
      updatedAt: null,
      deletedAt: null,
      likeCount: 0,
      payload: {
        key: 'object',
        bytes: body.length,
        sha256: createHash('sha256').update(body).digest('hex'),
      },
    },
  ],
};

function fixture() {
  const message: jest.Mocked<IQueuedMessage> = {
    content: Buffer.from(
      JSON.stringify({
        meta: {
          id,
          version: 2,
          type: 'discussion.materialization.requested',
          occurredAt: new Date(0).toISOString(),
          producer: { service: 'test' },
          correlation: { correlationId: id },
        },
        payload: { discussionId: id, revision: 1 },
      })
    ),
    ack: jest.fn(),
    nack: jest.fn(),
  };
  const queue: jest.Mocked<IConfirmedQueueChannel> = {
    closed: new Promise(() => undefined),
    isOpen: jest.fn().mockReturnValue(true),
    publishConfirmed: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn(),
    sendToQueue: jest.fn(),
    consume: jest.fn(),
    prefetch: jest.fn(),
  };
  const reader: jest.Mocked<DiscussionSnapshotReader> = {
    read: jest.fn().mockResolvedValue(snapshot),
  };
  const store: jest.Mocked<DiscussionGenerationStore> = {
    writeNodes: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue('published'),
  };
  const wait = jest.fn().mockResolvedValue(undefined);
  const run = () =>
    consumeGeneration(
      message,
      queue,
      reader,
      { read: async () => body },
      store,
      { wait }
    );
  return { message, queue, reader, store, wait, run };
}

describe('generation consumer acknowledgement boundary', () => {
  it('acknowledges only after durable generation publication', async () => {
    const { run, store, message } = fixture();
    store.publish.mockImplementation(async () => {
      expect(message.ack).not.toHaveBeenCalled();
      return 'published';
    });
    expect(await run()).toBe('materialized');
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('recovers from a transient store failure with bounded backoff', async () => {
    const { run, reader, wait, message } = fixture();
    reader.read.mockRejectedValueOnce(new Error('MySQL restarting'));
    expect(await run()).toBe('materialized');
    expect(wait).toHaveBeenCalledWith(1000);
    expect(reader.read).toHaveBeenCalledTimes(2);
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('transfers exhausted work durably before acknowledgement', async () => {
    const { run, reader, wait, queue, message } = fixture();
    reader.read.mockRejectedValue(new Error('Unavailable'));
    queue.publishConfirmed.mockImplementation(async () => {
      expect(message.ack).not.toHaveBeenCalled();
    });
    expect(await run()).toBe('dead-lettered');
    expect(reader.read).toHaveBeenCalledTimes(4);
    expect(wait.mock.calls.map((call) => call[0])).toEqual([1000, 5000, 30000]);
    expect(queue.publishConfirmed).toHaveBeenCalledWith(
      DISCUSSION_GENERATION_DEAD_LETTER_QUEUE,
      message.content,
      expect.any(Object)
    );
    expect(message.ack).toHaveBeenCalledTimes(1);
  });

  it('does not acknowledge or discard work when failed-queue transfer is uncertain', async () => {
    const { run, queue, message } = fixture();
    message.content = Buffer.from('invalid JSON');
    queue.publishConfirmed.mockRejectedValue(new Error('Confirmation lost'));
    await expect(run()).rejects.toThrow('Confirmation lost');
    expect(message.ack).not.toHaveBeenCalled();
    expect(message.nack).not.toHaveBeenCalled();
  });

  it('quarantines poison requests immediately without querying authoritative storage', async () => {
    const { run, reader, wait, message } = fixture();
    message.content = Buffer.from('{"payload":null}');
    expect(await run()).toBe('dead-lettered');
    expect(reader.read).not.toHaveBeenCalled();
    expect(wait).not.toHaveBeenCalled();
  });

  it('bounds attempts across broker redeliveries', async () => {
    const { run, reader, message } = fixture();
    message.headers = { 'x-delivery-count': 4 };
    expect(await run()).toBe('dead-lettered');
    expect(reader.read).not.toHaveBeenCalled();
  });

  it('does not publish a snapshot older than the committed revision in the request', async () => {
    const { run, message, store } = fixture();
    const event = JSON.parse(message.content.toString());
    event.payload.revision = 2;
    message.content = Buffer.from(JSON.stringify(event));
    expect(await run()).toBe('dead-lettered');
    expect(store.writeNodes).not.toHaveBeenCalled();
    expect(store.publish).not.toHaveBeenCalled();
  });
});
