import { IdGeneratorPort } from '../../application/ports/id-generator.port.js';

export class CryptoIdGenerator implements IdGeneratorPort {
  generate(): string {
    return crypto.randomUUID();
  }
}
