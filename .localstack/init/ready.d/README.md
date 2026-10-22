LocalStack initialization scripts run automatically when the container starts.
Scripts in `ready.d/` are executed once LocalStack is ready.

- `01-create-sqs-queues.sh`: creates the `wager-transactions.fifo` and
  `wager-transactions-dlq.fifo` FIFO queues used by the wagering processor.
