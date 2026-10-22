import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core';

@Entity({ tableName: 'wallets' })
export class WalletEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'string' })
  playerId!: string;

  @Property({ type: 'string', length: 3 })
  currency!: string;

  @Property({ type: 'decimal', precision: 20, scale: 2 })
  balanceAmount!: string;

  @Property({ type: 'string', length: 3 })
  balanceCurrency!: string;

  @Property({ type: 'integer' })
  version!: number;

  @Property({ type: 'timestamptz' })
  createdAt!: Date;

  @Property({ type: 'timestamptz' })
  updatedAt!: Date;

  @Unique({ properties: ['playerId', 'currency'] })
  playerIdCurrencyUnique?: never;
}
