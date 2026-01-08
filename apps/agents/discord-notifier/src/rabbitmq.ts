export function getConnectionString(): string {
  const user = process.env['QUEUE_USERNAME'];
  const pass = process.env['QUEUE_PASSWORD'];
  const host = process.env['QUEUE_HOST'] || 'localhost';
  const port = process.env['QUEUE_PORT'] || '5672';
  return `amqp://${user}:${pass}@${host}:${port}`;
}
