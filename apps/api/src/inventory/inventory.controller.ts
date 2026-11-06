import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermission } from '../auth/auth.decorators.js';
import type { AuthContext, AuthorizationScope } from '../auth/auth.types.js';
import {
  AdjustmentDto,
  DamageDto,
  InventoryQueryDto,
  MovementQueryDto,
  ReceiptDto,
  ReceiptVariantQueryDto,
  TransferDto,
  WarehousePostingDto,
} from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';
import { MAX_PROOF_SIZE_BYTES, ProofStorageService } from './proof-storage.service.js';

interface ScopedRequest extends Request {
  auth?: AuthContext;
  authorizationScope?: AuthorizationScope;
}

@Controller('api/v1/organizations/:organizationId/inventory')
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly proofStorage: ProofStorageService,
  ) {}

  // --------------------------------------------------------------------- reads

  @Get('balances')
  @RequirePermission('inventory.read')
  listBalances(@Req() request: ScopedRequest, @Query() query: InventoryQueryDto) {
    return this.inventory.listBalances(request.authorizationScope!, query);
  }

  @Get('warehouses')
  @RequirePermission('inventory.read')
  listWarehouses(@Req() request: ScopedRequest) {
    return this.inventory.listWarehouses(request.authorizationScope!);
  }

  @Get('receipt-variants')
  @RequirePermission('inventory.read')
  listReceiptVariants(@Req() request: ScopedRequest, @Query() query: ReceiptVariantQueryDto) {
    return this.inventory.listReceiptVariants(request.authorizationScope!, query);
  }

  @Get('movements')
  @RequirePermission('inventory.read')
  listMovements(@Req() request: ScopedRequest, @Query() query: MovementQueryDto) {
    return this.inventory.listMovements(request.authorizationScope!, query);
  }

  @Get('reconciliation')
  @RequirePermission('inventory.read')
  reconcile(@Req() request: ScopedRequest) {
    return this.inventory.reconcile(request.authorizationScope!);
  }

  @Get('availability/:productId')
  @RequirePermission('inventory.read')
  availability(@Req() request: ScopedRequest, @Param('productId') productId: string) {
    return this.inventory.availabilityForProduct(request.authorizationScope!, productId);
  }

  // ------------------------------------------------------------------ postings

  @Post('receipts')
  @RequirePermission('inventory.write')
  @UseInterceptors(
    FileInterceptor('proof_file', {
      limits: { fileSize: MAX_PROOF_SIZE_BYTES, files: 1, fields: 10, fieldSize: 4096 },
    }),
  )
  async postReceipt(
    @Req() request: ScopedRequest,
    @Body() body: ReceiptDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    const proof = await this.proofStorage.store(file);
    try {
      const posting = await this.inventory.postReceipt(
        request.auth!.userId,
        request.authorizationScope!,
        body,
        proof,
      );
      if (posting.replayed) await this.proofStorage.remove(proof.storageKey);
      return posting;
    } catch (error) {
      await this.proofStorage.remove(proof.storageKey);
      throw error;
    }
  }

  @Get('proofs/:postingId')
  @RequirePermission('inventory.read')
  async getReceiptProof(
    @Req() request: ScopedRequest,
    @Param('postingId') postingId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const proof = await this.inventory.getProof(request.authorizationScope!, postingId);
    const bytes = await this.proofStorage.read(proof.storageKey, proof.sha256);
    response.setHeader('Content-Type', proof.mimeType);
    response.setHeader('Content-Length', String(bytes.length));
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(proof.fileName)}`);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(bytes);
  }

  @Post('issues')
  @RequirePermission('inventory.write')
  postIssue(@Req() request: ScopedRequest, @Body() body: WarehousePostingDto) {
    return this.inventory.postIssue(request.auth!.userId, request.authorizationScope!, body);
  }

  @Post('transfers')
  @RequirePermission('inventory.write')
  postTransfer(@Req() request: ScopedRequest, @Body() body: TransferDto) {
    return this.inventory.postTransfer(request.auth!.userId, request.authorizationScope!, body);
  }

  @Post('reservations')
  @RequirePermission('inventory.write')
  postReservation(@Req() request: ScopedRequest, @Body() body: WarehousePostingDto) {
    return this.inventory.postReservation(request.auth!.userId, request.authorizationScope!, body);
  }

  @Post('reservations/release')
  @RequirePermission('inventory.write')
  postRelease(@Req() request: ScopedRequest, @Body() body: WarehousePostingDto) {
    return this.inventory.postRelease(request.auth!.userId, request.authorizationScope!, body);
  }

  @Post('adjustments')
  @RequirePermission('inventory.adjust')
  postAdjustment(@Req() request: ScopedRequest, @Body() body: AdjustmentDto) {
    return this.inventory.postAdjustment(request.auth!.userId, request.authorizationScope!, body);
  }

  @Post('damage')
  @RequirePermission('inventory.adjust')
  postDamage(@Req() request: ScopedRequest, @Body() body: DamageDto) {
    return this.inventory.postDamage(request.auth!.userId, request.authorizationScope!, body);
  }
}
