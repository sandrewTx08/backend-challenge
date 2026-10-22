import { IsString, IsObject, ValidateNested, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { MoneyDto } from './money.dto.js';
import { WagerTransactionKind } from '../../domain/common/wager-transaction-kind.js';

export class SubmitWagerTransactionDto {
  @IsString()
  providerId!: string;

  @IsString()
  externalTransactionId!: string;

  @IsString()
  playerId!: string;

  @IsString()
  walletId!: string;

  @IsString()
  roundId!: string;

  @IsString()
  gameId!: string;

  @IsEnum(WagerTransactionKind)
  kind!: WagerTransactionKind;

  @IsObject()
  @ValidateNested()
  @Type(() => MoneyDto)
  money!: MoneyDto;

  @IsOptional()
  @IsString()
  referenceExternalTransactionId?: string;
}

export class WagerTransactionResponseDto {
  transactionId!: string;
  status!: string;
  balance!: { amount: string; currency: string };
  idempotentReplay!: boolean;
}

export class ReconciliationResponseDto {
  walletId!: string;
  storedBalance!: { amount: string; currency: string };
  calculatedBalance!: { amount: string; currency: string };
  difference!: { amount: string; currency: string };
  consistent!: boolean;
  checkedEntries!: number;
}
