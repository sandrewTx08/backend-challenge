import { createHash } from 'crypto';
import { HashPort } from '../../application/ports/hash.port.js';

export class Sha256Hash implements HashPort {
  sha256Hex(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }
}
