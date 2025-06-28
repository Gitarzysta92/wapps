import amqp from 'amqplib';
import dotenv from 'dotenv';


dotenv.config();


const user = process.env['QUEUE_USERNAME'];
const pass = process.env['QUEUE_PASSWORD'];
const host = process.env['QUEUE_HOST'] || 'localhost';
const port = process.env['QUEUE_PORT'] || '5672';
const url = `amqp://${user}:${pass}@${host}:${port}`;
const queueName = "store.app-scrapper";

console.log(user, pass, host, port, url)

async function run() {
  const connection = await amqp.connect(url);
  const channel = await connection.createChannel();
  await channel.assertQueue(queueName);


  await channel.close();
  await connection.close();
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
