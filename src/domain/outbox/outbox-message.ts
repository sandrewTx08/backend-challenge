/**
 * OutboxMessage — transactional outbox record for publishing integration events.
 */
export interface EnqueueOutboxProps {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: Date;
}

export interface OutboxMessageState {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: string;
  occurredAt: string;
  attempts: number;
  nextAttemptAt?: string;
  publishedAt?: string;
}

export class OutboxMessage {
  private constructor(
    public readonly id: string,
    public readonly aggregateId: string,
    public readonly eventType: string,
    public readonly payload: Readonly<Record<string, unknown>>,
    public readonly occurredAt: Date,
    private _attempts: number,
    private _nextAttemptAt?: Date,
    private _publishedAt?: Date,
  ) {}

  static enqueue(event: IntegrationEvent<unknown>): OutboxMessage {
    return new OutboxMessage(
      crypto.randomUUID(),
      event.aggregateId,
      event.eventType,
      event.toJSON(),
      event.occurredAt,
      0,
      new Date(),
      undefined,
    );
  }

  static rehydrate(state: OutboxMessageState): OutboxMessage {
    return new OutboxMessage(
      state.id,
      state.aggregateId,
      state.eventType,
      JSON.parse(state.payload) as Readonly<Record<string, unknown>>,
      new Date(state.occurredAt),
      state.attempts,
      state.nextAttemptAt ? new Date(state.nextAttemptAt) : undefined,
      state.publishedAt ? new Date(state.publishedAt) : undefined,
    );
  }

  get attempts(): number {
    return this._attempts;
  }

  get nextAttemptAt(): Date | undefined {
    return this._nextAttemptAt;
  }

  get publishedAt(): Date | undefined {
    return this._publishedAt;
  }

  isPending(): boolean {
    return this._publishedAt === undefined;
  }

  isDue(now: Date): boolean {
    if (this._publishedAt !== undefined) return false;
    if (!this._nextAttemptAt) return true;
    return now >= this._nextAttemptAt;
  }

  markPublished(at: Date): void {
    this._publishedAt = at;
  }

  scheduleRetry(now: Date): void {
    this._attempts += 1;
    const backoffMs = Math.min(1000 * Math.pow(2, this._attempts), 60000);
    this._nextAttemptAt = new Date(now.getTime() + backoffMs);
  }

  toState(): OutboxMessageState {
    return {
      id: this.id,
      aggregateId: this.aggregateId,
      eventType: this.eventType,
      payload: JSON.stringify(this.payload),
      occurredAt: this.occurredAt.toISOString(),
      attempts: this._attempts,
      nextAttemptAt: this._nextAttemptAt?.toISOString(),
      publishedAt: this._publishedAt?.toISOString(),
    };
  }
}

import { IntegrationEvent } from '../events/integration-event.js';
