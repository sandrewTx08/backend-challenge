import { WalletLedgerEntry } from '../../domain/ledger-entry/ledger-entry.js';
import { LedgerEntryRepositoryPort } from '../ports/ledger-entry-repository.port.js';

export interface GetLedgerResult {
  entries: WalletLedgerEntry[];
  nextCursor: string | null;
}

export class GetLedgerUseCase {
  constructor(private readonly ledger: LedgerEntryRepositoryPort) {}
  async execute(walletId: string, limit = 50, cursor?: string): Promise<GetLedgerResult> {
    const { entries, nextCursor } = await this.ledger.findByWalletCursor(walletId, limit, cursor);
    return { entries, nextCursor };
  }
}
