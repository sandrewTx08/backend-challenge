import { EntityManager } from '@mikro-orm/core';
import { WalletLedgerEntry } from '../../../domain/ledger-entry/ledger-entry.js';
import { WalletLedgerEntryEntity } from '../entities/wallet-ledger-entry.entity.js';
import { LedgerEntryRepositoryPort } from '../../../application/ports/ledger-entry-repository.port.js';

export class MikroLedgerEntryRepository implements LedgerEntryRepositoryPort {
  constructor(private readonly getEm: () => EntityManager) {}

  private get em(): EntityManager {
    const em = this.getEm();
    if (!em) throw new Error('no EntityManager in context');
    return em;
  }

  async findByWallet(walletId: string): Promise<WalletLedgerEntry[]> {
    const list = await this.em.find(
      WalletLedgerEntryEntity,
      { walletId },
      { orderBy: { createdAt: 'ASC' } },
    );
    return list.map((e) => this.toDomain(e));
  }

  async save(entry: WalletLedgerEntry): Promise<void> {
    const state = entry.toState();
    const e = this.em.create(WalletLedgerEntryEntity, {
      id: state.id,
      walletId: state.walletId,
      transactionId: state.transactionId,
      direction: state.direction,
      moneyAmount: state.moneyAmount,
      moneyCurrency: state.moneyCurrency,
      balanceBeforeAmount: state.balanceBeforeAmount,
      balanceBeforeCurrency: state.balanceBeforeCurrency,
      balanceAfterAmount: state.balanceAfterAmount,
      balanceAfterCurrency: state.balanceAfterCurrency,
      createdAt: new Date(state.createdAt),
    });
    this.em.persist(e);
    await this.em.flush();
  }

  private toDomain(e: WalletLedgerEntryEntity): WalletLedgerEntry {
    return WalletLedgerEntry.rehydrate({
      id: e.id,
      walletId: e.walletId,
      transactionId: e.transactionId,
      direction: e.direction as any,
      moneyAmount: e.moneyAmount,
      moneyCurrency: e.moneyCurrency,
      balanceBeforeAmount: e.balanceBeforeAmount,
      balanceBeforeCurrency: e.balanceBeforeCurrency,
      balanceAfterAmount: e.balanceAfterAmount,
      balanceAfterCurrency: e.balanceAfterCurrency,
      createdAt: e.createdAt.toISOString(),
    });
  }
}
