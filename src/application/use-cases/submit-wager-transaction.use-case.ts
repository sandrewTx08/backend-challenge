import { Wallet } from '../../domain/wallet/wallet.js';
import { Money } from '../../domain/common/money.js';
import { WagerTransaction } from '../../domain/wager-transaction/wager-transaction.js';
import { WagerTransactionKind } from '../../domain/common/wager-transaction-kind.js';
import { WagerTransactionStatus } from '../../domain/common/wager-transaction-status.js';
import { FailureCode } from '../../domain/common/failure-code.js';
import { WalletLedgerEntry } from '../../domain/ledger-entry/ledger-entry.js';
import { LedgerDirection } from '../../domain/common/ledger-direction.js';
import { OutboxMessage } from '../../domain/outbox/outbox-message.js';
import { WalletBalanceChanged } from '../../domain/events/wallet-balance-changed.js';
import { WagerTransactionProcessed } from '../../domain/events/wager-transaction-processed.js';
import { WagerTransactionRejected } from '../../domain/events/wager-transaction-rejected.js';
import { WagerTransactionPendingReference } from '../../domain/events/wager-transaction-pending-reference.js';
import { EventContext } from '../../domain/events/integration-event.js';
import { WalletRepositoryPort } from '../ports/wallet-repository.port.js';
import { WagerTransactionRepositoryPort } from '../ports/wager-transaction-repository.port.js';
import { LedgerEntryRepositoryPort } from '../ports/ledger-entry-repository.port.js';
import { OutboxRepositoryPort } from '../ports/outbox-repository.port.js';
import { IdGeneratorPort } from '../ports/id-generator.port.js';
import { ClockPort } from '../ports/clock.port.js';
import { HashPort } from '../ports/hash.port.js';
import { UnitOfWork } from '../ports/unit-of-work.port.js';

export interface SubmitWagerTransactionCommand {
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  playerId: string;
  walletId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: Money;
  referenceExternalTransactionId?: string;
  correlationId: string;
}

export interface SubmitWagerTransactionResult {
  transactionId: string;
  status: WagerTransactionStatus;
  balance: Money;
  idempotentReplay: boolean;
}

export class SubmitWagerTransactionUseCase {
  constructor(
    private readonly wallets: WalletRepositoryPort,
    private readonly wagerTransactions: WagerTransactionRepositoryPort,
    private readonly ledgerEntries: LedgerEntryRepositoryPort,
    private readonly outbox: OutboxRepositoryPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly hash: HashPort,
    private readonly uow: UnitOfWork,
  ) {}

  async execute(cmd: SubmitWagerTransactionCommand): Promise<SubmitWagerTransactionResult> {
    const payloadHash = this.hash.sha256Hex(this.canonicalPayload(cmd));
    return this.uow.run(async () => this._execute(cmd, payloadHash));
  }

  async executeInTransaction(
    cmd: SubmitWagerTransactionCommand,
    payloadHash?: string,
  ): Promise<SubmitWagerTransactionResult> {
    const hash = payloadHash ?? this.hash.sha256Hex(this.canonicalPayload(cmd));
    return this._execute(cmd, hash);
  }

