import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { SearchPatientsDto } from "./dto/search-patients.dto";
import { PatientsService } from "./patients.service";

@Controller("hospitals/:hospitalId/patients")
@UseGuards(JwtAuthGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Body() dto: CreatePatientDto,
  ) {
    return this.patientsService.create(user.id, hospitalId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Query() query: SearchPatientsDto,
  ) {
    return this.patientsService.findAll(user.id, hospitalId, query);
  }

  @Get(":patientId")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("patientId", ParseUUIDPipe) patientId: string,
  ) {
    return this.patientsService.findOne(user.id, hospitalId, patientId);
  }

  @Patch(":patientId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("patientId", ParseUUIDPipe) patientId: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(user.id, hospitalId, patientId, dto);
  }

  @Delete(":patientId")
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("patientId", ParseUUIDPipe) patientId: string,
  ) {
    return this.patientsService.remove(user.id, hospitalId, patientId);
  }
}
