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
      
      // Handle connection errors
      connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
      });
      
      channel = await connection.createChannel();
      
      // Handle channel errors
      channel.on('error', (err) => {
        console.error('RabbitMQ channel error:', err);
      });

      // Get management API info - this is a simplified version
      // In production, you'd want to use RabbitMQ Management HTTP API
      const queues: QueueInfo[] = [];
      
      // Common queue names to check - extend based on your setup
      const queueNames = [
        'store.app-scrapper',
        // Add other queue names that actually exist in your RabbitMQ setup
      ];

      for (const queueName of queueNames) {
        try {
          const queueInfo = await channel.checkQueue(queueName);
          queues.push({
            name: queueName,
            messages: queueInfo.messageCount,
            consumers: queueInfo.consumerCount,
          });
        } catch (error: any) {
          // Queue doesn't exist or can't be checked - skip it silently
          // Only log if it's not a 404 (queue not found) error
          if (error?.code !== 404) {
            console.log(`Queue ${queueName} not accessible: ${error.message || error}`);
          }
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
