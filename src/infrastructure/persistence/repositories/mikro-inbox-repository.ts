import { EntityManager } from '@mikro-orm/core';
import { InboxMessage } from '../../../domain/inbox/inbox-message.js';
import { InboxMessageEntity } from '../entities/inbox-message.entity.js';
import { InboxRepositoryPort } from '../../../application/ports/inbox-repository.port.js';

export class MikroInboxRepository implements InboxRepositoryPort {
  constructor(private readonly getEm: () => EntityManager) {}

  private get em(): EntityManager {
    const em = this.getEm();
    if (!em) throw new Error('no EntityManager in context');
    return em;
  }

  async findByMessageId(consumerName: string, messageId: string): Promise<InboxMessage | null> {
    const e = await this.em.findOne(InboxMessageEntity, { consumerName, messageId });
    return e ? this.toDomain(e) : null;
  }

  async save(message: InboxMessage): Promise<void> {
    const state = message.toState();
    let e = await this.em.findOne(InboxMessageEntity, {
      consumerName: state.consumerName,
      messageId: state.messageId,
    });
    if (!e) {
      e = this.em.create(InboxMessageEntity, {
        id: state.id,
        messageId: state.messageId,
        consumerName: state.consumerName,
        payloadHash: state.payloadHash,
        receivedAt: new Date(state.receivedAt),
        processedAt: state.processedAt ? new Date(state.processedAt) : undefined,
      });
    } else {
      e.payloadHash = state.payloadHash;
      e.processedAt = state.processedAt ? new Date(state.processedAt) : e.processedAt;
    }
    this.em.persist(e);
    await this.em.flush();
  }

  async findUnprocessed(limit = 50): Promise<InboxMessage[]> {
    const list = await this.em.find(
      InboxMessageEntity,
      { processedAt: null },
      { limit, orderBy: { receivedAt: 'ASC' } },
    );
    return list.map((e) => this.toDomain(e));
  }

  private toDomain(e: InboxMessageEntity): InboxMessage {
    return InboxMessage.rehydrate({
      id: e.id,
      messageId: e.messageId,
      consumerName: e.consumerName,
      payloadHash: e.payloadHash,
      receivedAt: e.receivedAt.toISOString(),
      processedAt: e.processedAt?.toISOString(),
    });
  }
}
