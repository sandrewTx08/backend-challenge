import { Wallet } from '../../domain/wallet/wallet.js';
import { Money } from '../../domain/common/money.js';
import { WagerTransaction } from '../../domain/wager-transaction/wager-transaction.js';
import { WagerTransactionKind } from '../../domain/common/wager-transaction-kind.js';
import { WalletLedgerEntry } from '../../domain/ledger-entry/ledger-entry.js';
import { LedgerDirection } from '../../domain/common/ledger-direction.js';
import { OutboxMessage } from '../../domain/outbox/outbox-message.js';
import { WalletBalanceChanged } from '../../domain/events/wallet-balance-changed.js';
import { WagerTransactionProcessed } from '../../domain/events/wager-transaction-processed.js';
import { EventContext } from '../../domain/events/integration-event.js';
import { WalletRepositoryPort } from '../ports/wallet-repository.port.js';

import { WagerTransactionRepositoryPort } from '../ports/wager-transaction-repository.port.js';
import { LedgerEntryRepositoryPort } from '../ports/ledger-entry-repository.port.js';
import { OutboxRepositoryPort } from '../ports/outbox-repository.port.js';
import { IdGeneratorPort } from '../ports/id-generator.port.js';
import { ClockPort } from '../ports/clock.port.js';
import { UnitOfWork } from '../ports/unit-of-work.port.js';

export interface OpenWalletCommand {
  playerId: string;
  initialBalance: Money;
  correlationId: string;
}

export interface OpenWalletResult {
  walletId: string;
  playerId: string;
  balance: Money;
  version: number;
}

export class OpenWalletUseCase {
  constructor(
    private readonly wallets: WalletRepositoryPort,
    private readonly wagerTransactions: WagerTransactionRepositoryPort,
    private readonly ledgerEntries: LedgerEntryRepositoryPort,
    private readonly outbox: OutboxRepositoryPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(cmd: OpenWalletCommand): Promise<OpenWalletResult> {
    return this.uow.run(async () => {
      const existing = await this.wallets.findByPlayerAndCurrency(
        cmd.playerId,
        cmd.initialBalance.currency,
      );
      if (existing) {
        throw new ConflictError('wallet already exists for this player and currency');
      }

      const walletId = this.idGenerator.generate();
      const wallet = Wallet.open({
        id: walletId,
        playerId: cmd.playerId,
        initialBalance: cmd.initialBalance,
      });

      await this.wallets.save(wallet);

      if (cmd.initialBalance.isPositive()) {
        const txId = this.idGenerator.generate();
        const tx = WagerTransaction.createOpening({
          id: txId,
          walletId,
          playerId: cmd.playerId,
          money: cmd.initialBalance,
        });
        await this.wagerTransactions.save(tx);

        const entry = WalletLedgerEntry.create({
          walletId,
          transactionId: txId,
          direction: LedgerDirection.Credit,
          money: cmd.initialBalance,
          balanceBefore: Money.zero(cmd.initialBalance.currency),
          balanceAfter: cmd.initialBalance,
        });
        await this.ledgerEntries.save(entry);

        const ctx: EventContext = { correlationId: cmd.correlationId, transactionId: txId };
        const balanceEvent = WalletBalanceChanged.from(
          walletId,
          txId,
          LedgerDirection.Credit,
          cmd.initialBalance.toJSON(),
          Money.zero(cmd.initialBalance.currency).toJSON(),
          cmd.initialBalance.toJSON(),
          wallet.version,
          ctx,
        );
        await this.outbox.save(OutboxMessage.enqueue(balanceEvent));

        const processedEvent = WagerTransactionProcessed.from({
          transactionId: txId,
          walletId,
          playerId: cmd.playerId,
          providerId: 'internal',
          externalTransactionId: `opening-${walletId}`,
          kind: WagerTransactionKind.Opening,
          balance: cmd.initialBalance.toJSON(),
          idempotentReplay: false,
          ctx,
        });
        await this.outbox.save(OutboxMessage.enqueue(processedEvent));
      }

      return {
        walletId,
        playerId: cmd.playerId,
        balance: wallet.balance,
        version: wallet.version,
      };
    });
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
