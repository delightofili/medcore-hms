import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AppointmentStatus,
  Prisma,
  RecordStatus,
  UserRole,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { ClinicalAccessService } from "./clinical-access.service";
import { CreateMedicalRecordDto } from "./dto/create-medical-record.dto";
import { UpdateMedicalRecordDto } from "./dto/update-medical-record.dto";
import { ListMedicalRecordsDto } from "./dto/list-clinical.dto";

const VIEW_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.DOCTOR,
  UserRole.NURSE,
]);

const RECORDABLE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
];

const summaryInclude = {
  patient: {
    select: { id: true, patientNumber: true, firstName: true, lastName: true },
  },
  doctor: {
    select: {
      id: true,
      specialization: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.MedicalRecordInclude;

const detailInclude = {
  ...summaryInclude,
  appointment: {
    select: { id: true, appointmentAt: true, reason: true, status: true },
  },
  prescriptions: {
    include: { items: true },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.MedicalRecordInclude;

@Injectable()
export class MedicalRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClinicalAccessService,
  ) {}

  // Undefined values are skipped by Prisma, so this works for create and update.
  private toData(dto: UpdateMedicalRecordDto) {
    const text = (value?: string) =>
      value === undefined ? undefined : value.trim() || null;

    return {
      chiefComplaint: text(dto.chiefComplaint),
      symptoms: text(dto.symptoms),
      diagnosis: text(dto.diagnosis),
      treatmentPlan: text(dto.treatmentPlan),
      notes: text(dto.notes),
      temperatureC: dto.temperatureC,
      bloodPressureSystolic: dto.bloodPressureSystolic,
      bloodPressureDiastolic: dto.bloodPressureDiastolic,
      pulseBpm: dto.pulseBpm,
      respiratoryRate: dto.respiratoryRate,
      oxygenSaturation: dto.oxygenSaturation,
      weightKg: dto.weightKg,
      heightCm: dto.heightCm,
    };
  }

  async create(
    actorId: string,
    hospitalId: string,
    dto: CreateMedicalRecordDto,
  ) {
    const { actor, doctorId } = await this.access.requireDoctor(
      actorId,
      hospitalId,
    );

    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, hospitalId, deletedAt: null },
      select: { id: true },
    });

    if (!patient) throw new NotFoundException("Patient not found");

    if (dto.appointmentId) {
      const appointment = await this.prisma.appointment.findFirst({
        where: { id: dto.appointmentId, hospitalId, deletedAt: null },
        select: {
          patientId: true,
          doctorId: true,
          status: true,
          medicalRecord: { select: { id: true } },
        },
      });

      if (!appointment) throw new NotFoundException("Appointment not found");

      if (appointment.patientId !== patient.id) {
        throw new BadRequestException(
          "This appointment belongs to a different patient",
        );
      }

      if (appointment.doctorId !== doctorId) {
        throw new ForbiddenException(
          "You can only write records for your own appointments",
        );
      }

      if (!RECORDABLE_APPOINTMENT_STATUSES.includes(appointment.status)) {
        throw new BadRequestException(
          "Start the consultation before writing its record",
        );
      }

      if (appointment.medicalRecord) {
        throw new ConflictException(
          "This appointment already has a medical record",
        );
      }
    }

    try {
      return await this.prisma.medicalRecord.create({
        data: {
          hospitalId,
          patientId: patient.id,
          doctorId,
          appointmentId: dto.appointmentId,
          authorId: actor.id,
          ...this.toData(dto),
        },
        include: detailInclude,
      });
    } catch (error) {
      // appointmentId is unique: a second record for the same visit lands here.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "This appointment already has a medical record",
        );
      }
      throw error;
    }
  }

  async findAll(
    actorId: string,
    hospitalId: string,
    query: ListMedicalRecordsDto,
  ) {
    await this.access.requireRole(
      actorId,
      hospitalId,
      VIEW_ROLES,
      "Your role cannot view medical records",
    );

    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: Prisma.MedicalRecordWhereInput = {
      hospitalId,
      ...(query.patientId && { patientId: query.patientId }),
      ...(query.status && { status: query.status }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.medicalRecord.findMany({
        where,
        include: summaryInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.medicalRecord.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(actorId: string, hospitalId: string, recordId: string) {
    await this.access.requireRole(
      actorId,
      hospitalId,
      VIEW_ROLES,
      "Your role cannot view medical records",
    );

    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId, hospitalId },
      include: detailInclude,
    });

    if (!record) throw new NotFoundException("Medical record not found");

    return record;
  }

  private async getOwnDraft(
    actorId: string,
    hospitalId: string,
    recordId: string,
  ) {
    const { doctorId } = await this.access.requireDoctor(actorId, hospitalId);

    const record = await this.prisma.medicalRecord.findFirst({
      where: { id: recordId, hospitalId },
      select: { id: true, doctorId: true, status: true, diagnosis: true },
    });

    if (!record) throw new NotFoundException("Medical record not found");

    if (record.doctorId !== doctorId) {
      throw new ForbiddenException("You can only change your own records");
    }

    if (record.status !== RecordStatus.DRAFT) {
      throw new BadRequestException("Signed records cannot be edited");
    }

    return record;
  }

  async update(
    actorId: string,
    hospitalId: string,
    recordId: string,
    dto: UpdateMedicalRecordDto,
  ) {
    const record = await this.getOwnDraft(actorId, hospitalId, recordId);

    const result = await this.prisma.medicalRecord.updateMany({
      where: { id: record.id, status: RecordStatus.DRAFT },
      data: this.toData(dto),
    });

    if (result.count === 0) {
      throw new ConflictException(
        "This record was signed while you were editing",
      );
    }

    return this.findOne(actorId, hospitalId, record.id);
  }

  async sign(actorId: string, hospitalId: string, recordId: string) {
    const record = await this.getOwnDraft(actorId, hospitalId, recordId);

    if (!record.diagnosis?.trim()) {
      throw new BadRequestException(
        "Add a diagnosis before signing the record",
      );
    }

    const result = await this.prisma.medicalRecord.updateMany({
      where: { id: record.id, status: RecordStatus.DRAFT },
      data: { status: RecordStatus.SIGNED, signedAt: new Date() },
    });

    if (result.count === 0) {
      throw new ConflictException("This record has already been signed");
    }

    return this.findOne(actorId, hospitalId, record.id);
  }
}
