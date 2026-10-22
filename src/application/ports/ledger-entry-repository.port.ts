import { WalletLedgerEntry } from '../../domain/ledger-entry/ledger-entry.js';

export interface LedgerEntryRepository {
  findByWallet(walletId: string): Promise<WalletLedgerEntry[]>;
  save(entry: WalletLedgerEntry): Promise<void>;
}

export interface LedgerEntryRepositoryPort extends LedgerEntryRepository {}
