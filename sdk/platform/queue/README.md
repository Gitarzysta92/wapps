# Platform Queue (interfaces)

Interfaces (ports) for a message queue client. **Consumed by features**; no implementations here.

- `IQueueConnectConfig` – connection config
- `IQueueChannel` – channel to assert queues, send, consume
- `IQueueClient` – connect / close

Implementations live in **extras** (e.g. `@sdk/extras/queue-rabbitmq` for RabbitMQ). Wire the implementation at app bootstrap.
