export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type AppointmentType =
  | "CONSULTATION"
  | "FOLLOW_UP"
  | "EMERGENCY"
  | "TELECONSULTATION";

export type Appointment = {
  id: string;
  appointmentAt: string;
  durationMinutes: number;
  type: AppointmentType;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  cancellationReason: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  patient: {
    id: string;
    patientNumber: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  doctor: {
    id: string;
    specialization: string | null;
    user: { firstName: string; lastName: string };
  };
  department: { id: string; name: string } | null;
};

export type Doctor = {
  id: string;
  specialization: string | null;
  consultationFee: string;
  isAvailable: boolean;
  user: { id: string; firstName: string; lastName: string };
  department: { id: string; name: string } | null;
};

export type Slot = {
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
};

export type SlotsResponse = {
  date: string;
  doctorId: string;
  slots: Slot[];
};
