import { test, expect } from 'bun:test';
import { Money, MoneyValidationError } from '../../src/domain/common/money';

// README Section 6.1: Money amount received/serialized as decimal string scale 2
test('Money.from parses decimal string', () => {
  const m = Money.from({ amount: '25.00', currency: 'BRL' });
  expect(m.toString()).toBe('25.00');
  expect(m.currency).toBe('BRL');
});

test('Money arithmetic', () => {
  const a = Money.from({ amount: '10.00', currency: 'BRL' });
  const b = Money.from({ amount: '3.50', currency: 'BRL' });
  expect(a.add(b).toString()).toBe('13.50');
  expect(a.subtract(b).toString()).toBe('6.50');
});

test('Money rejects invalid inputs', () => {
  expect(() => Money.from({ amount: '', currency: 'BRL' })).toThrow(MoneyValidationError);
  expect(() => Money.from({ amount: '1e3', currency: 'BRL' })).toThrow(MoneyValidationError);
  expect(() => Money.from({ amount: '1.234', currency: 'BRL' })).toThrow(MoneyValidationError);
  expect(() => Money.from({ amount: 'NaN', currency: 'BRL' })).toThrow(MoneyValidationError);
});

test('Money currency mismatch', () => {
  const a = Money.from({ amount: '10.00', currency: 'BRL' });
  const b = Money.from({ amount: '3.50', currency: 'USD' });
  expect(() => a.add(b)).toThrow();
});

test('Money immutable', () => {
  const a = Money.from({ amount: '10.00', currency: 'BRL' });
  const b = a.add(Money.from({ amount: '1.00', currency: 'BRL' }));
  expect(a.toString()).toBe('10.00');
  expect(b.toString()).toBe('11.00');
});
