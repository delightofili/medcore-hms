import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, PrescriptionStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ClinicalAccessService } from "./clinical-access.service";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";
import { ListPrescriptionsDto } from "./dto/list-clinical.dto";
import { UpdatePrescriptionStatusDto } from "./dto/update-prescription-status.dto";

const VIEW_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.DOCTOR,
  UserRole.NURSE,
  UserRole.PHARMACIST,
]);

const DISPENSE_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.PHARMACIST,
]);

const ALLOWED_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["DISPENSED", "CANCELLED"],
  DISPENSED: [],
  CANCELLED: [],
};

const prescriptionInclude = {
  items: { orderBy: { createdAt: "asc" } },
  patient: {
    select: { id: true, patientNumber: true, firstName: true, lastName: true },
  },
  doctor: {
    select: {
      id: true,
      userId: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.PrescriptionInclude;

@Injectable()
export class PrescriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClinicalAccessService,
  ) {}

  async create(
    actorId: string,
    hospitalId: string,
    dto: CreatePrescriptionDto,
  ) {
    const { actor, doctorId } = await this.access.requireDoctor(
      actorId,
      hospitalId,
    );

    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: dto.medicalRecordId, hospitalId },
      select: { id: true, patientId: true, doctorId: true },
    });

    if (!record) throw new NotFoundException("Medical record not found");

    if (record.doctorId !== doctorId) {
      throw new ForbiddenException(
        "You can only prescribe from your own consultations",
      );
    }

    // Patient and doctor come from the record, never from the request body.
    return this.prisma.prescription.create({
      data: {
        hospitalId,
        patientId: record.patientId,
        doctorId,
        medicalRecordId: record.id,
        authorId: actor.id,
        instructions: dto.instructions?.trim() || null,
        items: {
          create: dto.items.map((item) => ({
            medicineName: item.medicineName.trim(),
            form: item.form,
            dosage: item.dosage.trim(),
            frequency: item.frequency.trim(),
            duration: item.duration.trim(),
            quantity: item.quantity,
            instructions: item.instructions?.trim() || null,
          })),
        },
      },
      include: prescriptionInclude,
    });
  }

  async findAll(
    actorId: string,
    hospitalId: string,
    query: ListPrescriptionsDto,
  ) {
    await this.access.requireRole(
      actorId,
      hospitalId,
      VIEW_ROLES,
      "Your role cannot view prescriptions",
    );

    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: Prisma.PrescriptionWhereInput = {
      hospitalId,
      ...(query.patientId && { patientId: query.patientId }),
      ...(query.status && { status: query.status }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.prescription.findMany({
        where,
        include: prescriptionInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.prescription.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(actorId: string, hospitalId: string, prescriptionId: string) {
    await this.access.requireRole(
      actorId,
      hospitalId,
      VIEW_ROLES,
      "Your role cannot view prescriptions",
    );

    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, hospitalId },
      include: prescriptionInclude,
    });

    if (!prescription) throw new NotFoundException("Prescription not found");

    return prescription;
  }

  async updateStatus(
    actorId: string,
    hospitalId: string,
    prescriptionId: string,
    dto: UpdatePrescriptionStatusDto,
  ) {
    const prescription = await this.findOne(
      actorId,
      hospitalId,
      prescriptionId,
    );
    const actor = await this.access.requireRole(
      actorId,
      hospitalId,
      VIEW_ROLES,
      "Your role cannot change prescriptions",
    );

    const current = prescription.status;
    const next = dto.status;

    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
      throw new BadRequestException(
        `Cannot change a prescription from ${current} to ${next}`,
      );
    }

    if (next === PrescriptionStatus.DISPENSED) {
      if (!DISPENSE_ROLES.has(actor.role)) {
        throw new ForbiddenException(
          "Only the pharmacy can dispense medicines",
        );
      }
    } else if (prescription.doctor.userId !== actor.id) {
      // Issuing and cancelling belong to the prescribing doctor.
      throw new ForbiddenException(
        "Only the prescribing doctor can issue or cancel this prescription",
      );
    }

    const result = await this.prisma.prescription.updateMany({
      where: { id: prescription.id, status: current },
      data: {
        status: next,
        ...(next === PrescriptionStatus.ISSUED && { issuedAt: new Date() }),
      },
    });

    if (result.count === 0) {
      throw new ConflictException(
        "This prescription was updated by someone else. Refresh and try again.",
      );
    }

    return this.findOne(actorId, hospitalId, prescription.id);
  }
}
