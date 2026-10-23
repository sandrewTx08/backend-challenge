import { Wallet } from '../../domain/wallet/wallet.js';
import { Money } from '../../domain/common/money.js';

export interface WalletRepository {
  findById(id: string, lock?: boolean): Promise<Wallet | null>;
  findByPlayerAndCurrency(playerId: string, currency: string): Promise<Wallet | null>;
  save(wallet: Wallet): Promise<void>;
}

export interface WalletRepositoryPort extends WalletRepository {}
