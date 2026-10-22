import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';

@Entity({ tableName: 'wallet_ledger_entries' })
export class WalletLedgerEntryEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid' })
  walletId!: string;

  @Property({ type: 'uuid' })
  transactionId!: string;

  @Property({ type: 'string' })
  direction!: string;

  @Property({ type: 'decimal', precision: 20, scale: 2 })
  moneyAmount!: string;

  @Property({ type: 'string', length: 3 })
  moneyCurrency!: string;

  @Property({ type: 'decimal', precision: 20, scale: 2 })
  balanceBeforeAmount!: string;

  @Property({ type: 'string', length: 3 })
  balanceBeforeCurrency!: string;

  @Property({ type: 'decimal', precision: 20, scale: 2 })
  balanceAfterAmount!: string;

  @Property({ type: 'string', length: 3 })
  balanceAfterCurrency!: string;

  @Property({ type: 'timestamptz' })
  createdAt!: Date;

  @Index({ properties: ['walletId', 'createdAt'] })
  walletCreatedAtIdx?: never;

  @Index({ properties: ['transactionId'] })
  transactionIdx?: never;
}
