import { Wallet } from '../../domain/wallet/wallet.js';
import { WalletRepositoryPort } from '../ports/wallet-repository.port.js';

export class GetWalletUseCase {
  constructor(private readonly wallets: WalletRepositoryPort) {}
  async execute(walletId: string): Promise<Wallet> {
    const w = await this.wallets.findById(walletId);
    if (!w) throw new Error('wallet not found');
    return w;
  }
}
