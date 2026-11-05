import type { AppointmentStatus } from "./appointment";
import type { UserRole } from "./auth";

export type DashboardSummary = {
  hospital: { name: string; currency: string };
  role: UserRole;
  generatedAt: string;
  appointments: {
    today: number;
    waiting: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    byStatus: Record<AppointmentStatus, number>;
    upcoming: Array<{
      id: string;
      appointmentAt: string;
      status: AppointmentStatus;
      reason: string | null;
      patient: {
        id: string;
        firstName: string;
        lastName: string;
        patientNumber: string;
      };
      doctor: { user: { lastName: string } };
    }>;
  } | null;
  patients: { total: number; newThisMonth: number } | null;
  clinical: { draftRecords: number; signedRecords: number } | null;
  pharmacy: { awaitingDispense: number; dispensedToday: number } | null;
  billing: {
    revenueToday: string;
    revenueThisMonth: string;
    outstanding: string;
    unpaidInvoices: number;
    overdueInvoices: number;
  } | null;
};
