import { QueueClient } from './platform-queue';

describe('QueueClient', () => {
  it('should work', () => {
    const client = new QueueClient();
    expect(client).toBeInstanceOf(QueueClient);
  });
});
