import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../../infrastructure/auth/keycloak-auth.guard.js';
import { SubmitWagerTransactionUseCase } from '../../application/use-cases/submit-wager-transaction.use-case.js';
import { GetWalletUseCase } from '../../application/use-cases/get-wallet.use-case.js';
import { Money } from '../../domain/common/money.js';
import { WagerTransactionKind } from '../../domain/common/wager-transaction-kind.js';
import { SubmitWagerTransactionDto, WagerTransactionResponseDto } from '../dto/wagering.dto.js';

@Controller()
@UseGuards(KeycloakAuthGuard)
export class WageringController {
  constructor(private readonly submit: SubmitWagerTransactionUseCase) {}

  @Post('wagering/transactions')
  @HttpCode(HttpStatus.OK)
  async submitTransaction(
    @Body() dto: SubmitWagerTransactionDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<WagerTransactionResponseDto> {
    const key = idempotencyKey || `${dto.providerId}:${dto.externalTransactionId}`;
    const result = await this.submit.execute({
      providerId: dto.providerId,
      externalTransactionId: dto.externalTransactionId,
      idempotencyKey: key,
      playerId: dto.playerId,
      walletId: dto.walletId,
      roundId: dto.roundId,
      gameId: dto.gameId,
      kind: dto.kind,
      money: Money.from(dto.money),
      referenceExternalTransactionId: dto.referenceExternalTransactionId,
      correlationId: crypto.randomUUID(),
    });
    return {
      transactionId: result.transactionId,
      status: result.status,
      balance: result.balance.toJSON(),
      idempotentReplay: result.idempotentReplay,
    };
  }

  @Get('wagering/transactions/:transactionId')
  async getTransaction(@Param('transactionId') transactionId: string) {
    // not fully implemented; return placeholder
    return { transactionId };
  }

  @Get('providers/:providerId/wagering/transactions/:externalTransactionId')
  async getByProviderExternal(
    @Param('providerId') providerId: string,
    @Param('externalTransactionId') externalTransactionId: string,
  ) {
    return { providerId, externalTransactionId };
  }
}
