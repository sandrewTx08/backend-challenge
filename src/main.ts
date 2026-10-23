import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { MikroORM } from '@mikro-orm/core';

import { runWithEm } from './infrastructure/persistence/em-context.js';
import { createSqsClient } from './infrastructure/messaging/sqs/sqs-client.js';
import { SqsProducer } from './infrastructure/messaging/sqs/sqs-producer.js';
import { SqsConsumer } from './infrastructure/messaging/sqs/sqs-consumer.js';
import { OutboxPublisher } from './infrastructure/messaging/outbox-publisher.js';
import { PinoLogger } from './infrastructure/common/pino-logger.js';
import { SubmitWagerTransactionUseCase } from './application/use-cases/submit-wager-transaction.use-case.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableCors();

  const orm = app.get(MikroORM);

  // Run pending migrations
  try {
    const migrator = orm.getMigrator();
    await migrator.up();
    console.log('Migrations applied');
  } catch (e) {
    console.error('Migration error', e);
  }

  // Request-scoped EntityManager via ALS
  app.use((req: any, res: any, next: any) => {
    const em = orm.em.fork({ clear: true });
    runWithEm(em, () => next()).catch(next);
  });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  console.log(`Wagering processor listening on ${port}`);

  // Background workers
  try {
    const client = createSqsClient();
    const submitUseCase = app.get(SubmitWagerTransactionUseCase);
    const hashSvc = (app as any).get('Hash');
    const logger = new PinoLogger(process.env.LOG_LEVEL ?? 'info');

    const forkEm = () => orm.em.fork();

    const consumer = new SqsConsumer(client, forkEm, submitUseCase, hashSvc, logger, {
      queueUrl: process.env.SQS_QUEUE_URL || '',
      dlqUrl: process.env.SQS_DLQ_URL || '',
      consumerName: process.env.SQS_CONSUMER_NAME || 'wager-transaction-consumer',
      maxAttempts: 5,
      visibilityTimeout: 30,
    });
    const publisher = new OutboxPublisher(
      forkEm,
      new SqsProducer(client),
      process.env.EVENTS_QUEUE_URL || '',
      logger,
      parseInt(process.env.OUTBOX_POLL_INTERVAL_MS ?? '2000', 10),
      parseInt(process.env.OUTBOX_MAX_ATTEMPTS ?? '10', 10),
    );

    consumer.start().catch((e) => console.error('consumer error', e));
    publisher.start().catch((e) => console.error('publisher error', e));
  } catch (e) {
    console.error('failed to start workers', e);
  }
}

bootstrap();
