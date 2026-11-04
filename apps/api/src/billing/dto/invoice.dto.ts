import { InvoiceStatus, PaymentMethod } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const MONEY = { maxDecimalPlaces: 2 };
const MAX_AMOUNT = 100_000_000;

export class InvoiceItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_AMOUNT)
  unitPrice!: number;
}

export class InvoiceDetailsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_AMOUNT)
  discountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0)
  @Max(MAX_AMOUNT)
  taxAmount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateInvoiceDto extends InvoiceDetailsDto {
  @IsUUID()
  patientId!: string;
}

export class ListInvoicesDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class VoidInvoiceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  reason!: string;
}

export class RecordPaymentDto {
  @Type(() => Number)
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_AMOUNT)
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  providerReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  idempotencyKey?: string;
}
