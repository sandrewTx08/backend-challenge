import { EntityManager } from '@mikro-orm/core';
import { OutboxMessage } from '../../../domain/outbox/outbox-message.js';
import { OutboxMessageEntity } from '../entities/outbox-message.entity.js';
import { OutboxRepositoryPort } from '../../../application/ports/outbox-repository.port.js';

export class MikroOutboxRepository implements OutboxRepositoryPort {
  constructor(private readonly getEm: () => EntityManager) {}

  private get em(): EntityManager {
    const em = this.getEm();
    if (!em) throw new Error('no EntityManager in context');
    return em;
  }

  async findPendingDue(now: Date, limit = 50): Promise<OutboxMessage[]> {
    const list = await this.em.find(
      OutboxMessageEntity,
      {
        publishedAt: null,
        $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
      },
      { limit, orderBy: { nextAttemptAt: 'ASC' } },
    );
    return list.map((e) => this.toDomain(e));
  }

  async save(message: OutboxMessage): Promise<void> {
    const state = message.toState();
    const e = this.em.create(OutboxMessageEntity, {
      id: state.id,
      aggregateId: state.aggregateId,
      eventType: state.eventType,
      payload: JSON.parse(state.payload),
      occurredAt: new Date(state.occurredAt),
      attempts: state.attempts,
      nextAttemptAt: state.nextAttemptAt ? new Date(state.nextAttemptAt) : undefined,
      publishedAt: state.publishedAt ? new Date(state.publishedAt) : undefined,
    });
    this.em.persist(e);
    await this.em.flush();
  }

  async markPublished(id: string, at: Date): Promise<void> {
    const e = await this.em.findOne(OutboxMessageEntity, { id });
    if (e) {
      e.publishedAt = at;
      this.em.persist(e);
      await this.em.flush();
    }
  }

  async scheduleRetry(id: string, attempts: number, nextAttemptAt: Date): Promise<void> {
    const e = await this.em.findOne(OutboxMessageEntity, { id });
    if (e) {
      e.attempts = attempts;
      e.nextAttemptAt = nextAttemptAt;
      this.em.persist(e);
      await this.em.flush();
    }
  }

  private toDomain(e: OutboxMessageEntity): OutboxMessage {
    return OutboxMessage.rehydrate({
      id: e.id,
      aggregateId: e.aggregateId,
      eventType: e.eventType,
      payload: JSON.stringify(e.payload),
      occurredAt: e.occurredAt.toISOString(),
      attempts: e.attempts,
      nextAttemptAt: e.nextAttemptAt?.toISOString(),
      publishedAt: e.publishedAt?.toISOString(),
    });
  }
}