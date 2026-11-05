import { Injectable } from "@nestjs/common";
import {
  AppointmentStatus,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  PrescriptionStatus,
  RecordStatus,
  UserRole,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { TenantAccessService } from "../auth/tenant-access.service";

const {
  SUPER_ADMIN,
  HOSPITAL_ADMIN,
  DOCTOR,
  NURSE,
  RECEPTIONIST,
  PHARMACIST,
  ACCOUNTANT,
} = UserRole;

// Each section is only computed for roles that may see that data.
const SECTION_ROLES = {
  appointments: [SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE, RECEPTIONIST],
  patients: [SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE, RECEPTIONIST],
  clinical: [SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR, NURSE],
  pharmacy: [SUPER_ADMIN, HOSPITAL_ADMIN, PHARMACIST],
  billing: [SUPER_ADMIN, HOSPITAL_ADMIN, ACCOUNTANT, RECEPTIONIST],
} satisfies Record<string, UserRole[]>;

const PAYABLE: InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

const WAITING: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  private dayRange(now = new Date()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    return { start, end, monthStart };
  }

  async getSummary(actorId: string, hospitalId: string) {
    const actor = await this.tenantAccess.requireHospitalMembership(
      actorId,
      hospitalId,
    );
    const can = (section: keyof typeof SECTION_ROLES) =>
      (SECTION_ROLES[section] as UserRole[]).includes(actor.role);

    const { start, end, monthStart } = this.dayRange();
    const now = new Date();

    const hospital = await this.prisma.hospital.findUniqueOrThrow({
      where: { id: hospitalId },
      select: { name: true, currency: true },
    });

    // Doctors see their own numbers, everyone else sees the hospital's.
    const doctor =
      actor.role === DOCTOR
        ? await this.prisma.doctor.findFirst({
            where: { userId: actor.id, hospitalId, deletedAt: null },
            select: { id: true },
          })
        : null;
    const doctorScope = doctor ? { doctorId: doctor.id } : {};

    const [appointments, patients, clinical, pharmacy, billing] =
      await Promise.all([
        can("appointments")
          ? this.appointmentStats(hospitalId, doctorScope, start, end, now)
          : null,
        can("patients") ? this.patientStats(hospitalId, monthStart) : null,
        can("clinical") ? this.clinicalStats(hospitalId, doctorScope) : null,
        can("pharmacy") ? this.pharmacyStats(hospitalId, start, end) : null,
        can("billing")
          ? this.billingStats(hospitalId, start, end, monthStart, now)
          : null,
      ]);

    return {
      hospital,
      role: actor.role,
      generatedAt: now.toISOString(),
      appointments,
      patients,
      clinical,
      pharmacy,
      billing,
    };
  }

  private async appointmentStats(
    hospitalId: string,
    doctorScope: { doctorId?: string },
    start: Date,
    end: Date,
    now: Date,
  ) {
    const today: Prisma.AppointmentWhereInput = {
      hospitalId,
      deletedAt: null,
      appointmentAt: { gte: start, lt: end },
      ...doctorScope,
    };

    const [byStatus, upcoming] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ["status"],
        where: today,
        _count: { _all: true },
      }),
      this.prisma.appointment.findMany({
        where: {
          ...today,
          status: { in: WAITING },
          appointmentAt: {
            gte: new Date(now.getTime() - 60 * 60_000),
            lt: end,
          },
        },
        orderBy: { appointmentAt: "asc" },
        take: 6,
        select: {
          id: true,
          appointmentAt: true,
          status: true,
          reason: true,
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              patientNumber: true,
            },
          },
          doctor: { select: { user: { select: { lastName: true } } } },
        },
      }),
    ]);

    const counts = Object.fromEntries(
      Object.values(AppointmentStatus).map((status) => [status, 0]),
    ) as Record<AppointmentStatus, number>;
    for (const row of byStatus) counts[row.status] = row._count._all;

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);

    return {
      today: total,
      waiting: counts.CHECKED_IN,
      inProgress: counts.IN_PROGRESS,
      completed: counts.COMPLETED,
      cancelled: counts.CANCELLED + counts.NO_SHOW,
      byStatus: counts,
      upcoming,
    };
  }

  private async patientStats(hospitalId: string, monthStart: Date) {
    const [total, newThisMonth] = await Promise.all([
      this.prisma.patient.count({ where: { hospitalId, deletedAt: null } }),
      this.prisma.patient.count({
        where: { hospitalId, deletedAt: null, createdAt: { gte: monthStart } },
      }),
    ]);
    return { total, newThisMonth };
  }

  private async clinicalStats(
    hospitalId: string,
    doctorScope: { doctorId?: string },
  ) {
    const [draftRecords, signedRecords] = await Promise.all([
      this.prisma.medicalRecord.count({
        where: { hospitalId, status: RecordStatus.DRAFT, ...doctorScope },
      }),
      this.prisma.medicalRecord.count({
        where: { hospitalId, status: RecordStatus.SIGNED, ...doctorScope },
      }),
    ]);
    return { draftRecords, signedRecords };
  }

  private async pharmacyStats(hospitalId: string, start: Date, end: Date) {
    const [awaitingDispense, dispensedToday] = await Promise.all([
      this.prisma.prescription.count({
        where: { hospitalId, status: PrescriptionStatus.ISSUED },
      }),
      this.prisma.prescription.count({
        where: {
          hospitalId,
          status: PrescriptionStatus.DISPENSED,
          updatedAt: { gte: start, lt: end },
        },
      }),
    ]);
    return { awaitingDispense, dispensedToday };
  }

  private async billingStats(
    hospitalId: string,
    start: Date,
    end: Date,
    monthStart: Date,
    now: Date,
  ) {
    const succeeded = {
      status: PaymentStatus.SUCCEEDED,
      invoice: { hospitalId },
    };

    const [today, month, billed, paidOnOpen, unpaidCount, overdueCount] =
      await Promise.all([
        this.prisma.payment.aggregate({
          where: { ...succeeded, paidAt: { gte: start, lt: end } },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: { ...succeeded, paidAt: { gte: monthStart, lt: end } },
          _sum: { amount: true },
        }),
        this.prisma.invoice.aggregate({
          where: { hospitalId, status: { in: PAYABLE } },
          _sum: { totalAmount: true },
        }),
        this.prisma.payment.aggregate({
          where: {
            status: PaymentStatus.SUCCEEDED,
            invoice: { hospitalId, status: { in: PAYABLE } },
          },
          _sum: { amount: true },
        }),
        this.prisma.invoice.count({
          where: { hospitalId, status: { in: PAYABLE } },
        }),
        this.prisma.invoice.count({
          where: { hospitalId, status: { in: PAYABLE }, dueDate: { lt: now } },
        }),
      ]);

    const zero = new Prisma.Decimal(0);
    // Outstanding = everything billed on open invoices minus what has been paid on them.
    const outstanding = (billed._sum.totalAmount ?? zero).sub(
      paidOnOpen._sum.amount ?? zero,
    );

    return {
      revenueToday: (today._sum.amount ?? zero).toFixed(2),
      revenueThisMonth: (month._sum.amount ?? zero).toFixed(2),
      outstanding: outstanding.toFixed(2),
      unpaidInvoices: unpaidCount,
      overdueInvoices: overdueCount,
    };
  }
}
