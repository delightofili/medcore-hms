import type { UserRole } from "@/types/auth";
import type { Appointment, AppointmentStatus } from "@/types/appointment";

export type AppointmentAction = {
  label: string;
  next: AppointmentStatus;
  tone: "primary" | "neutral" | "danger";
};

const CLINICAL_ROLES: UserRole[] = ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR"];

// Mirrors ALLOWED_TRANSITIONS in appointments.service.ts.
// The API is still the real gatekeeper; this only decides which buttons to show.
export function actionsFor(
  appointment: Appointment,
  role: UserRole,
): AppointmentAction[] {
  const clinical = CLINICAL_ROLES.includes(role);
  const started = new Date(appointment.appointmentAt) <= new Date();

  switch (appointment.status) {
    case "SCHEDULED":
      return [
        { label: "Confirm", next: "CONFIRMED", tone: "neutral" },
        { label: "Check in", next: "CHECKED_IN", tone: "primary" },
        ...(started
          ? [{ label: "No show", next: "NO_SHOW", tone: "neutral" } as const]
          : []),
        { label: "Cancel", next: "CANCELLED", tone: "danger" },
      ];
    case "CONFIRMED":
      return [
        { label: "Check in", next: "CHECKED_IN", tone: "primary" },
        ...(started
          ? [{ label: "No show", next: "NO_SHOW", tone: "neutral" } as const]
          : []),
        { label: "Cancel", next: "CANCELLED", tone: "danger" },
      ];
    case "CHECKED_IN":
      return [
        ...(clinical
          ? [
              {
                label: "Start consultation",
                next: "IN_PROGRESS",
                tone: "primary",
              } as const,
            ]
          : []),
        { label: "Cancel", next: "CANCELLED", tone: "danger" },
      ];
    case "IN_PROGRESS":
      return clinical
        ? [{ label: "Complete", next: "COMPLETED", tone: "primary" }]
        : [];
    default:
      return [];
  }
}
