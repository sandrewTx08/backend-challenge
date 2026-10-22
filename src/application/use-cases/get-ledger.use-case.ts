import { WalletLedgerEntry } from '../../domain/ledger-entry/ledger-entry.js';
import { LedgerEntryRepositoryPort } from '../ports/ledger-entry-repository.port.js';

export class GetLedgerUseCase {
  constructor(private readonly ledger: LedgerEntryRepositoryPort) {}
  async execute(walletId: string): Promise<WalletLedgerEntry[]> {
    return this.ledger.findByWallet(walletId);
  }
}
