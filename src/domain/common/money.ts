/**
 * Money — immutable monetary value object.
 *
 * Amounts are stored internally as integer "cents" (BigInt) to avoid
 * floating point errors. External representation is a decimal string
 * with a fixed scale of 2 decimal places.
 */
export interface MoneyProps {
  amount: string; // decimal string, scale 2, e.g. "25.00"
  currency: string; // ISO-4217, e.g. "BRL"
}

const SCALE = 2;
const DECIMAL_PLACES_RE = /^-?\d+(\.\d{1,2})?$/;

export class Money {
  private constructor(
    private readonly cents: bigint,
    public readonly currency: string,
  ) {}

  static from(props: MoneyProps): Money {
    const { amount, currency } = props;

    if (typeof amount !== 'string' || amount.trim().length === 0) {
      throw new MoneyValidationError('amount must be a non-empty string');
    }
    if (typeof currency !== 'string' || currency.length !== 3) {
      throw new MoneyValidationError('currency must be a 3-letter ISO-4217 code');
    }

    const trimmed = amount.trim();
    if (!DECIMAL_PLACES_RE.test(trimmed)) {
      throw new MoneyValidationError(
        `invalid amount "${amount}": must be a decimal string with at most 2 decimal places, no scientific notation`,
      );
    }

    // reject NaN/Infinity already handled by regex; reject negative in contracts? Money allows negative internally for some ops, but input validation:
    // parse
    const negative = trimmed.startsWith('-');
    const abs = negative ? trimmed.slice(1) : trimmed;
    const [intPart, fracPart = ''] = abs.split('.');
    const fracPadded = (fracPart + '00').slice(0, 2);
    const centsStr = (intPart === '' ? '0' : intPart) + fracPadded;
    const cents = BigInt(centsStr);
    const signed = negative ? -cents : cents;

    // reject more than 2 decimal places (regex already limits to 1-2, but check exact)
    if (fracPart.length > 2) {
      throw new MoneyValidationError('amount must have at most 2 decimal places');
    }

    return new Money(signed, currency.toUpperCase());
  }

  static zero(currency: string): Money {
    return new Money(0n, currency.toUpperCase());
  }

  private static fromCents(cents: bigint, currency: string): Money {
    return new Money(cents, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.cents - other.cents, this.currency);
  }

  negate(): Money {
    return Money.fromCents(-this.cents, this.currency);
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  isPositive(): boolean {
    return this.cents > 0n;
  }

  isNegative(): boolean {
    return this.cents < 0n;
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.cents < other.cents;
  }

  isLessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.cents <= other.cents;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.cents === other.cents;
  }

  toJSON(): MoneyProps {
    return { amount: this.toString(), currency: this.currency };
  }

  toString(): string {
    const negative = this.cents < 0n;
    const abs = negative ? -this.cents : this.cents;
    const intPart = abs / 100n;
    const fracPart = abs % 100n;
    const fracStr = fracPart.toString().padStart(2, '0');
    const result = `${intPart.toString()}.${fracStr}`;
    return negative ? `-${result}` : result;
  }

  assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new MoneyValidationError(
        `currency mismatch: ${this.currency} vs ${other.currency}`,
      );
    }
  }
}

export class MoneyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyValidationError';
  }
}
