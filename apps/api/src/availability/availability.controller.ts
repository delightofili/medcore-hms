import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AvailabilityService } from "./availability.service";
import { SetAvailabilityDto } from "./dto/set-availability.dto";
import { CreateUnavailablePeriodDto } from "./dto/create-unavailable-period.dto";
import { SlotsQueryDto } from "./dto/slots-query.dto";

@Controller("hospitals/:hospitalId/doctors")
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  listDoctors(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
  ) {
    return this.availability.listDoctors(user.id, hospitalId);
  }

  @Post(":doctorId/availability")
  setAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("doctorId", ParseUUIDPipe) doctorId: string,
    @Body() dto: SetAvailabilityDto,
  ) {
    return this.availability.setWeeklyAvailability(
      user.id,
      hospitalId,
      doctorId,
      dto,
    );
  }

  @Get(":doctorId/availability")
  getAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("doctorId", ParseUUIDPipe) doctorId: string,
  ) {
    return this.availability.getWeeklyAvailability(
      user.id,
      hospitalId,
      doctorId,
    );
  }

  @Post(":doctorId/unavailable-periods")
  addUnavailablePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("doctorId", ParseUUIDPipe) doctorId: string,
    @Body() dto: CreateUnavailablePeriodDto,
  ) {
    return this.availability.addUnavailablePeriod(
      user.id,
      hospitalId,
      doctorId,
      dto,
    );
  }

  @Get("available-slots")
  getSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Query() query: SlotsQueryDto,
  ) {
    return this.availability.getSlots(
      user.id,
      hospitalId,
      query.doctorId,
      query.date,
    );
  }
}
