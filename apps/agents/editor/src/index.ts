import dotenv from 'dotenv';
import amqp from 'amqplib';
import { getConnectionString } from './rabbitmq';
dotenv.config();




async function run() {
  const connection = await amqp.connect(getConnectionString());
  const channel = await connection.createChannel();
  // await channel.assertExchange(`${EDITORIAL_DOMAIN_SLUG}.${EVENTS_KEY}`, "topic");

  // await channel.assertQueue(CONTENT_ACQUIRED_QUEUE);
  // await channel.assertExchange(`${ACQUISITION_DOMAIN_SLUG}.${EVENTS_KEY}`, "topic");
  // await channel.bindQueue(CONTENT_ACQUIRED_QUEUE,
  //   `${ACQUISITION_DOMAIN_SLUG}.${EVENTS_KEY}`,
  //   `${CONTENT_ENTITY_SLUG}.${ACQUIRED_EVENT_SLUG}`);

  
  // await channel.consume(CONTENT_ACQUIRED_QUEUE, msg => {
  //   console.log("Analytics service received:", msg.content.toString());
  //   channel.ack(msg);
  // });
    

  console.log(connection)

  await channel.close();
  await connection.close();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
