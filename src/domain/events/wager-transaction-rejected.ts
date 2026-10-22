import { IntegrationEvent, EventContext } from './integration-event.js';
import { FailureCode } from '../common/failure-code.js';

export interface WagerTransactionRejectedData {
  transactionId: string;
  walletId: string;
  playerId: string;
  providerId: string;
  externalTransactionId: string;
  kind: string;
  failureCode: FailureCode;
}

export class WagerTransactionRejected extends IntegrationEvent<WagerTransactionRejectedData> {
  readonly eventType = 'WagerTransactionRejected';
  readonly version = 1;

  static from(props: {
    transactionId: string;
    walletId: string;
    playerId: string;
    providerId: string;
    externalTransactionId: string;
    kind: string;
    failureCode: FailureCode;
    ctx: EventContext;
  }): WagerTransactionRejected {
    return new WagerTransactionRejected({
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
        failureCode: props.failureCode,
      },
    });
  }
}
