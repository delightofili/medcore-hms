import { IsDateString, IsOptional, IsUUID } from "class-validator";

export class SlotsQueryDto {
  @IsUUID()
  doctorId!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
