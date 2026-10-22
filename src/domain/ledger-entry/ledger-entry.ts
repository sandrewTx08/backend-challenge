/**
 * WalletLedgerEntry — immutable ledger entry.
 * Structural immutability: no mutable fields, no transition methods.
 * `create` validates the double-entry arithmetic.
 */
import { Money } from '../common/money.js';
import { LedgerDirection } from '../common/ledger-direction.js';

export interface CreateLedgerEntryProps {
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: Money;
  balanceBefore: Money;
  balanceAfter: Money;
}

export interface LedgerEntryState {
  id: string;
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  moneyAmount: string;
  moneyCurrency: string;
  balanceBeforeAmount: string;
  balanceBeforeCurrency: string;
  balanceAfterAmount: string;
  balanceAfterCurrency: string;
  createdAt: string;
}

export class WalletLedgerEntry {
  private constructor(
    public readonly id: string,
    public readonly walletId: string,
    public readonly transactionId: string,
    public readonly direction: LedgerDirection,
    public readonly money: Money,
    public readonly balanceBefore: Money,
    public readonly balanceAfter: Money,
    public readonly createdAt: Date,
  ) {}

  static create(props: CreateLedgerEntryProps): WalletLedgerEntry {
    const { direction, money, balanceBefore, balanceAfter } = props;

    money.assertSameCurrency(balanceBefore);
    money.assertSameCurrency(balanceAfter);
    balanceBefore.assertSameCurrency(balanceAfter);

    const now = new Date();

    let expected: Money;
    if (direction === LedgerDirection.Credit) {
      expected = balanceBefore.add(money);
    } else {
      expected = balanceBefore.subtract(money);
    }

    if (!expected.equals(balanceAfter)) {
      throw new LedgerEntryError(
        `ledger entry is unbalanced: balanceBefore ${balanceBefore.toString()} ${
          direction
        } ${money.toString()} should produce ${expected.toString()}, got ${balanceAfter.toString()}`,
      );
    }

    return new WalletLedgerEntry(
      crypto.randomUUID(),
      props.walletId,
      props.transactionId,
      direction,
      money,
      balanceBefore,
      balanceAfter,
      now,
    );
  }

  static rehydrate(state: LedgerEntryState): WalletLedgerEntry {
    return new WalletLedgerEntry(
      state.id,
      state.walletId,
      state.transactionId,
      state.direction,
      Money.from({ amount: state.moneyAmount, currency: state.moneyCurrency }),
      Money.from({ amount: state.balanceBeforeAmount, currency: state.balanceBeforeCurrency }),
      Money.from({ amount: state.balanceAfterAmount, currency: state.balanceAfterCurrency }),
      new Date(state.createdAt),
    );
  }

  isBalanced(): boolean {
    const expected =
      this.direction === LedgerDirection.Credit
        ? this.balanceBefore.add(this.money)
        : this.balanceBefore.subtract(this.money);
    return expected.equals(this.balanceAfter);
  }

  toState(): LedgerEntryState {
    return {
      id: this.id,
      walletId: this.walletId,
      transactionId: this.transactionId,
      direction: this.direction,
      moneyAmount: this.money.toString(),
      moneyCurrency: this.money.currency,
      balanceBeforeAmount: this.balanceBefore.toString(),
      balanceBeforeCurrency: this.balanceBefore.currency,
      balanceAfterAmount: this.balanceAfter.toString(),
      balanceAfterCurrency: this.balanceAfter.currency,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

export class LedgerEntryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerEntryError';
  }
}
