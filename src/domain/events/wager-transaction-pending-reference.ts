import { IntegrationEvent, EventContext } from './integration-event.js';

export interface WagerTransactionPendingReferenceData {
  transactionId: string;
  walletId: string;
  playerId: string;
  providerId: string;
  externalTransactionId: string;
  kind: string;
  referenceExternalTransactionId: string;
}

export class WagerTransactionPendingReference extends IntegrationEvent<WagerTransactionPendingReferenceData> {
  readonly eventType = 'WagerTransactionPendingReference';
  readonly version = 1;

  static from(props: {
    transactionId: string;
    walletId: string;
    playerId: string;
    providerId: string;
    externalTransactionId: string;
    kind: string;
    referenceExternalTransactionId: string;
    ctx: EventContext;
  }): WagerTransactionPendingReference {
    return new WagerTransactionPendingReference({
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
        referenceExternalTransactionId: props.referenceExternalTransactionId,
      },
    });
  }
}
