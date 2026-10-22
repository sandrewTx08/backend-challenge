import { WagerTransaction } from '../../domain/wager-transaction/wager-transaction.js';

export interface WagerTransactionRepository {
  findById(id: string): Promise<WagerTransaction | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<WagerTransaction | null>;
  findPendingReferenceByWallet(walletId: string): Promise<WagerTransaction[]>;
  findPendingReferences(limit?: number): Promise<WagerTransaction[]>;
  findByProviderAndExternal(
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransaction | null>;
  findByReferenceExternal(
    providerId: string,
    referenceExternalTransactionId: string,
  ): Promise<WagerTransaction[]>;
  save(tx: WagerTransaction): Promise<void>;
}

export interface WagerTransactionRepositoryPort
  extends WagerTransactionRepository {}
