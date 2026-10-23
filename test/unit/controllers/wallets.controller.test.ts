import { test, expect } from 'bun:test';
import { WalletsController } from '../../../src/api/controllers/wallets.controller';
import { Money } from '../../../src/domain/common/money';

function makeController(overrides: any = {}) {
  const openWallet = { execute: async () => ({ walletId: 'w1', playerId: 'p1', balance: Money.from({ amount: '10.00', currency: 'BRL' }), version: 1 }) };
  const getWallet = { execute: async () => ({ id: 'w1', playerId: 'p1', balance: Money.from({ amount: '10.00', currency: 'BRL' }), version: 1 }) };
  const getLedger = { execute: async () => ({ entries: [], nextCursor: null }) };
  const reconcile = { execute: async () => ({ walletId: 'w1', storedBalance: Money.from({ amount: '10.00', currency: 'BRL' }), calculatedBalance: Money.from({ amount: '10.00', currency: 'BRL' }), difference: Money.from({ amount: '0.00', currency: 'BRL' }), consistent: true, checkedEntries: 0 }) };
  return new WalletsController(
    { ...openWallet, ...overrides.openWallet } as any,
    { ...getWallet, ...overrides.getWallet } as any,
    { ...getLedger, ...overrides.getLedger } as any,
    { ...reconcile, ...overrides.reconcile } as any,
  );
}

// README Section 9: POST /wallets creates wallet with balance and version
test('WalletsController.create returns dto', async () => {
  const ctrl = makeController();
  const res = await ctrl.create({ playerId: 'p1', initialBalance: { amount: '10.00', currency: 'BRL' } } as any);
  expect(res.id).toBe('w1');
  expect(res.balance.amount).toBe('10.00');
  expect(res.version).toBe(1);
});

test('WalletsController.get returns dto', async () => {
  const ctrl = makeController();
  const res = await ctrl.get('w1');
  expect(res.id).toBe('w1');
  expect(res.playerId).toBe('p1');
});

test('WalletsController.reconcileWallet returns consistent', async () => {
  const ctrl = makeController();
  const res = await ctrl.reconcileWallet('w1');
  expect(res.consistent).toBe(true);
  expect(res.checkedEntries).toBe(0);
});