  private async _execute(
    cmd: SubmitWagerTransactionCommand,
    payloadHash: string,
  ): Promise<SubmitWagerTransactionResult> {
    // Idempotency check
    const existing = await this.wagerTransactions.findByIdempotencyKey(cmd.idempotencyKey);
    if (existing) {
      if (!existing.matchesPayload(payloadHash)) {
        throw new ConflictError('idempotency key conflict: payload differs');
      }
      const wallet = await this.wallets.findById(existing.walletId);
      const balance = wallet ? wallet.balance : cmd.money;
      return {
        transactionId: existing.id,
        status: existing.status,
        balance,
        idempotentReplay: true,
      };
    }

    const wallet = await this.wallets.findById(cmd.walletId);
    if (!wallet) {
      throw new NotFoundError('wallet not found');
    }

    if (wallet.currency !== cmd.money.currency) {
      throw new ValidationError('currency mismatch');
    }

    const txId = this.idGenerator.generate();
    const tx = WagerTransaction.create({
      id: txId,
      providerId: cmd.providerId,
      externalTransactionId: cmd.externalTransactionId,
      idempotencyKey: cmd.idempotencyKey,
      payloadHash,
      walletId: cmd.walletId,
      playerId: cmd.playerId,
      roundId: cmd.roundId,
      gameId: cmd.gameId,
      kind: cmd.kind,
      money: cmd.money,
      referenceExternalTransactionId: cmd.referenceExternalTransactionId,
    });

    const ctx: EventContext = {
      correlationId: cmd.correlationId,
      transactionId: txId,
      providerId: cmd.providerId,
      walletId: cmd.walletId,
    };

    // Pending reference handling for REFUND/ROLLBACK
    if (tx.requiresReference()) {
      const refTx = await this.wagerTransactions.findByProviderAndExternal(
        cmd.providerId,
        cmd.referenceExternalTransactionId!,
      );
      if (!refTx) {
        tx.markPendingReference();
        await this.wagerTransactions.save(tx);
        await this.outbox.save(
          OutboxMessage.enqueue(
            WagerTransactionPendingReference.from({
              transactionId: txId,
              walletId: cmd.walletId,
              playerId: cmd.playerId,
              providerId: cmd.providerId,
              externalTransactionId: cmd.externalTransactionId,
              kind: cmd.kind,
              referenceExternalTransactionId: cmd.referenceExternalTransactionId!,
              ctx,
            }),
          ),
        );
        return {
          transactionId: txId,
          status: tx.status,
          balance: wallet.balance,
          idempotentReplay: false,
        };
      }

      const validationError = this.validateReference(tx, refTx, cmd);
      if (validationError) {
        tx.reject(validationError);
        await this.wagerTransactions.save(tx);
        await this.outbox.save(
          OutboxMessage.enqueue(
            WagerTransactionRejected.from({
              transactionId: txId,
              walletId: cmd.walletId,
              playerId: cmd.playerId,
              providerId: cmd.providerId,
              externalTransactionId: cmd.externalTransactionId,
              kind: cmd.kind,
              failureCode: validationError,
              ctx,
            }),
          ),
        );
        return {
          transactionId: txId,
          status: tx.status,
          balance: wallet.balance,
          idempotentReplay: false,
        };
      }

      const siblings = await this.wagerTransactions.findByReferenceExternal(
        cmd.providerId,
        cmd.referenceExternalTransactionId!,
      );
      const alreadyReversed = siblings.some(
        (s) =>
          s.id !== txId &&
          s.kind === cmd.kind &&
          s.status === WagerTransactionStatus.Processed,
      );
      if (alreadyReversed) {
        tx.reject(FailureCode.REFERENCE_ALREADY_REVERSED);
        await this.wagerTransactions.save(tx);
        await this.outbox.save(
          OutboxMessage.enqueue(
            WagerTransactionRejected.from({
              transactionId: txId,
              walletId: cmd.walletId,
              playerId: cmd.playerId,
              providerId: cmd.providerId,
              externalTransactionId: cmd.externalTransactionId,
              kind: cmd.kind,
              failureCode: FailureCode.REFERENCE_ALREADY_REVERSED,
              ctx,
            }),
          ),
        );
        return {
          transactionId: txId,
          status: tx.status,
          balance: wallet.balance,
          idempotentReplay: false,
        };
      }

      if (!cmd.money.equals(refTx.money)) {
        tx.reject(FailureCode.INVALID_REFERENCE);
        await this.wagerTransactions.save(tx);
        await this.outbox.save(
          OutboxMessage.enqueue(
            WagerTransactionRejected.from({
              transactionId: txId,
              walletId: cmd.walletId,
              playerId: cmd.playerId,
              providerId: cmd.providerId,
              externalTransactionId: cmd.externalTransactionId,
              kind: cmd.kind,
              failureCode: FailureCode.INVALID_REFERENCE,
              ctx,
            }),
          ),
        );
        return {
          transactionId: txId,
          status: tx.status,
          balance: wallet.balance,
          idempotentReplay: false,
        };
      }

      const direction = tx.ledgerDirectionFor(refTx);
      if (direction === LedgerDirection.Debit && wallet.balance.isLessThan(cmd.money)) {
        tx.reject(FailureCode.NEGATIVE_BALANCE_WOULD_RESULT);
        await this.wagerTransactions.save(tx);
        await this.outbox.save(
          OutboxMessage.enqueue(
            WagerTransactionRejected.from({
              transactionId: txId,
              walletId: cmd.walletId,
              playerId: cmd.playerId,
              providerId: cmd.providerId,
              externalTransactionId: cmd.externalTransactionId,
              kind: cmd.kind,
              failureCode: FailureCode.NEGATIVE_BALANCE_WOULD_RESULT,
              ctx,
            }),
          ),
        );
        return {
          transactionId: txId,
          status: tx.status,
          balance: wallet.balance,
          idempotentReplay: false,
        };
      }

      let entry: WalletLedgerEntry | undefined;
      if (direction === LedgerDirection.Debit) {
        const res = wallet.debit(cmd.money, txId);
        entry = res.entry;
      } else {
        const res = wallet.credit(cmd.money, txId);
        entry = res.entry;
      }

      tx.markProcessed(refTx.id, this.clock.now());

      await this.wallets.save(wallet);
      await this.wagerTransactions.save(tx);
      if (entry) await this.ledgerEntries.save(entry);

      await this.outbox.save(
        OutboxMessage.enqueue(
          WagerTransactionProcessed.from({
            transactionId: txId,
            walletId: cmd.walletId,
            playerId: cmd.playerId,
            providerId: cmd.providerId,
            externalTransactionId: cmd.externalTransactionId,
            kind: cmd.kind,
            balance: wallet.balance.toJSON(),
            idempotentReplay: false,
            ctx,
          }),
        ),
      );
      const balanceEvent = WalletBalanceChanged.from(
        cmd.walletId,
        txId,
        direction,
        cmd.money.toJSON(),
        entry!.balanceBefore.toJSON(),
        entry!.balanceAfter.toJSON(),
        wallet.version,
        ctx,
      );
      await this.outbox.save(OutboxMessage.enqueue(balanceEvent));

      return {
        transactionId: txId,
        status: tx.status,
        balance: wallet.balance,
        idempotentReplay: false,
      };
    }

    // Non-reference kinds: BET, WIN, LOSS
    if (cmd.kind === WagerTransactionKind.Bet) {
      if (wallet.balance.isLessThan(cmd.money)) {
        tx.reject(FailureCode.INSUFFICIENT_BALANCE);
        await this.wagerTransactions.save(tx);
        await this.outbox.save(
          OutboxMessage.enqueue(
            WagerTransactionRejected.from({
              transactionId: txId,
              walletId: cmd.walletId,
              playerId: cmd.playerId,
              providerId: cmd.providerId,
              externalTransactionId: cmd.externalTransactionId,
              kind: cmd.kind,
              failureCode: FailureCode.INSUFFICIENT_BALANCE,
              ctx,
            }),
          ),
        );
        return {
          transactionId: txId,
          status: tx.status,
          balance: wallet.balance,
          idempotentReplay: false,
        };
      }
    }

    const affectsBalance = tx.affectsBalance();
    let entry: WalletLedgerEntry | undefined;
    const direction = tx.ledgerDirectionFor();

    if (affectsBalance) {
      if (direction === LedgerDirection.Debit) {
        const res = wallet.debit(cmd.money, txId);
        entry = res.entry;
      } else {
        const res = wallet.credit(cmd.money, txId);
        entry = res.entry;
      }
    }

    tx.markProcessed(undefined, this.clock.now());

    await this.wallets.save(wallet);
    await this.wagerTransactions.save(tx);
    if (entry) await this.ledgerEntries.save(entry);

    await this.outbox.save(
      OutboxMessage.enqueue(
        WagerTransactionProcessed.from({
          transactionId: txId,
          walletId: cmd.walletId,
          playerId: cmd.playerId,
          providerId: cmd.providerId,
          externalTransactionId: cmd.externalTransactionId,
          kind: cmd.kind,
          balance: wallet.balance.toJSON(),
          idempotentReplay: false,
          ctx,
        }),
      ),
    );

    if (entry) {
      const balanceEvent = WalletBalanceChanged.from(
        cmd.walletId,
        txId,
        direction,
        cmd.money.toJSON(),
        entry.balanceBefore.toJSON(),
        entry.balanceAfter.toJSON(),
        wallet.version,
        ctx,
      );
      await this.outbox.save(OutboxMessage.enqueue(balanceEvent));
    }

    return {
      transactionId: txId,
      status: tx.status,
      balance: wallet.balance,
      idempotentReplay: false,
    };
  }

