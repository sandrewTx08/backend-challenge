import { WalletLedgerEntry } from '../../domain/ledger-entry/ledger-entry.js';

export interface LedgerEntryRepository {
  findByWallet(walletId: string): Promise<WalletLedgerEntry[]>;
  findByWalletCursor(
    walletId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ entries: WalletLedgerEntry[]; nextCursor: string | null }>;
  save(entry: WalletLedgerEntry): Promise<void>;
}

export interface LedgerEntryRepositoryPort extends LedgerEntryRepository {}
