import * as amqp from 'amqplib';
import { getConnectionString } from './rabbitmq';

export interface QueueInfo {
  name: string;
  messages: number;
  consumers: number;
}

export interface RabbitMQData {
  queues: QueueInfo[];
  summary: {
    totalQueues: number;
    totalMessages: number;
    queuesWithBacklog: number;
  };
}

export class RabbitMQClient {
  private connectionString: string;

  constructor() {
    this.connectionString = getConnectionString();
  }

  async fetchQueueStats(): Promise<RabbitMQData> {
    let connection;
    let channel;

    try {
      connection = await amqp.connect(this.connectionString);
      channel = await connection.createChannel();

      // Get management API info - this is a simplified version
      // In production, you'd want to use RabbitMQ Management HTTP API
      const queues: QueueInfo[] = [];
      
      // Common queue names to check - extend based on your setup
      const queueNames = [
        'store.app-scrapper',
        'content-acquired-queue',
        'dev-notes-queue',
      ];

      for (const queueName of queueNames) {
        try {
          const queueInfo = await channel.checkQueue(queueName);
          queues.push({
            name: queueName,
            messages: queueInfo.messageCount,
            consumers: queueInfo.consumerCount,
          });
        } catch (error) {
          // Queue doesn't exist or can't be checked - skip it
          console.log(`Queue ${queueName} not found or inaccessible`);
        }
      }

      const summary = {
        totalQueues: queues.length,
        totalMessages: queues.reduce((sum, q) => sum + q.messages, 0),
        queuesWithBacklog: queues.filter((q) => q.messages > 100).length,
      };

      return { queues, summary };
    } catch (error) {
      console.error('Error fetching RabbitMQ data:', error);
      throw error;
    } finally {
      try {
        if (channel) await channel.close();
        if (connection) await connection.close();
      } catch (closeError) {
        console.error('Error closing RabbitMQ connections:', closeError);
      }
    }
  }
}
