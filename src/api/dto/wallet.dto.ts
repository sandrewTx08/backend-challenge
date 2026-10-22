import { IsString, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MoneyDto } from './money.dto.js';

export class CreateWalletDto {
  @IsString()
  playerId!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => MoneyDto)
  initialBalance!: MoneyDto;
}

export class WalletResponseDto {
  id!: string;
  playerId!: string;
  balance!: { amount: string; currency: string };
  version!: number;
}
