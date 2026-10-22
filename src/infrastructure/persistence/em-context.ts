import { AsyncLocalStorage } from 'node:async_hooks';
import { EntityManager } from '@mikro-orm/core';

const storage = new AsyncLocalStorage<EntityManager>();

export function getCurrentEm(): EntityManager | undefined {
  return storage.getStore();
}

export function runWithEm<T>(em: EntityManager, fn: () => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    storage.run(em, () => {
      Promise.resolve(fn()).then(resolve, reject);
    });
  });
}

export const emStorage = storage;
