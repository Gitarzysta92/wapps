/**
 * Platform port: connection configuration for a message queue.
 * Consumed by features; implemented by extras (e.g. RabbitMQ).
 */
export interface IQueueConnectConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  vhost?: string;
}
