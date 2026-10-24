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
import {
  AuthenticatedUser,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { StaffService } from "./staff.service";

@Controller("hospitals/:hospitalId/staff")
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Body() dto: CreateStaffDto,
  ) {
    return this.staffService.create(user.id, hospitalId, dto);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
  ) {
    return this.staffService.findAll(user.id, hospitalId);
  }
}
