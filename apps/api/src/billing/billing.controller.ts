import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  AuthenticatedUser,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { BillingService } from "./billing.service";
import {
  CreateInvoiceDto,
  InvoiceDetailsDto,
  ListInvoicesDto,
  RecordPaymentDto,
  VoidInvoiceDto,
} from "./dto/invoice.dto";

@Controller("hospitals/:hospitalId/invoices")
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.billing.create(user.id, hospitalId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Query() query: ListInvoicesDto,
  ) {
    return this.billing.findAll(user.id, hospitalId, query);
  }

  @Get("patients")
  searchPatients(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Query("q") q?: string,
  ) {
    return this.billing.searchPatients(user.id, hospitalId, q);
  }

  @Get(":invoiceId")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billing.findOne(user.id, hospitalId, invoiceId);
  }

  @Patch(":invoiceId")
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() dto: InvoiceDetailsDto,
  ) {
    return this.billing.updateDraft(user.id, hospitalId, invoiceId, dto);
  }

  @Post(":invoiceId/issue")
  @HttpCode(HttpStatus.OK)
  issue(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
  ) {
    return this.billing.issue(user.id, hospitalId, invoiceId);
  }

  @Post(":invoiceId/void")
  @HttpCode(HttpStatus.OK)
  void(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.billing.void(user.id, hospitalId, invoiceId, dto);
  }

  @Post(":invoiceId/payments")
  recordPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("invoiceId", ParseUUIDPipe) invoiceId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.billing.recordPayment(user.id, hospitalId, invoiceId, dto);
  }
}
