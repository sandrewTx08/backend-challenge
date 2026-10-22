import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  SQSClient,
  Message,
} from '@aws-sdk/client-sqs';
import { EntityManager } from '@mikro-orm/core';
import { runWithEm } from '../../persistence/em-context.js';
import { SubmitWagerTransactionUseCase } from '../../../application/use-cases/submit-wager-transaction.use-case.js';
import { InboxMessage } from '../../../domain/inbox/inbox-message.js';
import { MikroInboxRepository } from '../../persistence/repositories/mikro-inbox-repository.js';
import { MikroUnitOfWork } from '../../persistence/mikro-unit-of-work.js';
import { LoggerPort } from '../../../application/ports/logger.port.js';
import { HashPort } from '../../../application/ports/hash.port.js';
import { WagerTransactionKind } from '../../../domain/common/wager-transaction-kind.js';
import { Money } from '../../../domain/common/money.js';

export interface SqsConsumerConfig {
  queueUrl: string;
  dlqUrl: string;
  consumerName: string;
  maxAttempts: number;
  visibilityTimeout: number;
}

export class SqsConsumer {
  private running = false;

  constructor(
    private readonly client: SQSClient,
    private readonly forkEm: () => EntityManager,
    private readonly submitUseCase: SubmitWagerTransactionUseCase,
    private readonly hash: HashPort,
    private readonly logger: LoggerPort,
    private readonly config: SqsConsumerConfig,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    while (this.running) {
      await this.pollOnce();
    }
  }

  stop(): void {
    this.running = false;
  }

  private async pollOnce(): Promise<void> {
    try {
      const cmd = new ReceiveMessageCommand({
        QueueUrl: this.config.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        VisibilityTimeout: this.config.visibilityTimeout,
        AttributeNames: ['All'],
        MessageAttributeNames: ['All'],
      });
      const res = await this.client.send(cmd);
      const messages = res.Messages ?? [];
      if (messages.length === 0) return;

      await Promise.all(messages.map((m) => this.handleMessage(m)));
    } catch (err) {
      this.logger.error({ event: 'sqs_poll_error', error: String(err) });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  private async handleMessage(msg: Message): Promise<void> {
    const receiptHandle = msg.ReceiptHandle!;
    const messageId = msg.MessageId ?? msg.Body ?? '';

    let body: any;
    try {
      body = JSON.parse(msg.Body ?? '{}');
    } catch {
      this.logger.error({ event: 'invalid_message_body', messageId });
      await this.deleteMessage(receiptHandle);
      return;
    }

    const data = body.data ?? body;
    const consumerName = this.config.consumerName;
    const payloadHash = this.hash.sha256Hex(JSON.stringify(data));

    const em = this.forkEm();

    try {
      await runWithEm(em, async () => {
        const inboxRepo = new MikroInboxRepository(() => em);
        const existing = await inboxRepo.findByMessageId(consumerName, messageId);
        if (existing && existing.isProcessed()) {
          return;
        }

        const inbox = InboxMessage.receive({
          messageId,
          consumerName,
          payloadHash,
          receivedAt: new Date(),
        });
        await inboxRepo.save(inbox);

        await this.submitUseCase.executeInTransaction(
          {
            providerId: data.providerId,
            externalTransactionId: data.externalTransactionId,
            idempotencyKey: data.idempotencyKey,
            playerId: data.playerId,
            walletId: data.walletId,
            roundId: data.roundId,
            gameId: data.gameId,
            kind: data.kind as WagerTransactionKind,
            money: Money.from(data.money),
            referenceExternalTransactionId: data.referenceExternalTransactionId,
            correlationId: body.correlationId ?? messageId,
          },
          payloadHash,
        );

        inbox.markProcessed(new Date());
        await inboxRepo.save(inbox);
      });

      await this.deleteMessage(receiptHandle);
    } catch (err) {
      this.logger.error({ event: 'message_processing_failed', messageId, error: String(err) });
      const isBusiness =
        String(err).includes('ConflictError') ||
        String(err).includes('NotFoundError') ||
        String(err).includes('ValidationError') ||
        String(err).includes('InsufficientBalance');

      if (isBusiness) {
        await this.deleteMessage(receiptHandle);
        return;
      }

      try {
        await this.client.send(
          new ChangeMessageVisibilityCommand({
            QueueUrl: this.config.queueUrl,
            ReceiptHandle: receiptHandle,
            VisibilityTimeout: 30,
          }),
        );
      } catch {
        // ignore
      }
    }
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteMessageCommand({
          QueueUrl: this.config.queueUrl,
          ReceiptHandle: receiptHandle,
        }),
      );
    } catch (err) {
      this.logger.error({ event: 'delete_message_failed', error: String(err) });
    }
  }
}
