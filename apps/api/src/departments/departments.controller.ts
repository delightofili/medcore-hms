import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Delete,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  CurrentUser,
  AuthenticatedUser,
} from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { DepartmentsService } from "./departments.service";

@Controller("hospitals/:hospitalId/departments")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(user.id, hospitalId, dto);
  }

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.RECEPTIONIST,
    UserRole.LAB_TECHNICIAN,
    UserRole.PHARMACIST,
    UserRole.ACCOUNTANT,
  )
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
  ) {
    return this.departmentsService.findAll(user.id, hospitalId);
  }

  @Get(":departmentId")
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.HOSPITAL_ADMIN,
    UserRole.DOCTOR,
    UserRole.NURSE,
    UserRole.RECEPTIONIST,
    UserRole.LAB_TECHNICIAN,
    UserRole.PHARMACIST,
    UserRole.ACCOUNTANT,
  )
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("departmentId", ParseUUIDPipe) departmentId: string,
  ) {
    return this.departmentsService.findOne(user.id, hospitalId, departmentId);
  }

  @Delete(":departmentId")
  @Roles(UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN)
  deactivate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
    @Param("departmentId", ParseUUIDPipe) departmentId: string,
  ) {
    return this.departmentsService.deactivate(
      user.id,
      hospitalId,
      departmentId,
    );
  }
}
