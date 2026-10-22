import { test, expect } from 'bun:test';
import { Wallet } from '../../src/domain/wallet/wallet';
import { Money } from '../../src/domain/common/money';

test('Wallet.open sets balance and version 1', () => {
  const w = Wallet.open({ id: 'w1', playerId: 'p1', initialBalance: Money.from({ amount: '100.00', currency: 'BRL' }) });
  expect(w.balance.toString()).toBe('100.00');
  expect(w.version).toBe(1);
});

test('Wallet.debit reduces balance', () => {
  const w = Wallet.open({ id: 'w1', playerId: 'p1', initialBalance: Money.from({ amount: '100.00', currency: 'BRL' }) });
  const { newBalance } = w.debit(Money.from({ amount: '30.00', currency: 'BRL' }));
  expect(newBalance.toString()).toBe('70.00');
  expect(w.balance.toString()).toBe('70.00');
  expect(w.version).toBe(2);
});

test('Wallet.debit insufficient throws', () => {
  const w = Wallet.open({ id: 'w1', playerId: 'p1', initialBalance: Money.from({ amount: '10.00', currency: 'BRL' }) });
  expect(() => w.debit(Money.from({ amount: '30.00', currency: 'BRL' }))).toThrow();
});

test('Wallet.credit increases balance', () => {
  const w = Wallet.open({ id: 'w1', playerId: 'p1', initialBalance: Money.from({ amount: '10.00', currency: 'BRL' }) });
  w.credit(Money.from({ amount: '5.00', currency: 'BRL' }));
  expect(w.balance.toString()).toBe('15.00');
});

test('Wallet currency mismatch throws', () => {
  const w = Wallet.open({ id: 'w1', playerId: 'p1', initialBalance: Money.from({ amount: '10.00', currency: 'BRL' }) });
  expect(() => w.debit(Money.from({ amount: '1.00', currency: 'USD' }))).toThrow();
});
