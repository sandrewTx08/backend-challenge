import { OutboxMessage } from '../../domain/outbox/outbox-message.js';

export interface OutboxRepository {
  findPendingDue(now: Date, limit?: number): Promise<OutboxMessage[]>;
  save(message: OutboxMessage): Promise<void>;
  markPublished(id: string, at: Date): Promise<void>;
  scheduleRetry(id: string, attempts: number, nextAttemptAt: Date): Promise<void>;
}

export interface OutboxRepositoryPort extends OutboxRepository {}
