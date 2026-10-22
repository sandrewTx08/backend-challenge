import { Money } from '../../domain/common/money.js';
import { WalletRepositoryPort } from '../ports/wallet-repository.port.js';
import { LedgerEntryRepositoryPort } from '../ports/ledger-entry-repository.port.js';

export interface ReconcileResult {
  walletId: string;
  storedBalance: Money;
  calculatedBalance: Money;
  difference: Money;
  consistent: boolean;
  checkedEntries: number;
}

export class ReconcileWalletUseCase {
  constructor(
    private readonly wallets: WalletRepositoryPort,
    private readonly ledgerEntries: LedgerEntryRepositoryPort,
  ) {}

  async execute(walletId: string): Promise<ReconcileResult> {
    const wallet = await this.wallets.findById(walletId);
    if (!wallet) throw new Error('wallet not found');

    const entries = await this.ledgerEntries.findByWallet(walletId);
    // reconstruct balance from ledger: start at 0, apply each entry
    let calculated = Money.zero(wallet.currency);
    for (const e of entries) {
      if (e.direction === 'CREDIT') {
        calculated = calculated.add(e.money);
      } else {
        calculated = calculated.subtract(e.money);
      }
    }

    const diff = wallet.balance.subtract(calculated);
    const absDiff = diff.isNegative() ? diff.negate() : diff;

    return {
      walletId,
      storedBalance: wallet.balance,
      calculatedBalance: calculated,
      difference: absDiff,
      consistent: absDiff.isZero(),
      checkedEntries: entries.length,
    };
  }
}
