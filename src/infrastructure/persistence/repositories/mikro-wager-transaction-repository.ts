import { EntityManager } from '@mikro-orm/core';
import { WagerTransaction } from '../../../domain/wager-transaction/wager-transaction.js';
import { WagerTransactionEntity } from '../entities/wager-transaction.entity.js';
import { WagerTransactionRepositoryPort } from '../../../application/ports/wager-transaction-repository.port.js';

export class MikroWagerTransactionRepository implements WagerTransactionRepositoryPort {
  constructor(private readonly getEm: () => EntityManager) {}

  private get em(): EntityManager {
    const em = this.getEm();
    if (!em) throw new Error('no EntityManager in context');
    return em;
  }

  async findById(id: string): Promise<WagerTransaction | null> {
    const e = await this.em.findOne(WagerTransactionEntity, { id });
    return e ? this.toDomain(e) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<WagerTransaction | null> {
    const e = await this.em.findOne(WagerTransactionEntity, { idempotencyKey });
    return e ? this.toDomain(e) : null;
  }

  async findPendingReferenceByWallet(walletId: string): Promise<WagerTransaction[]> {
    const list = await this.em.find(WagerTransactionEntity, {
      walletId,
      status: 'PENDING_REFERENCE',
    });
    return list.map((e) => this.toDomain(e));
  }

  async findPendingReferences(limit = 50): Promise<WagerTransaction[]> {
    const list = await this.em.find(
      WagerTransactionEntity,
      { status: 'PENDING_REFERENCE' },
      { limit, orderBy: { createdAt: 'ASC' } },
    );
    return list.map((e) => this.toDomain(e));
  }

  async findByProviderAndExternal(
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null> {
    const e = await this.em.findOne(WagerTransactionEntity, {
      providerId,
      externalTransactionId,
    });
    return e ? this.toDomain(e) : null;
  }

  async findByReferenceExternal(
    providerId: string,
    referenceExternalTransactionId: string,
  ): Promise<WagerTransaction[]> {
    const list = await this.em.find(WagerTransactionEntity, {
      providerId,
      referenceExternalTransactionId,
    });
    return list.map((e) => this.toDomain(e));
  }

  async save(tx: WagerTransaction): Promise<void> {
    const state = tx.toState();
    let e = await this.em.findOne(WagerTransactionEntity, { id: state.id });
    if (!e) {
      e = this.em.create(WagerTransactionEntity, {
        id: state.id,
        providerId: state.providerId,
        externalTransactionId: state.externalTransactionId,
        idempotencyKey: state.idempotencyKey,
        payloadHash: state.payloadHash,
        walletId: state.walletId,
        playerId: state.playerId,
        roundId: state.roundId,
        gameId: state.gameId,
        kind: state.kind,
        moneyAmount: state.moneyAmount,
        moneyCurrency: state.moneyCurrency,
        referenceExternalTransactionId: state.referenceExternalTransactionId,
        createdAt: new Date(state.createdAt),
        status: state.status,
        referenceTransactionId: state.referenceTransactionId,
        failureCode: state.failureCode,
        processedAt: state.processedAt ? new Date(state.processedAt) : undefined,
      });
    } else {
      e.status = state.status;
      e.referenceTransactionId = state.referenceTransactionId;
      e.failureCode = state.failureCode;
      e.processedAt = state.processedAt ? new Date(state.processedAt) : undefined;
    }
    this.em.persist(e);
    await this.em.flush();
  }

  private toDomain(e: WagerTransactionEntity): WagerTransaction {
    return WagerTransaction.rehydrate({
      id: e.id,
      providerId: e.providerId,
      externalTransactionId: e.externalTransactionId,
      idempotencyKey: e.idempotencyKey,
      payloadHash: e.payloadHash,
      walletId: e.walletId,
      playerId: e.playerId,
      roundId: e.roundId,
      gameId: e.gameId,
      kind: e.kind as any,
      moneyAmount: e.moneyAmount,
      moneyCurrency: e.moneyCurrency,
      referenceExternalTransactionId: e.referenceExternalTransactionId,
      createdAt: e.createdAt.toISOString(),
      status: e.status as any,
      referenceTransactionId: e.referenceTransactionId,
      failureCode: e.failureCode as any,
      processedAt: e.processedAt?.toISOString(),
    });
  }
}
