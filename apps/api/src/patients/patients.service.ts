import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { TenantAccessService } from "../auth/tenant-access.service";
import { CreatePatientDto } from "./dto/create-patient.dto";
import { UpdatePatientDto } from "./dto/update-patient.dto";
import { SearchPatientsDto } from "./dto/search-patients.dto";
import { randomBytes } from "crypto";

const PATIENT_MANAGEMENT_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.RECEPTIONIST,
  UserRole.DOCTOR,
  UserRole.NURSE,
]);

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  private async authorize(actorId: string, hospitalId: string) {
    const actor = await this.tenantAccess.requireHospitalMembership(
      actorId,
      hospitalId,
    );

    if (!PATIENT_MANAGEMENT_ROLES.has(actor.role)) {
      throw new ForbiddenException(
        "Your role does not have permission to manage patient records",
      );
    }

    return actor;
  }

  private normalizeEmail(email?: string) {
    return email?.trim().toLowerCase() || undefined;
  }

  private normalizePhone(phone?: string) {
    return phone?.trim().replace(/\s+/g, "") || undefined;
  }

  private async ensureNoDuplicate(
    hospitalId: string,
    data: { email?: string; phone?: string },
    excludePatientId?: string,
  ) {
    const email = this.normalizeEmail(data.email);
    const phone = this.normalizePhone(data.phone);

    if (!email && !phone) return;

    const existing = await this.prisma.patient.findFirst({
      where: {
        hospitalId,
        deletedAt: null,
        ...(excludePatientId ? { id: { not: excludePatientId } } : {}),
        OR: [
          ...(email
            ? [{ email: { equals: email, mode: "insensitive" as const } }]
            : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      select: {
        id: true,
        patientNumber: true,
        firstName: true,
        lastName: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        `A patient with this email or phone already exists (patient ${existing.patientNumber})`,
      );
    }
  }

  private generatePatientNumber() {
    const suffix = randomBytes(4).toString("hex").toUpperCase();
    return `MC-${Date.now().toString().slice(-8)}-${suffix}`;
  }

  async create(actorId: string, hospitalId: string, dto: CreatePatientDto) {
    await this.authorize(actorId, hospitalId);

    await this.ensureNoDuplicate(hospitalId, dto);

    if (dto.userId) {
      const linkedUser = await this.prisma.user.findFirst({
        where: {
          id: dto.userId,
          deletedAt: null,
          hospitalId,
        },
        select: { id: true, role: true },
      });

      if (!linkedUser || linkedUser.role !== UserRole.PATIENT) {
        throw new ForbiddenException(
          "The linked account must be a patient account in this hospital",
        );
      }

      const existingProfile = await this.prisma.patient.findUnique({
        where: { userId: dto.userId },
        select: { id: true },
      });

      if (existingProfile) {
        throw new ConflictException(
          "This patient account already has a patient profile",
        );
      }
    }

    const patientNumber = this.generatePatientNumber();

    try {
      return await this.prisma.patient.create({
        data: {
          hospitalId,
          patientNumber,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          dateOfBirth: this.validateDateOfBirth(dto.dateOfBirth),
          gender: dto.gender,
          bloodGroup: dto.bloodGroup?.trim(),
          email: this.normalizeEmail(dto.email),
          phone: this.normalizePhone(dto.phone),
          emergencyContactName: dto.emergencyContactName?.trim(),
          emergencyContactPhone: this.normalizePhone(dto.emergencyContactPhone),
          allergies: dto.allergies?.trim(),
          medicalHistory: dto.medicalHistory?.trim(),
          addressLine1: dto.addressLine1?.trim(),
          addressLine2: dto.addressLine2?.trim(),
          city: dto.city?.trim(),
          state: dto.state?.trim(),
          postalCode: dto.postalCode?.trim(),
          country: dto.country?.trim(),
          userId: dto.userId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "A patient with these details already exists",
        );
      }
      throw error;
    }
  }

  async findAll(actorId: string, hospitalId: string, query: SearchPatientsDto) {
    await this.authorize(actorId, hospitalId);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const search = query.q?.trim();

    const where: Prisma.PatientWhereInput = {
      hospitalId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { patientNumber: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(actorId: string, hospitalId: string, patientId: string) {
    await this.authorize(actorId, hospitalId);

    const patient = await this.prisma.patient.findFirst({
      where: {
        id: patientId,
        hospitalId,
        deletedAt: null,
      },
    });

    if (!patient) throw new NotFoundException("Patient not found");

    return patient;
  }

  async update(
    actorId: string,
    hospitalId: string,
    patientId: string,
    dto: UpdatePatientDto,
  ) {
    await this.authorize(actorId, hospitalId);

    await this.findOne(actorId, hospitalId, patientId);
    await this.ensureNoDuplicate(hospitalId, dto, patientId);

    if (dto.userId) {
      const linkedUser = await this.prisma.user.findFirst({
        where: {
          id: dto.userId,
          hospitalId,
          role: UserRole.PATIENT,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!linkedUser) {
        throw new ForbiddenException(
          "The linked account must be a patient account in this hospital",
        );
      }

      const existingProfile = await this.prisma.patient.findFirst({
        where: {
          userId: dto.userId,
          id: { not: patientId },
        },
      });

      if (existingProfile) {
        throw new ConflictException(
          "This patient account is already linked to another profile",
        );
      }
    }

    return this.prisma.patient.update({
      where: { id: patientId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() }),
        ...(dto.dateOfBirth !== undefined && {
          dateOfBirth: this.validateDateOfBirth(dto.dateOfBirth) ?? null,
        }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.bloodGroup !== undefined && { bloodGroup: dto.bloodGroup }),
        ...(dto.email !== undefined && {
          email: this.normalizeEmail(dto.email) ?? null,
        }),
        ...(dto.phone !== undefined && {
          phone: this.normalizePhone(dto.phone) ?? null,
        }),
        ...(dto.emergencyContactName !== undefined && {
          emergencyContactName: dto.emergencyContactName,
        }),
        ...(dto.emergencyContactPhone !== undefined && {
          emergencyContactPhone:
            this.normalizePhone(dto.emergencyContactPhone) ?? null,
        }),
        ...(dto.allergies !== undefined && { allergies: dto.allergies }),
        ...(dto.medicalHistory !== undefined && {
          medicalHistory: dto.medicalHistory,
        }),
        ...(dto.addressLine1 !== undefined && {
          addressLine1: dto.addressLine1,
        }),
        ...(dto.addressLine2 !== undefined && {
          addressLine2: dto.addressLine2,
        }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.userId !== undefined && { userId: dto.userId }),
      },
    });
  }

  async remove(actorId: string, hospitalId: string, patientId: string) {
    await this.authorize(actorId, hospitalId);

    await this.findOne(actorId, hospitalId, patientId);

    await this.prisma.patient.update({
      where: { id: patientId },
      data: { deletedAt: new Date() },
    });

    return { message: "Patient archived successfully" };
  }

  private validateDateOfBirth(value?: string) {
    if (!value) return undefined;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Invalid date of birth");
    }

    if (date > new Date()) {
      throw new BadRequestException("Date of birth cannot be in the future");
    }

    return date;
  }
}
