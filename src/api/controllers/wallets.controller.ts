import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { KeycloakAuthGuard } from '../../infrastructure/auth/keycloak-auth.guard.js';
import { OpenWalletUseCase } from '../../application/use-cases/open-wallet.use-case.js';
import { ReconcileWalletUseCase } from '../../application/use-cases/reconcile-wallet.use-case.js';
import { GetWalletUseCase } from '../../application/use-cases/get-wallet.use-case.js';
import { GetLedgerUseCase } from '../../application/use-cases/get-ledger.use-case.js';
import { Money } from '../../domain/common/money.js';
import { CreateWalletDto, WalletResponseDto } from '../dto/wallet.dto.js';
import { ReconciliationResponseDto } from '../dto/wagering.dto.js';
import { ConflictError } from '../../application/use-cases/open-wallet.use-case.js';

@Controller('wallets')
@UseGuards(KeycloakAuthGuard)
export class WalletsController {
  constructor(
    private readonly openWallet: OpenWalletUseCase,
    private readonly getWallet: GetWalletUseCase,
    private readonly getLedger: GetLedgerUseCase,
    private readonly reconcile: ReconcileWalletUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateWalletDto): Promise<WalletResponseDto> {
    try {
      const result = await this.openWallet.execute({
        playerId: dto.playerId,
        initialBalance: Money.from(dto.initialBalance),
        correlationId: crypto.randomUUID(),
      });
      return {
        id: result.walletId,
        playerId: result.playerId,
        balance: result.balance.toJSON(),
        version: result.version,
      };
    } catch (err) {
      if (err instanceof ConflictError) {
        const { ConflictException } = require('@nestjs/common');
        throw new ConflictException(err.message);
      }
      throw err;
    }
  }

  @Get(':walletId')
  async get(@Param('walletId') walletId: string): Promise<WalletResponseDto> {
    const w = await this.getWallet.execute(walletId);
    return {
      id: w.id,
      playerId: w.playerId,
      balance: w.balance.toJSON(),
      version: w.version,
    };
  }

  @Get(':walletId/ledger')
  async ledger(
    @Param('walletId') walletId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 50;
    const { entries, nextCursor } = await this.getLedger.execute(walletId, lim, cursor);
    return {
      walletId,
      entries: entries.map((e) => ({
        id: e.id,
        transactionId: e.transactionId,
        direction: e.direction,
        money: e.money.toJSON(),
        balanceBefore: e.balanceBefore.toJSON(),
        balanceAfter: e.balanceAfter.toJSON(),
        createdAt: e.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  @Post(':walletId/reconciliation')
  @HttpCode(HttpStatus.OK)
  async reconcileWallet(@Param('walletId') walletId: string): Promise<ReconciliationResponseDto> {
    const r = await this.reconcile.execute(walletId);
    return {
      walletId: r.walletId,
      storedBalance: r.storedBalance.toJSON(),
      calculatedBalance: r.calculatedBalance.toJSON(),
      difference: r.difference.toJSON(),
      consistent: r.consistent,
      checkedEntries: r.checkedEntries,
    };
  }
}
