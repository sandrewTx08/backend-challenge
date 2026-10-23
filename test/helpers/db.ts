import { MikroORM } from '@mikro-orm/core';
import { mikroOrmOptions } from '../../mikro-orm.config';
import { MikroWalletRepository } from '../../src/infrastructure/persistence/repositories/mikro-wallet-repository';
import { MikroWagerTransactionRepository } from '../../src/infrastructure/persistence/repositories/mikro-wager-transaction-repository';
import { MikroLedgerEntryRepository } from '../../src/infrastructure/persistence/repositories/mikro-ledger-entry-repository';
import { MikroOutboxRepository } from '../../src/infrastructure/persistence/repositories/mikro-outbox-repository';
import { MikroUnitOfWork } from '../../src/infrastructure/persistence/mikro-unit-of-work';
import { CryptoIdGenerator } from '../../src/infrastructure/common/crypto-id-generator';
import { SystemClock } from '../../src/infrastructure/common/system-clock';
import { Sha256Hash } from '../../src/infrastructure/common/sha256-hash';
import { OpenWalletUseCase } from '../../src/application/use-cases/open-wallet.use-case';
import { SubmitWagerTransactionUseCase } from '../../src/application/use-cases/submit-wager-transaction.use-case';
import { ReconcileWalletUseCase } from '../../src/application/use-cases/reconcile-wallet.use-case';
import { GetWalletUseCase } from '../../src/application/use-cases/get-wallet.use-case';
import { GetLedgerUseCase } from '../../src/application/use-cases/get-ledger.use-case';
import { getCurrentEm, runWithEm } from '../../src/infrastructure/persistence/em-context';

export async function createTestContext() {
  const orm = await MikroORM.init(mikroOrmOptions);
  const migrator = orm.getMigrator();
  await migrator.up();

  async function resetDb() {
    const em = orm.em.fork();
    await runWithEm(em, async () => {
      await em.getConnection().execute('TRUNCATE TABLE outbox_messages, inbox_messages, wallet_ledger_entries, wager_transactions, wallets RESTART IDENTITY CASCADE');
    });
  }

  function buildRepos(em: any) {
    const getEm = () => getCurrentEm() ?? em;
    const wallets = new MikroWalletRepository(getEm);
    const wagerTransactions = new MikroWagerTransactionRepository(getEm);
    const ledgerEntries = new MikroLedgerEntryRepository(getEm);
    const outbox = new MikroOutboxRepository(getEm);
    const uow = new MikroUnitOfWork(getEm);
    return { wallets, wagerTransactions, ledgerEntries, outbox, uow };
  }

  function buildUseCases(em: any) {
    const { wallets, wagerTransactions, ledgerEntries, outbox, uow } = buildRepos(em);
    const idGen = new CryptoIdGenerator();
    const clock = new SystemClock();
    const hash = new Sha256Hash();
    return {
      openWallet: new OpenWalletUseCase(wallets, wagerTransactions, ledgerEntries, outbox, idGen, clock, uow),
      submit: new SubmitWagerTransactionUseCase(wallets, wagerTransactions, ledgerEntries, outbox, idGen, clock, hash, uow),
      reconcile: new ReconcileWalletUseCase(wallets, ledgerEntries),
      getWallet: new GetWalletUseCase(wallets),
      getLedger: new GetLedgerUseCase(ledgerEntries),
      wallets, wagerTransactions, ledgerEntries, outbox, uow,
    };
  }

  async function withEm<T>(fn: (ctx: ReturnType<typeof buildUseCases>) => Promise<T>): Promise<T> {
    const em = orm.em.fork({ clear: true });
    return runWithEm(em, async () => fn(buildUseCases(em)));
  }

  return { orm, resetDb, buildUseCases, withEm };
}
