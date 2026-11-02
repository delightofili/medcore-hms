import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsMilitaryTime,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class WeeklyAvailabilityItemDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsMilitaryTime()
  startTime!: string;

  @IsMilitaryTime()
  endTime!: string;

  @IsInt()
  @Min(5)
  @Max(240)
  slotMinutes!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetAvailabilityDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WeeklyAvailabilityItemDto)
  schedules!: WeeklyAvailabilityItemDto[];
}

export class DoctorIdParamDto {
  @IsUUID()
  doctorId!: string;
}
