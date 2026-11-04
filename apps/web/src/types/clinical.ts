export type RecordStatus = "DRAFT" | "SIGNED" | "AMENDED";
export type PrescriptionStatus = "DRAFT" | "ISSUED" | "DISPENSED" | "CANCELLED";
export type MedicineForm =
  | "TABLET"
  | "CAPSULE"
  | "SYRUP"
  | "SUSPENSION"
  | "INJECTION"
  | "CREAM"
  | "OINTMENT"
  | "DROPS"
  | "INHALER"
  | "POWDER"
  | "OTHER";

export type PrescriptionItem = {
  id: string;
  medicineName: string;
  form: MedicineForm | null;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string | null;
};

export type Prescription = {
  id: string;
  medicalRecordId: string | null;
  status: PrescriptionStatus;
  instructions: string | null;
  issuedAt: string | null;
  createdAt: string;
  items: PrescriptionItem[];
  doctor?: {
    id: string;
    userId: string;
    user: { firstName: string; lastName: string };
  };
};

// Decimal columns (temperature, weight, height) arrive from the API as strings.
export type MedicalRecord = {
  id: string;
  status: RecordStatus;
  appointmentId: string | null;
  chiefComplaint: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  treatmentPlan: string | null;
  notes: string | null;
  temperatureC: string | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  pulseBpm: number | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  weightKg: string | null;
  heightCm: string | null;
  signedAt: string | null;
  createdAt: string;
  patient: {
    id: string;
    patientNumber: string;
    firstName: string;
    lastName: string;
  };
  doctor: {
    id: string;
    specialization: string | null;
    user: { firstName: string; lastName: string };
  };
  prescriptions?: Prescription[];
};
