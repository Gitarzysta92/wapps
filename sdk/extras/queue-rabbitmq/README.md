# Extras Queue RabbitMQ

**Direct implementation** of `@sdk/platform/queue`: RabbitMQ client implementing `IQueueClient`.

Use at wiring time in apps; features should depend only on `@sdk/platform/queue` (interfaces).

```ts
import { IQueueClient } from '@sdk/platform/queue';
import { RabbitMqQueueClient } from '@sdk/extras/queue-rabbitmq';

const client: IQueueClient = new RabbitMqQueueClient();
await client.connect({ host, port, username, password });
```
