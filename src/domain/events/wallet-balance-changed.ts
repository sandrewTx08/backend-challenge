import { IntegrationEvent, EventContext } from './integration-event.js';
import { MoneyProps } from '../common/money.js';
import { LedgerDirection } from '../common/ledger-direction.js';

export interface WalletBalanceChangedData {
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: MoneyProps;
  balanceBefore: MoneyProps;
  balanceAfter: MoneyProps;
  walletVersion: number;
}

export class WalletBalanceChanged extends IntegrationEvent<WalletBalanceChangedData> {
  readonly eventType = 'WalletBalanceChanged';
  readonly version = 1;

  static from(
    walletId: string,
    transactionId: string,
    direction: LedgerDirection,
    money: MoneyProps,
    balanceBefore: MoneyProps,
    balanceAfter: MoneyProps,
    walletVersion: number,
    ctx: EventContext,
  ): WalletBalanceChanged {
    return new WalletBalanceChanged({
      eventId: crypto.randomUUID(),
      aggregateId: walletId,
      correlationId: ctx.correlationId,
      causationId: ctx.causationId,
      occurredAt: new Date(),
      data: {
        walletId,
        transactionId,
        direction,
        money,
        balanceBefore,
        balanceAfter,
        walletVersion,
      },
    });
  }
}
