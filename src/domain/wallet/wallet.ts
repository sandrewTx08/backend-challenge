/**
 * Wallet — aggregate root.
 * State is encapsulated; transitions are explicit through methods.
 */
import { Money } from '../common/money.js';
import { LedgerDirection } from '../common/ledger-direction.js';
import { WalletLedgerEntry } from '../ledger-entry/ledger-entry.js';

export interface WalletProps {
  id: string;
  playerId: string;
  currency: string;
}

export interface WalletState {
  id: string;
  playerId: string;
  currency: string;
  balanceAmount: string;
  balanceCurrency: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export class Wallet {
  private constructor(
    public readonly id: string,
    public readonly playerId: string,
    public readonly currency: string,
    private _balance: Money,
    private _version: number,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static open(props: {
    id: string;
    playerId: string;
    initialBalance: Money;
  }): Wallet {
    const now = new Date();
    return new Wallet(
      props.id,
      props.playerId,
      props.initialBalance.currency,
      props.initialBalance,
      1,
      now,
      now,
    );
  }

  static rehydrate(state: WalletState): Wallet {
    return new Wallet(
      state.id,
      state.playerId,
      state.currency,
      Money.from({ amount: state.balanceAmount, currency: state.balanceCurrency }),
      state.version,
      new Date(state.createdAt),
      new Date(state.updatedAt),
    );
  }

  get balance(): Money {
    return this._balance;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Debit money from the wallet. Returns the ledger entry that must be
   * persisted alongside the balance change. Rejects on insufficient funds.
   */
  debit(money: Money, referenceTransactionId?: string): {
    entry: WalletLedgerEntry;
    newBalance: Money;
  } {
    this.assertSameCurrency(money);
    if (this._balance.isLessThan(money)) {
      throw new InsufficientBalanceError(
        `insufficient balance: have ${this._balance.toString()}, need ${money.toString()}`,
      );
    }
    const balanceBefore = this._balance;
    this._balance = this._balance.subtract(money);
    this._version += 1;
    this._updatedAt = new Date();
    const entry = WalletLedgerEntry.create({
      walletId: this.id,
      transactionId: referenceTransactionId ?? this.id,
      direction: LedgerDirection.Debit,
      money,
      balanceBefore,
      balanceAfter: this._balance,
    });
    return { entry, newBalance: this._balance };
  }

  credit(money: Money, referenceTransactionId?: string): {
    entry: WalletLedgerEntry;
    newBalance: Money;
  } {
    this.assertSameCurrency(money);
    const balanceBefore = this._balance;
    this._balance = this._balance.add(money);
    this._version += 1;
    this._updatedAt = new Date();
    const entry = WalletLedgerEntry.create({
      walletId: this.id,
      transactionId: referenceTransactionId ?? this.id,
      direction: LedgerDirection.Credit,
      money,
      balanceBefore,
      balanceAfter: this._balance,
    });
    return { entry, newBalance: this._balance };
  }

  private assertSameCurrency(money: Money): void {
    if (this.currency !== money.currency) {
      throw new CurrencyMismatchError(
        `wallet currency ${this.currency} does not match operation currency ${money.currency}`,
      );
    }
  }

  toState(): WalletState {
    return {
      id: this.id,
      playerId: this.playerId,
      currency: this.currency,
      balanceAmount: this._balance.toString(),
      balanceCurrency: this._balance.currency,
      version: this._version,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}

export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

export class CurrencyMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CurrencyMismatchError';
  }
}
