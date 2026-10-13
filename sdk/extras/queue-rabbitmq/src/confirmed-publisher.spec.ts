import { EventEmitter } from 'node:events';
import type { ConfirmChannel, Options } from 'amqplib';
import { ConfirmedPublisher } from './confirmed-publisher';

function fixture() {
  const callbacks: Array<(error: Error | null) => void> = [];
  const sent: Options.Publish[] = [];
  const sendToQueue: ConfirmChannel['sendToQueue'] = (
    _queue,
    _content,
    options,
    callback
  ) => {
    sent.push(options ?? {});
    if (!callback) throw new Error('Confirmed publication requires a callback');
    callbacks.push((error) => callback(error, {}));
    return false; // Backpressure says nothing about broker confirmation.
  };
  const channel = Object.assign(new EventEmitter(), {
    sendToQueue,
    close: jest.fn().mockResolvedValue(undefined),
  });
  return {
    publisher: new ConfirmedPublisher(channel),
    channel,
    sent,
    callbacks,
  };
}

describe('confirmed broker publication', () => {
  afterEach(() => jest.useRealTimers());

  it('waits for confirmation even when the socket reports backpressure', async () => {
    const { publisher, callbacks, sent } = fixture();
    let done = false;
    const publication = publisher
      .publish('work', Buffer.from('{}'))
      .then(() => {
        done = true;
      });
    await Promise.resolve();
    expect(done).toBe(false);
    expect(sent[0]).toMatchObject({ mandatory: true, persistent: true });
    callbacks[0](null);
    await publication;
    expect(done).toBe(true);
  });

  it('correlates a mandatory return to just the unroutable concurrent send', async () => {
    const { publisher, channel, sent, callbacks } = fixture();
    const lost = publisher.publish('missing', Buffer.from('{}'));
    const valid = publisher.publish('work', Buffer.from('{}'));
    const rejected = expect(lost).rejects.toThrow('unroutable');
    channel.emit('return', { properties: { messageId: sent[0].messageId } });
    callbacks[0](null);
    callbacks[1](null);
    await rejected;
    await expect(valid).resolves.toBeUndefined();
  });

  it('rejects broker nacks', async () => {
    const { publisher, callbacks } = fixture();
    const publication = publisher.publish('work', Buffer.from('{}'));
    const rejected = expect(publication).rejects.toThrow('nack');
    callbacks[0](new Error('nack'));
    await rejected;
  });

  it.each(['error', 'close'])(
    'rejects pending and future work when the channel emits %s',
    async (event) => {
      const { publisher, channel } = fixture();
      const publication = publisher.publish('work', Buffer.from('{}'));
      const rejected = expect(publication).rejects.toThrow('Broker channel');
      channel.emit(event, new Error('Disconnected'));
      await rejected;
      await expect(
        publisher.publish('work', Buffer.from('{}'))
      ).rejects.toThrow('closed');
    }
  );

  it('times out uncertain sends; a later confirmation cannot reverse the result', async () => {
    jest.useFakeTimers();
    const { publisher, callbacks } = fixture();
    const publication = publisher.publish('work', Buffer.from('{}'), {
      timeoutMs: 50,
    });
    const rejected = expect(publication).rejects.toThrow('timed out');
    jest.advanceTimersByTime(50);
    await rejected;
    callbacks[0](null);
    expect(jest.getTimerCount()).toBe(0);
    expect(publisher.isOpen()).toBe(false);
  });

  it('bounds outstanding confirmations', async () => {
    const { publisher, callbacks } = fixture();
    const publications = Array.from({ length: 256 }, () =>
      publisher.publish('work', Buffer.from('{}'))
    );
    await expect(publisher.publish('work', Buffer.from('{}'))).rejects.toThrow(
      'Too many'
    );
    callbacks.forEach((callback) => callback(null));
    await Promise.all(publications);
  });
});
