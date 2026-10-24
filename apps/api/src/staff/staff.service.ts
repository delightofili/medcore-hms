import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AccountStatus, UserRole } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import { PrismaService } from "../database/prisma.service";
import { TenantAccessService } from "../auth/tenant-access.service";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { assertCanCreateStaffRole } from "./staff-role-policy";

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  async create(actorId: string, hospitalId: string, dto: CreateStaffDto) {
    const actor = await this.tenantAccess.requireHospitalAdmin(
      actorId,
      hospitalId,
    );

    assertCanCreateStaffRole(actor.role, dto.role);

    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: dto.departmentId,
          hospitalId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!department) {
        throw new NotFoundException("Department not found in this hospital");
      }
    }

    /*
     * This creates a random temporary password hash.
     * It does not expose the password to the administrator.
     *
     * A real invitation flow should deliver a one-time setup link
     * and require the staff member to choose a password.
     */
    const temporarySecret = randomBytes(48).toString("hex");

    const passwordHash = createHash("sha256")
      .update(temporarySecret)
      .digest("hex");

    const user = await this.prisma.user.create({
      data: {
        hospitalId,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        phone: dto.phone?.trim(),
        passwordHash,
        role: dto.role,
        status: AccountStatus.PENDING,
      },
      select: {
        id: true,
        hospitalId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    /*
     * Doctor profile creation is intentionally not performed here.
     * Your Doctor model's required fields must be mapped explicitly
     * before creating the profile.
     */
    return {
      message: "Staff account created successfully",
      user,
      invitationRequired: true,
    };
  }

  async findAll(actorId: string, hospitalId: string) {
    await this.tenantAccess.requireHospitalMembership(actorId, hospitalId);

    return this.prisma.user.findMany({
      where: {
        hospitalId,
        deletedAt: null,
        role: {
          in: [
            UserRole.DOCTOR,
            UserRole.NURSE,
            UserRole.RECEPTIONIST,
            UserRole.LAB_TECHNICIAN,
            UserRole.PHARMACIST,
            UserRole.ACCOUNTANT,
            UserRole.HOSPITAL_ADMIN,
          ],
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        lastName: "asc",
      },
    });
  }
}
