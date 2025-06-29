// import amqp from 'amqplib';

export function getConnectionString(): string {  
  const user = process.env['QUEUE_USERNAME'];
  const pass = process.env['QUEUE_PASSWORD'];
  const host = process.env['QUEUE_HOST'] || 'localhost';
  const port = process.env['QUEUE_PORT'] || '5672';
  return `amqp://${user}:${pass}@${host}:${port}`;
}


// export async function setupRabbitmq(channel: amqp.Channel): Promise<void> {

// }





// async function run() {
//   // const connection = await amqp.connect(url);
//   // const channel = await connection.createChannel();
//   // await channel.assertQueue(queueName);

//   // console.log(connection)

//   // await channel.close();
//   // await connection.close();
// }
