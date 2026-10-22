import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core';

@Entity({ tableName: 'inbox_messages' })
export class InboxMessageEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string' })
  messageId!: string;

  @Property({ type: 'string' })
  consumerName!: string;

  @Property({ type: 'string' })
  payloadHash!: string;

  @Property({ type: 'timestamptz' })
  receivedAt!: Date;

  @Property({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Unique({ properties: ['consumerName', 'messageId'] })
  consumerMessageUnique?: never;

  @Index({ properties: ['processedAt'] })
  processedAtIdx?: never;
}
