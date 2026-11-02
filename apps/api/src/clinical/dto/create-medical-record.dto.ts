import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { VitalsDto } from "./vitals.dto";

export class CreateMedicalRecordDto extends VitalsDto {
  @IsUUID()
  patientId!: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  chiefComplaint?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  symptoms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  diagnosis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  treatmentPlan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
