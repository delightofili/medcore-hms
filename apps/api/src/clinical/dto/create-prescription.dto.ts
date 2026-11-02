import { MedicineForm } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class PrescriptionItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  medicineName!: string;

  @IsOptional()
  @IsEnum(MedicineForm)
  form?: MedicineForm;

  @IsString()
  @MaxLength(60)
  dosage!: string; // e.g. "500mg"

  @IsString()
  @MaxLength(60)
  frequency!: string; // e.g. "Twice daily"

  @IsString()
  @MaxLength(60)
  duration!: string; // e.g. "5 days"

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  instructions?: string;
}

export class CreatePrescriptionDto {
  @IsUUID()
  medicalRecordId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items!: PrescriptionItemDto[];
}
