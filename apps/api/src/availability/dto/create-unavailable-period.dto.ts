import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateUnavailablePeriodDto {
  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  reason?: string;
}
