import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AppointmentStatus, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import {
  TenantAccessService,
  TenantPrincipal,
} from "../auth/tenant-access.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { ListAppointmentsDto } from "./dto/list-appointments.dto";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment-status.dto";

const APPOINTMENT_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.RECEPTIONIST,
  UserRole.NURSE,
  UserRole.DOCTOR,
]);

const CLINICAL_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.DOCTOR,
]);

const BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
];

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

const MAX_SLOT_MINUTES = 240;

const appointmentInclude = {
  patient: {
    select: {
      id: true,
      patientNumber: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
  doctor: {
    select: {
      id: true,
      specialization: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  department: { select: { id: true, name: true } },
} satisfies Prisma.AppointmentInclude;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  private async authorize(actorId: string, hospitalId: string) {
    const actor = await this.tenantAccess.requireHospitalMembership(
      actorId,
      hospitalId,
    );

    if (!APPOINTMENT_ROLES.has(actor.role)) {
      throw new ForbiddenException(
        "Your role does not have permission to manage appointments",
      );
    }

    return actor;
  }

  private toMinutes(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  private overlaps(
    startA: Date,
    endA: Date,
    startB: Date,
    durationMinutesB: number,
  ) {
    const endB = new Date(startB.getTime() + durationMinutesB * 60_000);
    return startA < endB && endA > startB;
  }

  async create(actorId: string, hospitalId: string, dto: CreateAppointmentDto) {
    const actor = await this.authorize(actorId, hospitalId);

    const appointmentAt = new Date(dto.appointmentAt);

    if (!Number.isFinite(appointmentAt.getTime())) {
      throw new BadRequestException("Invalid appointment time");
    }

    if (appointmentAt <= new Date()) {
      throw new BadRequestException("Appointments must be in the future");
    }

    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, hospitalId, deletedAt: null },
      select: { id: true },
    });

    if (!patient) throw new NotFoundException("Patient not found");

    const doctor = await this.prisma.doctor.findFirst({
      where: {
        id: dto.doctorId,
        hospitalId,
        deletedAt: null,
        user: { deletedAt: null, status: "ACTIVE" },
      },
      include: {
        availability: {
          where: { isActive: true, dayOfWeek: appointmentAt.getDay() },
        },
      },
    });

    if (!doctor) throw new NotFoundException("Doctor not found");

    if (!doctor.isAvailable) {
      throw new BadRequestException("This doctor is not taking appointments");
    }

    if (actor.role === UserRole.DOCTOR && doctor.userId !== actor.id) {
      throw new ForbiddenException(
        "Doctors can only book appointments for themselves",
      );
    }

    // The requested time must land exactly on a slot inside a working window.
    const minuteOfDay =
      appointmentAt.getHours() * 60 + appointmentAt.getMinutes();

    const schedule = doctor.availability.find((item) => {
      const start = this.toMinutes(item.startTime);
      const end = this.toMinutes(item.endTime);

      return (
        minuteOfDay >= start &&
        minuteOfDay + item.slotMinutes <= end &&
        (minuteOfDay - start) % item.slotMinutes === 0 &&
        appointmentAt.getSeconds() === 0
      );
    });

    if (!schedule) {
      throw new BadRequestException(
        "The selected time is not an available slot for this doctor",
      );
    }

    const durationMinutes = schedule.slotMinutes;
    const endsAt = new Date(appointmentAt.getTime() + durationMinutes * 60_000);
    const searchFrom = new Date(
      appointmentAt.getTime() - MAX_SLOT_MINUTES * 60_000,
    );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const unavailable = await tx.doctorUnavailablePeriod.findFirst({
            where: {
              doctorId: doctor.id,
              startsAt: { lt: endsAt },
              endsAt: { gt: appointmentAt },
            },
            select: { id: true },
          });

          if (unavailable) {
            throw new ConflictException(
              "The doctor is unavailable at the selected time",
            );
          }

          const nearby = await tx.appointment.findMany({
            where: {
              hospitalId,
              deletedAt: null,
              status: { in: BLOCKING_STATUSES },
              appointmentAt: { gte: searchFrom, lt: endsAt },
              OR: [{ doctorId: doctor.id }, { patientId: patient.id }],
            },
            select: {
              doctorId: true,
              appointmentAt: true,
              durationMinutes: true,
            },
          });

          for (const existing of nearby) {
            if (
              this.overlaps(
                appointmentAt,
                endsAt,
                existing.appointmentAt,
                existing.durationMinutes,
              )
            ) {
              throw new ConflictException(
                existing.doctorId === doctor.id
                  ? "This slot has already been booked"
                  : "The patient already has an appointment at this time",
              );
            }
          }

          return tx.appointment.create({
            data: {
              hospitalId,
              patientId: patient.id,
              doctorId: doctor.id,
              departmentId: doctor.departmentId,
              createdById: actor.id,
              appointmentAt,
              durationMinutes,
              type: dto.type,
              reason: dto.reason?.trim(),
              notes: dto.notes?.trim(),
            },
            include: appointmentInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // P2034: two bookings raced for the same slot and Postgres rejected one.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new ConflictException(
          "This slot was just booked by someone else. Please pick another time.",
        );
      }
      throw error;
    }
  }

  async findAll(
    actorId: string,
    hospitalId: string,
    query: ListAppointmentsDto,
  ) {
    const actor = await this.authorize(actorId, hospitalId);

    const page = query.page || 1;
    const limit = query.limit || 20;

    let dateFilter: Prisma.DateTimeFilter | undefined;

    if (query.date) {
      const dayStart = new Date(`${query.date.slice(0, 10)}T00:00:00`);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      dateFilter = { gte: dayStart, lt: dayEnd };
    }

    const where: Prisma.AppointmentWhereInput = {
      hospitalId,
      deletedAt: null,
      ...(dateFilter && { appointmentAt: dateFilter }),
      ...(query.doctorId && { doctorId: query.doctorId }),
      ...(query.patientId && { patientId: query.patientId }),
      ...(query.status && { status: query.status }),
      // Doctors only ever see their own schedule.
      ...(actor.role === UserRole.DOCTOR && { doctor: { userId: actor.id } }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: { appointmentAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  private async getScoped(
    actor: TenantPrincipal,
    hospitalId: string,
    appointmentId: string,
  ) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, hospitalId, deletedAt: null },
      include: {
        ...appointmentInclude,
        doctor: {
          select: { ...appointmentInclude.doctor.select, userId: true },
        },
      },
    });

    if (!appointment) throw new NotFoundException("Appointment not found");

    if (
      actor.role === UserRole.DOCTOR &&
      appointment.doctor.userId !== actor.id
    ) {
      throw new NotFoundException("Appointment not found");
    }

    return appointment;
  }

  async findOne(actorId: string, hospitalId: string, appointmentId: string) {
    const actor = await this.authorize(actorId, hospitalId);
    return this.getScoped(actor, hospitalId, appointmentId);
  }

  async updateStatus(
    actorId: string,
    hospitalId: string,
    appointmentId: string,
    dto: UpdateAppointmentStatusDto,
  ) {
    const actor = await this.authorize(actorId, hospitalId);
    const appointment = await this.getScoped(actor, hospitalId, appointmentId);

    const current = appointment.status;
    const next = dto.status;

    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
      throw new BadRequestException(
        `Cannot change an appointment from ${current} to ${next}`,
      );
    }

    if (
      (next === AppointmentStatus.IN_PROGRESS ||
        next === AppointmentStatus.COMPLETED) &&
      !CLINICAL_ROLES.has(actor.role)
    ) {
      throw new ForbiddenException(
        "Only the doctor can start or complete a consultation",
      );
    }

    if (
      next === AppointmentStatus.CANCELLED &&
      !dto.cancellationReason?.trim()
    ) {
      throw new BadRequestException("A cancellation reason is required");
    }

    if (
      next === AppointmentStatus.NO_SHOW &&
      appointment.appointmentAt > new Date()
    ) {
      throw new BadRequestException(
        "An appointment can only be marked as no show after its start time",
      );
    }

    const now = new Date();

    // Matching on the current status stops two people changing it at once.
    const result = await this.prisma.appointment.updateMany({
      where: { id: appointment.id, status: current },
      data: {
        status: next,
        ...(next === AppointmentStatus.CHECKED_IN && { checkedInAt: now }),
        ...(next === AppointmentStatus.COMPLETED && { completedAt: now }),
        ...(next === AppointmentStatus.CANCELLED && {
          cancellationReason: dto.cancellationReason!.trim(),
        }),
      },
    });

    if (result.count === 0) {
      throw new ConflictException(
        "This appointment was updated by someone else. Refresh and try again.",
      );
    }

    return this.getScoped(actor, hospitalId, appointment.id);
  }
}
