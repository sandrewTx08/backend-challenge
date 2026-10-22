import { test, expect } from 'bun:test';
import { WageringController } from '../../../src/api/controllers/wagering.controller';
import { Money } from '../../../src/domain/common/money';

test('WageringController.submitTransaction returns dto', async () => {
  const submit = {
    execute: async () => ({ transactionId: 't1', status: 'PROCESSED', balance: Money.from({ amount: '75.00', currency: 'BRL' }), idempotentReplay: false }),
  };
  const ctrl = new WageringController(submit as any);
  const res = await ctrl.submitTransaction(
    { providerId: 'pa', externalTransactionId: 't1', playerId: 'p1', walletId: 'w1', roundId: 'r1', gameId: 'g1', kind: 'BET' as any, money: { amount: '25.00', currency: 'BRL' } } as any,
    'pa:t1',
  );
  expect(res.transactionId).toBe('t1');
  expect(res.status).toBe('PROCESSED');
  expect(res.balance.amount).toBe('75.00');
  expect(res.idempotentReplay).toBe(false);
});

test('WageringController.submitTransaction uses default idempotency key', async () => {
  let capturedKey: string | undefined;
  const submit = {
    execute: async (cmd: any) => { capturedKey = cmd.idempotencyKey; return { transactionId: 't2', status: 'PROCESSED', balance: Money.from({ amount: '10.00', currency: 'BRL' }), idempotentReplay: false }; },
  };
  const ctrl = new WageringController(submit as any);
  await ctrl.submitTransaction(
    { providerId: 'pa', externalTransactionId: 't2', playerId: 'p1', walletId: 'w1', roundId: 'r1', gameId: 'g1', kind: 'BET' as any, money: { amount: '5.00', currency: 'BRL' } } as any,
    undefined,
  );
  expect(capturedKey).toBe('pa:t2');
});
