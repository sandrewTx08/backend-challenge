import { EntityManager } from '@mikro-orm/core';
import { SQSClient } from '@aws-sdk/client-sqs';
import { OutboxMessage } from '../../domain/outbox/outbox-message.js';
import { MikroOutboxRepository } from '../persistence/repositories/mikro-outbox-repository.js';
import { LoggerPort } from '../../application/ports/logger.port.js';
import { MessagePublisher } from '../../application/ports/message-publisher.port.js';
import { runWithEm } from '../persistence/em-context.js';

export class OutboxPublisher {
  private running = false;

  constructor(
    private readonly forkEm: () => EntityManager,
    private readonly publisher: MessagePublisher,
    private readonly queueUrl: string,
    private readonly logger: LoggerPort,
    private readonly pollIntervalMs: number = 2000,
    private readonly maxAttempts: number = 10,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    while (this.running) {
      await this.pollOnce();
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
    }
  }

  stop(): void {
    this.running = false;
  }

  private async pollOnce(): Promise<void> {
    const em = this.forkEm();
    try {
      const messages = await runWithEm(em, async () => {
        const repo = new MikroOutboxRepository(() => em);
        return repo.findPendingDue(new Date(), 50);
      });

      for (const msg of messages) {
        await this.publishOne(msg, em);
      }
    } catch (err) {
      this.logger.error({ event: 'outbox_poll_error', error: String(err) });
    }
  }

  private async publishOne(msg: OutboxMessage, em: EntityManager): Promise<void> {
    try {
      const body = JSON.stringify(msg.payload);
      await this.publisher.publish(this.queueUrl, body, msg.aggregateId, msg.id);
      const em2 = this.forkEm();
      await runWithEm(em2, async () => {
        const repo = new MikroOutboxRepository(() => em2);
        await repo.markPublished(msg.id, new Date());
      });
      this.logger.info({ event: 'outbox_published', messageId: msg.id, eventType: msg.eventType });
    } catch (err) {
      this.logger.error({ event: 'outbox_publish_failed', messageId: msg.id, error: String(err) });
      const now = new Date();
      const em2 = this.forkEm();
      await runWithEm(em2, async () => {
        const repo = new MikroOutboxRepository(() => em2);
        const attempts = msg.attempts + 1;
        if (attempts >= this.maxAttempts) {
          await repo.scheduleRetry(msg.id, attempts, new Date(now.getTime() + 3600000));
        } else {
          const backoff = Math.min(1000 * Math.pow(2, attempts), 60000);
          await repo.scheduleRetry(msg.id, attempts, new Date(now.getTime() + backoff));
        }
      });
    }
  }
}
