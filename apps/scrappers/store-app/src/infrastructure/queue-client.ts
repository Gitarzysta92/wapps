import amqp from 'amqplib';
import { IRawRecordProcessor, RawRecordDto } from '@domains/catalog/record';


export class QueueClient implements IRawRecordProcessor {

  constructor(
    private readonly client: typeof amqp,
  ) { }
  processRawAppRecord(data: RawRecordDto): void {
    throw new Error('Method not implemented.');
  }

  connect(cfg: {
    host: string;
    port: string;
    username: string;
    password: string;
    name: string;
    options?: amqp.Options.AssertQueue;
  }) {



    if (!username) {
      throw new Error('QUEUE_USERNAME is required');
    }
    if (!password) {
      throw new Error('QUEUE_PASSWORD is required');
    }
    if (!host) {
      throw new Error('QUEUE_HOST is required');
    }
    if (!port) {
      throw new Error('QUEUE_PORT is required');
    }






    console.log(`AMQP URL: amqp://${user}:***@${host}:${port}`);
const url = `amqp://${user}:${pass}@${host}:${port}/`;
const queueName = "store.app-scrapper";
    return this._channel.connect();

    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertQueue(queueName);

    console.log('Connecting to RabbitMQ...');

    console.log('✅ Connected to RabbitMQ');
  }

  close() {
    throw new Error('Method not implemented.');
  }
}