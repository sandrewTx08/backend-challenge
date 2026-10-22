import { IntegrationEvent, EventContext } from './integration-event.js';

export interface WagerTransactionProcessedData {
  transactionId: string;
  walletId: string;
  playerId: string;
  providerId: string;
  externalTransactionId: string;
  kind: string;
  status: string;
  balance: { amount: string; currency: string };
  idempotentReplay: boolean;
}

export class WagerTransactionProcessed extends IntegrationEvent<WagerTransactionProcessedData> {
  readonly eventType = 'WagerTransactionProcessed';
  readonly version = 1;

  static from(props: {
    transactionId: string;
    walletId: string;
    playerId: string;
    providerId: string;
    externalTransactionId: string;
    kind: string;
    balance: { amount: string; currency: string };
    idempotentReplay: boolean;
    ctx: EventContext;
  }): WagerTransactionProcessed {
    return new WagerTransactionProcessed({
      eventId: crypto.randomUUID(),
      aggregateId: props.walletId,
      correlationId: props.ctx.correlationId,
      causationId: props.ctx.causationId,
      occurredAt: new Date(),
      data: {
        transactionId: props.transactionId,
        walletId: props.walletId,
        playerId: props.playerId,
        providerId: props.providerId,
        externalTransactionId: props.externalTransactionId,
        kind: props.kind,
        status: 'PROCESSED',
        balance: props.balance,
        idempotentReplay: props.idempotentReplay,
      },
    });
  }
}
