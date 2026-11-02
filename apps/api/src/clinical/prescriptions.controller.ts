import {
  Body,
  Controller,
  Get,
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
import { PrescriptionsService } from "./prescriptions.service";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";
import { ListPrescriptionsDto } from "./dto/list-clinical.dto";
import { UpdatePrescriptionStatusDto } from "./dto/update-prescription-status.dto";

@Controller("hospitals/:hospitalId/prescriptions")
@UseGuards(JwtAuthGuard)
export class PrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Body() dto: CreatePrescriptionDto,
  ) {
    return this.prescriptions.create(user.id, hospitalId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Query() query: ListPrescriptionsDto,
  ) {
    return this.prescriptions.findAll(user.id, hospitalId, query);
  }

  @Get(":prescriptionId")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("prescriptionId", ParseUUIDPipe) prescriptionId: string,
  ) {
    return this.prescriptions.findOne(user.id, hospitalId, prescriptionId);
  }

  @Patch(":prescriptionId/status")
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("prescriptionId", ParseUUIDPipe) prescriptionId: string,
    @Body() dto: UpdatePrescriptionStatusDto,
  ) {
    return this.prescriptions.updateStatus(
      user.id,
      hospitalId,
      prescriptionId,
      dto,
    );
  }
}
