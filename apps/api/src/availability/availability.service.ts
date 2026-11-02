import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AppointmentStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { TenantAccessService } from "../auth/tenant-access.service";
import { SetAvailabilityDto } from "./dto/set-availability.dto";
import { CreateUnavailablePeriodDto } from "./dto/create-unavailable-period.dto";

const MANAGE_SCHEDULE_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.DOCTOR,
]);

const BOOKING_BLOCKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
];

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  private async getDoctor(
    actorId: string,
    hospitalId: string,
    doctorId: string,
  ) {
    const actor = await this.tenantAccess.requireHospitalMembership(
      actorId,
      hospitalId,
    );

    if (!MANAGE_SCHEDULE_ROLES.has(actor.role)) {
      throw new ForbiddenException("You cannot manage doctor availability");
    }

    const doctor = await this.prisma.doctor.findFirst({
      where: {
        id: doctorId,
        hospitalId,
        deletedAt: null,
        user: { deletedAt: null },
      },
      include: { user: { select: { id: true } } },
    });

    if (!doctor) throw new NotFoundException("Doctor not found");

    if (actor.role === UserRole.DOCTOR && doctor.userId !== actor.id) {
      throw new ForbiddenException(
        "Doctors can only manage their own availability",
      );
    }

    return doctor;
  }

  async setWeeklyAvailability(
    actorId: string,
    hospitalId: string,
    doctorId: string,
    dto: SetAvailabilityDto,
  ) {
    const doctor = await this.getDoctor(actorId, hospitalId, doctorId);

    for (const item of dto.schedules) {
      if (item.startTime >= item.endTime) {
        throw new BadRequestException(
          "Schedule end time must be later than start time",
        );
      }
    }

    const grouped = new Map<number, typeof dto.schedules>();

    for (const item of dto.schedules) {
      const entries = grouped.get(item.dayOfWeek) ?? [];
      entries.push(item);
      grouped.set(item.dayOfWeek, entries);
    }

    for (const entries of grouped.values()) {
      entries.sort((a, b) => a.startTime.localeCompare(b.startTime));

      for (let i = 1; i < entries.length; i++) {
        if (entries[i].startTime < entries[i - 1].endTime) {
          throw new BadRequestException(
            "Weekly availability periods cannot overlap",
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.doctorAvailability.deleteMany({
        where: { doctorId: doctor.id },
      });

      await tx.doctorAvailability.createMany({
        data: dto.schedules.map((item) => ({
          doctorId: doctor.id,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime,
          endTime: item.endTime,
          slotMinutes: item.slotMinutes,
          isActive: item.isActive ?? true,
        })),
      });
    });

    return {
      message: "Doctor availability updated",
      schedules: await this.prisma.doctorAvailability.findMany({
        where: { doctorId: doctor.id },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
    };
  }

  async getWeeklyAvailability(
    actorId: string,
    hospitalId: string,
    doctorId: string,
  ) {
    const doctor = await this.getDoctor(actorId, hospitalId, doctorId);

    return this.prisma.doctorAvailability.findMany({
      where: { doctorId: doctor.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
  }

  async addUnavailablePeriod(
    actorId: string,
    hospitalId: string,
    doctorId: string,
    dto: CreateUnavailablePeriodDto,
  ) {
    const doctor = await this.getDoctor(actorId, hospitalId, doctorId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);

    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      startsAt >= endsAt
    ) {
      throw new BadRequestException(
        "Unavailable period end must be after its start",
      );
    }

    if (startsAt <= new Date()) {
      throw new BadRequestException(
        "Unavailable periods must start in the future",
      );
    }

    const overlap = await this.prisma.doctorUnavailablePeriod.findFirst({
      where: {
        doctorId: doctor.id,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });

    if (overlap) {
      throw new ConflictException(
        "This period overlaps an existing unavailable period",
      );
    }

    return this.prisma.doctorUnavailablePeriod.create({
      data: {
        doctorId: doctor.id,
        startsAt,
        endsAt,
        reason: dto.reason?.trim(),
      },
    });
  }

  async getSlots(
    actorId: string,
    hospitalId: string,
    doctorId: string,
    dateValue: string,
  ) {
    const doctor = await this.getDoctor(actorId, hospitalId, doctorId);

    if (!doctor.isAvailable) {
      return { date: dateValue, doctorId, slots: [] };
    }

    const date = new Date(`${dateValue}T00:00:00`);

    if (!Number.isFinite(date.getTime())) {
      throw new BadRequestException("Invalid date");
    }

    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayOfWeek = date.getDay();

    const schedules = await this.prisma.doctorAvailability.findMany({
      where: {
        doctorId: doctor.id,
        dayOfWeek,
        isActive: true,
      },
      orderBy: { startTime: "asc" },
    });

    const [appointments, unavailable] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          hospitalId,
          doctorId: doctor.id,
          deletedAt: null,
          status: { in: BOOKING_BLOCKING_STATUSES },
          appointmentAt: { lt: dayEnd },
        },
        select: {
          appointmentAt: true,
          durationMinutes: true,
        },
      }),
      this.prisma.doctorUnavailablePeriod.findMany({
        where: {
          doctorId: doctor.id,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
        },
      }),
    ]);

    const now = new Date();
    const slots: Array<{
      startsAt: string;
      endsAt: string;
      durationMinutes: number;
    }> = [];

    for (const schedule of schedules) {
      const [startHour, startMinute] = schedule.startTime
        .split(":")
        .map(Number);
      const [endHour, endMinute] = schedule.endTime.split(":").map(Number);

      const start = new Date(date);
      start.setHours(startHour, startMinute, 0, 0);

      const end = new Date(date);
      end.setHours(endHour, endMinute, 0, 0);

      for (
        let cursor = new Date(start);
        cursor.getTime() + schedule.slotMinutes * 60_000 <= end.getTime();
        cursor = new Date(cursor.getTime() + schedule.slotMinutes * 60_000)
      ) {
        const slotEnd = new Date(
          cursor.getTime() + schedule.slotMinutes * 60_000,
        );

        if (cursor <= now) continue;

        const overlapsAppointment = appointments.some((appointment) => {
          const appointmentStart = appointment.appointmentAt;
          const appointmentEnd = new Date(
            appointmentStart.getTime() + appointment.durationMinutes * 60_000,
          );

          return cursor < appointmentEnd && slotEnd > appointmentStart;
        });

        const overlapsUnavailable = unavailable.some(
          (period) => cursor < period.endsAt && slotEnd > period.startsAt,
        );

        if (!overlapsAppointment && !overlapsUnavailable) {
          slots.push({
            startsAt: cursor.toISOString(),
            endsAt: slotEnd.toISOString(),
            durationMinutes: schedule.slotMinutes,
          });
        }
      }
    }

    return {
      date: dateValue,
      doctorId,
      timezoneNote:
        "Slots are calculated using the API server's local timezone. Configure the hospital timezone before production scheduling.",
      slots,
    };
  }
}
