import { MikroORM, Options } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { WalletEntity } from './src/infrastructure/persistence/entities/wallet.entity';
import { WagerTransactionEntity } from './src/infrastructure/persistence/entities/wager-transaction.entity';
import { WalletLedgerEntryEntity } from './src/infrastructure/persistence/entities/wallet-ledger-entry.entity';
import { InboxMessageEntity } from './src/infrastructure/persistence/entities/inbox-message.entity';
import { OutboxMessageEntity } from './src/infrastructure/persistence/entities/outbox-message.entity';

export const mikroOrmOptions: Options<PostgreSqlDriver> = {
  driver: PostgreSqlDriver,
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT ?? '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  dbName: process.env.PGDATABASE || 'wagering',
  entities: [
    WalletEntity,
    WagerTransactionEntity,
    WalletLedgerEntryEntity,
    InboxMessageEntity,
    OutboxMessageEntity,
  ],
  migrations: {
    path: './src/infrastructure/persistence/migrations',
    tableName: 'mikro_orm_migrations',
    transactional: true,
    allOrNothing: true,
    dropTables: false,
    safe: false,
  },
  findOneOrFailHandler: undefined,
  allowGlobalContext: false,
  implicitTransactions: true,
  contextName: 'wagering',
};

export async function createOrm() {
  return MikroORM.init<PostgreSqlDriver>(mikroOrmOptions);
}

export default mikroOrmOptions;