  private canonicalPayload(cmd: SubmitWagerTransactionCommand): string {
    const obj = {
      providerId: cmd.providerId,
      externalTransactionId: cmd.externalTransactionId,
      playerId: cmd.playerId,
      walletId: cmd.walletId,
      roundId: cmd.roundId,
      gameId: cmd.gameId,
      kind: cmd.kind,
      money: { amount: cmd.money.toString(), currency: cmd.money.currency },
      referenceExternalTransactionId: cmd.referenceExternalTransactionId ?? null,
    };
    const keys = Object.keys(obj).sort();
    const sorted: Record<string, unknown> = {};
    for (const k of keys) {
      sorted[k] = (obj as Record<string, unknown>)[k];
    }
    return JSON.stringify(sorted);
  }

  private validateReference(
    tx: WagerTransaction,
    refTx: WagerTransaction,
    cmd: SubmitWagerTransactionCommand,
  ): FailureCode | null {
    if (refTx.providerId !== cmd.providerId) return FailureCode.INVALID_REFERENCE;
    if (refTx.playerId !== cmd.playerId) return FailureCode.INVALID_REFERENCE;
    if (refTx.walletId !== cmd.walletId) return FailureCode.INVALID_REFERENCE;
    if (refTx.money.currency !== cmd.money.currency) return FailureCode.INVALID_REFERENCE;
    if (refTx.roundId !== cmd.roundId) return FailureCode.INVALID_REFERENCE;

    const allowed = (() => {
      if (tx.kind === WagerTransactionKind.Refund) {
        return refTx.kind === WagerTransactionKind.Bet;
      }
      if (tx.kind === WagerTransactionKind.Rollback) {
        return (
          refTx.kind === WagerTransactionKind.Bet ||
          refTx.kind === WagerTransactionKind.Win ||
          refTx.kind === WagerTransactionKind.Refund
        );
      }
      return false;
    })();
    if (!allowed) return FailureCode.INVALID_KIND_FOR_REFERENCE;

    if (refTx.status !== WagerTransactionStatus.Processed) {
      return FailureCode.INVALID_REFERENCE;
    }

    return null;
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
