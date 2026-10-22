import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core';

@Entity({ tableName: 'wager_transactions' })
export class WagerTransactionEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string' })
  providerId!: string;

  @Property({ type: 'string' })
  externalTransactionId!: string;

  @Property({ type: 'string' })
  idempotencyKey!: string;

  @Property({ type: 'string' })
  payloadHash!: string;

  @Property({ type: 'uuid' })
  walletId!: string;

  @Property({ type: 'string' })
  playerId!: string;

  @Property({ type: 'string' })
  roundId!: string;

  @Property({ type: 'string' })
  gameId!: string;

  @Property({ type: 'string' })
  kind!: string;

  @Property({ type: 'decimal', precision: 20, scale: 2 })
  moneyAmount!: string;

  @Property({ type: 'string', length: 3 })
  moneyCurrency!: string;

  @Property({ type: 'string', nullable: true })
  referenceExternalTransactionId?: string;

  @Property({ type: 'timestamptz' })
  createdAt!: Date;

  @Property({ type: 'string' })
  status!: string;

  @Property({ type: 'uuid', nullable: true })
  referenceTransactionId?: string;

  @Property({ type: 'string', nullable: true })
  failureCode?: string;

  @Property({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  @Unique({ properties: ['idempotencyKey'] })
  idempotencyKeyUnique?: never;

  @Index({ properties: ['providerId', 'externalTransactionId'] })
  providerExternalIdx?: never;

  @Index({ properties: ['walletId', 'status'] })
  walletStatusIdx?: never;
}
