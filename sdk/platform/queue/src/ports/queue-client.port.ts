import type { IQueueConnectConfig } from './queue-connect-config';
import type { IQueueChannel } from './queue-channel.port';

/**
 * Platform port: client for connecting to a message queue and obtaining a channel.
 * Consumed by features; implemented by extras (e.g. RabbitMQ).
 */
export interface IQueueClient {
  connect(config: IQueueConnectConfig): Promise<IQueueChannel>;
  close(): Promise<void>;
}
