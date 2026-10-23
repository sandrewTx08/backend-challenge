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

  async findByWalletCursor(
    walletId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ entries: WalletLedgerEntry[]; nextCursor: string | null }> {
    const lim = Math.max(1, Math.min(limit, 200));
    let where: any = { walletId };
    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        const { createdAt, id } = decoded;
        // cursor-based: rows with (createdAt, id) > cursor
        where = {
          walletId,
          $or: [
            { createdAt: { $gt: new Date(createdAt) } },
            { createdAt: new Date(createdAt), id: { $gt: id } },
          ],
        };
      } catch {
        // invalid cursor -> ignore
      }
    }
    const list = await this.em.find(WalletLedgerEntryEntity, where, {
      orderBy: { createdAt: 'ASC', id: 'ASC' },
      limit: lim + 1,
    });
    const hasMore = list.length > lim;
    const page = list.slice(0, lim);
    const entries = page.map((e) => this.toDomain(e));
    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
      ).toString('base64');
    }
    return { entries, nextCursor };
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
