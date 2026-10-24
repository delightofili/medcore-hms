import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { TenantAccessService } from "../auth/tenant-access.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  async create(userId: string, hospitalId: string, dto: CreateDepartmentDto) {
    await this.tenantAccess.requireHospitalAdmin(userId, hospitalId);

    const name = dto.name.trim();

    const existing = await this.prisma.department.findFirst({
      where: {
        hospitalId,
        name,
      },
    });

    if (existing) {
      throw new ConflictException("A department with this name already exists");
    }

    return this.prisma.department.create({
      data: {
        hospitalId,
        name,
        description: dto.description?.trim(),
      },
    });
  }

  async findAll(userId: string, hospitalId: string) {
    await this.tenantAccess.requireHospitalMembership(userId, hospitalId);

    return this.prisma.department.findMany({
      where: {
        hospitalId,
        isActive: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  async findOne(userId: string, hospitalId: string, departmentId: string) {
    await this.tenantAccess.requireHospitalMembership(userId, hospitalId);

    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        hospitalId,
      },
    });

    if (!department) {
      throw new NotFoundException("Department not found");
    }

    return department;
  }

  async deactivate(userId: string, hospitalId: string, departmentId: string) {
    await this.tenantAccess.requireHospitalAdmin(userId, hospitalId);

    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        hospitalId,
      },
    });

    if (!department) {
      throw new NotFoundException("Department not found");
    }

    return this.prisma.department.update({
      where: {
        id: department.id,
      },
      data: {
        isActive: false,
      },
    });
  }
}
