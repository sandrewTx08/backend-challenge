export enum WagerTransactionKind {
  Opening = 'OPENING',
  Bet = 'BET',
  Win = 'WIN',
  Loss = 'LOSS',
  Refund = 'REFUND',
  Rollback = 'ROLLBACK',
}

export const BALANCE_AFFECTING_KINDS = new Set([
  WagerTransactionKind.Bet,
  WagerTransactionKind.Win,
  WagerTransactionKind.Refund,
  WagerTransactionKind.Rollback,
]);

export const REFERENCE_REQUIRED_KINDS = new Set([
  WagerTransactionKind.Refund,
  WagerTransactionKind.Rollback,
]);

export const VALID_REFERENCE_SOURCES: Record<WagerTransactionKind, Set<WagerTransactionKind>> = {
  [WagerTransactionKind.Opening]: new Set(),
  [WagerTransactionKind.Bet]: new Set(),
  [WagerTransactionKind.Win]: new Set(),
  [WagerTransactionKind.Loss]: new Set(),
  [WagerTransactionKind.Refund]: new Set([WagerTransactionKind.Bet]),
  [WagerTransactionKind.Rollback]: new Set([
    WagerTransactionKind.Bet,
    WagerTransactionKind.Win,
    WagerTransactionKind.Refund,
  ]),
};
