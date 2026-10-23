import { EntityManager, LockMode } from '@mikro-orm/core';
import { Wallet } from '../../../domain/wallet/wallet.js';
import { Money } from '../../../domain/common/money.js';
import { WalletEntity } from '../entities/wallet.entity.js';
import { WalletRepositoryPort } from '../../../application/ports/wallet-repository.port.js';
import { getCurrentEm } from '../em-context.js';

export class MikroWalletRepository implements WalletRepositoryPort {
  constructor(private readonly getEm: () => EntityManager) {}

  private get em(): EntityManager {
    const em = this.getEm();
    if (!em) throw new Error('no EntityManager in context');
    return em;
  }

  async findById(id: string, lock = false): Promise<Wallet | null> {
    const e = await this.em.findOne(
      WalletEntity,
      { id },
      lock
        ? { lockMode: LockMode.PESSIMISTIC_WRITE }
        : { refresh: true },
    );
    return e ? this.toDomain(e) : null;
  }

  async findByPlayerAndCurrency(playerId: string, currency: string): Promise<Wallet | null> {
    const e = await this.em.findOne(WalletEntity, { playerId, currency }, { refresh: true });
    return e ? this.toDomain(e) : null;
  }

  async save(wallet: Wallet): Promise<void> {
    const state = wallet.toState();
    let e = await this.em.findOne(WalletEntity, { id: state.id });
    if (!e) {
      e = this.em.create(WalletEntity, {
        id: state.id,
        playerId: state.playerId,
        currency: state.currency,
        balanceAmount: state.balanceAmount,
        balanceCurrency: state.balanceCurrency,
        version: state.version,
        createdAt: new Date(state.createdAt),
        updatedAt: new Date(state.updatedAt),
      });
    } else {
      e.playerId = state.playerId;
      e.currency = state.currency;
      e.balanceAmount = state.balanceAmount;
      e.balanceCurrency = state.balanceCurrency;
      e.version = state.version;
      e.updatedAt = new Date(state.updatedAt);
    }
    this.em.persist(e);
    await this.em.flush();
  }

  private toDomain(e: WalletEntity): Wallet {
    return Wallet.rehydrate({
      id: e.id,
      playerId: e.playerId,
      currency: e.currency,
      balanceAmount: e.balanceAmount,
      balanceCurrency: e.balanceCurrency,
      version: e.version,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    });
  }
}
