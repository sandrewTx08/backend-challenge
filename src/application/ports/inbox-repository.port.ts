import { InboxMessage } from '../../domain/inbox/inbox-message.js';

export interface InboxRepository {
  findByMessageId(consumerName: string, messageId: string): Promise<InboxMessage | null>;
  save(message: InboxMessage): Promise<void>;
  findUnprocessed(limit?: number): Promise<InboxMessage[]>;
}

export interface InboxRepositoryPort extends InboxRepository {}
