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
import { MedicalRecordsService } from "./medical-records.service";
import { CreateMedicalRecordDto } from "./dto/create-medical-record.dto";
import { UpdateMedicalRecordDto } from "./dto/update-medical-record.dto";
import { ListMedicalRecordsDto } from "./dto/list-clinical.dto";

@Controller("hospitals/:hospitalId/medical-records")
@UseGuards(JwtAuthGuard)
export class MedicalRecordsController {
  constructor(private readonly records: MedicalRecordsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Body() dto: CreateMedicalRecordDto,
  ) {
    return this.records.create(user.id, hospitalId, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Query() query: ListMedicalRecordsDto,
  ) {
    return this.records.findAll(user.id, hospitalId, query);
  }

  @Get(":recordId")
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("recordId", ParseUUIDPipe) recordId: string,
  ) {
    return this.records.findOne(user.id, hospitalId, recordId);
  }

  @Patch(":recordId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("recordId", ParseUUIDPipe) recordId: string,
    @Body() dto: UpdateMedicalRecordDto,
  ) {
    return this.records.update(user.id, hospitalId, recordId, dto);
  }

  @Post(":recordId/sign")
  @HttpCode(HttpStatus.OK)
  sign(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("recordId", ParseUUIDPipe) recordId: string,
  ) {
    return this.records.sign(user.id, hospitalId, recordId);
  }
}
