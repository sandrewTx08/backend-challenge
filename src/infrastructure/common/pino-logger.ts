import { LoggerPort } from '../../application/ports/logger.port.js';

export class PinoLogger implements LoggerPort {
  constructor(private readonly level: string = 'info') {}

  private write(level: string, record: Record<string, unknown>): void {
    const entry = { level, time: new Date().toISOString(), ...record };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));
  }

  info(record: Record<string, unknown>): void {
    this.write('info', record);
  }

  warn(record: Record<string, unknown>): void {
    this.write('warn', record);
  }

  error(record: Record<string, unknown>): void {
    this.write('error', record);
  }
}
