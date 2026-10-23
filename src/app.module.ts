import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { MikroORM } from '@mikro-orm/core';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { EntityManager } from '@mikro-orm/core';
import { SQSClient } from '@aws-sdk/client-sqs';

import { mikroOrmOptions } from '../mikro-orm.config.js';

import { MikroWalletRepository } from './infrastructure/persistence/repositories/mikro-wallet-repository.js';
import { MikroWagerTransactionRepository } from './infrastructure/persistence/repositories/mikro-wager-transaction-repository.js';
import { MikroLedgerEntryRepository } from './infrastructure/persistence/repositories/mikro-ledger-entry-repository.js';
import { MikroInboxRepository } from './infrastructure/persistence/repositories/mikro-inbox-repository.js';
import { MikroOutboxRepository } from './infrastructure/persistence/repositories/mikro-outbox-repository.js';
import { MikroUnitOfWork } from './infrastructure/persistence/mikro-unit-of-work.js';
import { getCurrentEm } from './infrastructure/persistence/em-context.js';

import { CryptoIdGenerator } from './infrastructure/common/crypto-id-generator.js';
import { SystemClock } from './infrastructure/common/system-clock.js';
import { Sha256Hash } from './infrastructure/common/sha256-hash.js';
import { PinoLogger } from './infrastructure/common/pino-logger.js';

import { createSqsClient } from './infrastructure/messaging/sqs/sqs-client.js';
import { SqsProducer } from './infrastructure/messaging/sqs/sqs-producer.js';

import { KeycloakAuthGuard } from './infrastructure/auth/keycloak-auth.guard.js';
import { KeycloakJwtStrategy } from './infrastructure/auth/jwt.strategy.js';

import { OpenWalletUseCase } from './application/use-cases/open-wallet.use-case.js';
import { SubmitWagerTransactionUseCase } from './application/use-cases/submit-wager-transaction.use-case.js';
import { ReconcileWalletUseCase } from './application/use-cases/reconcile-wallet.use-case.js';
import { GetWalletUseCase } from './application/use-cases/get-wallet.use-case.js';
import { GetLedgerUseCase } from './application/use-cases/get-ledger.use-case.js';

import { WalletsController } from './api/controllers/wallets.controller.js';
import { WageringController } from './api/controllers/wagering.controller.js';
import { HealthController } from './api/controllers/health.controller.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [WalletsController, WageringController, HealthController],
  providers: [
    {
      provide: MikroORM,
      useFactory: async () => MikroORM.init<PostgreSqlDriver>(mikroOrmOptions),
    },
    {
      provide: 'GlobalEm',
      useFactory: (orm: MikroORM) => orm.em,
      inject: [MikroORM],
    },
    {
      provide: 'ForkEm',
      useFactory: (orm: MikroORM) => () => orm.em.fork(),
      inject: [MikroORM],
    },
    {
      provide: EntityManager,
      useFactory: () => getCurrentEm() ?? (global as any).__fallbackEm,
      // placeholder; overridden below via GlobalEm fallback
    },
    {
      provide: SQSClient,
      useFactory: () => createSqsClient(),
    },
    {
      provide: 'WalletRepository',
      useFactory: (forkEm: () => EntityManager) =>
        new MikroWalletRepository(() => {
          const cur = getCurrentEm();
          return cur ?? forkEm();
        }),
      inject: ['ForkEm'],
    },
    {
      provide: 'WagerTransactionRepository',
      useFactory: (forkEm: () => EntityManager) =>
        new MikroWagerTransactionRepository(() => getCurrentEm() ?? forkEm()),
      inject: ['ForkEm'],
    },
    {
      provide: 'LedgerEntryRepository',
      useFactory: (forkEm: () => EntityManager) =>
        new MikroLedgerEntryRepository(() => getCurrentEm() ?? forkEm()),
      inject: ['ForkEm'],
    },
    {
      provide: 'OutboxRepository',
      useFactory: (forkEm: () => EntityManager) =>
        new MikroOutboxRepository(() => getCurrentEm() ?? forkEm()),
      inject: ['ForkEm'],
    },
    { provide: 'IdGenerator', useFactory: () => new CryptoIdGenerator() },
    { provide: 'Clock', useFactory: () => new SystemClock() },
    { provide: 'Hash', useFactory: () => new Sha256Hash() },
    { provide: 'Logger', useFactory: () => new PinoLogger(process.env.LOG_LEVEL ?? 'info') },
    {
      provide: 'UnitOfWork',
      useFactory: (forkEm: () => EntityManager) =>
        new MikroUnitOfWork(() => getCurrentEm() ?? forkEm()),
      inject: ['ForkEm'],
    },
    {
      provide: 'MessagePublisher',
      useFactory: (c: SQSClient) => new SqsProducer(c),
      inject: [SQSClient],
    },
    {
      provide: OpenWalletUseCase,
      useFactory: (w, wt, l, o, id, cl, uow) =>
        new OpenWalletUseCase(w, wt, l, o, id, cl, uow),
      inject: [
        'WalletRepository',
        'WagerTransactionRepository',
        'LedgerEntryRepository',
        'OutboxRepository',
        'IdGenerator',
        'Clock',
        'UnitOfWork',
      ],
    },
    {
      provide: SubmitWagerTransactionUseCase,
      useFactory: (w, wt, l, o, id, cl, h, uow) =>
        new SubmitWagerTransactionUseCase(w, wt, l, o, id, cl, h, uow),
      inject: [
        'WalletRepository',
        'WagerTransactionRepository',
        'LedgerEntryRepository',
        'OutboxRepository',
        'IdGenerator',
        'Clock',
        'Hash',
        'UnitOfWork',
      ],
    },
    {
      provide: ReconcileWalletUseCase,
      useFactory: (w, l) => new ReconcileWalletUseCase(w, l),
      inject: ['WalletRepository', 'LedgerEntryRepository'],
    },
    {
      provide: GetWalletUseCase,
      useFactory: (w) => new GetWalletUseCase(w),
      inject: ['WalletRepository'],
    },
    {
      provide: GetLedgerUseCase,
      useFactory: (l) => new GetLedgerUseCase(l),
      inject: ['LedgerEntryRepository'],
    },
    KeycloakAuthGuard,
    KeycloakJwtStrategy,
    // Health controller needs EntityManager
    {
      provide: EntityManager,
      useFactory: (forkEm: () => EntityManager) => getCurrentEm() ?? forkEm(),
      inject: ['ForkEm'],
    },
  ],
})
export class AppModule {}
