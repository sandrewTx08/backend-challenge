import { EntityManager } from '@mikro-orm/core';
import { UnitOfWork } from '../../application/ports/unit-of-work.port.js';
import { getCurrentEm, runWithEm } from './em-context.js';

export class MikroUnitOfWork implements UnitOfWork {
  constructor(private readonly getEm: () => EntityManager) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const em = this.getEm();
    if (!em) throw new Error('no EntityManager in context');
    return em.transactional(async (txEm) => {
      return runWithEm(txEm, async () => {
        const r = await fn();
        await txEm.flush();
        return r;
      });
    });
  }
}
