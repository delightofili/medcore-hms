import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateHospitalDto } from "./dto/create-hospital.dto";
import { HospitalsService } from "./hospitals.service";

@Controller("hospitals")
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateHospitalDto) {
    return this.hospitalsService.create(dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  findAll() {
    return this.hospitalsService.findAll();
  }

  @Get(":hospitalId")
  @Roles(UserRole.SUPER_ADMIN)
  findOne(@Param("hospitalId", ParseUUIDPipe) hospitalId: string) {
    return this.hospitalsService.findOne(hospitalId);
  }
}
