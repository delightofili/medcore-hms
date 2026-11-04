// One list drives the form inputs, the client checks and the summary display.
// Ranges match VitalsDto on the API.
export const VITALS = [
  {
    key: "temperatureC",
    label: "Temperature",
    unit: "°C",
    min: 30,
    max: 45,
    step: "0.1",
  },
  {
    key: "bloodPressureSystolic",
    label: "BP systolic",
    unit: "mmHg",
    min: 50,
    max: 260,
    step: "1",
  },
  {
    key: "bloodPressureDiastolic",
    label: "BP diastolic",
    unit: "mmHg",
    min: 30,
    max: 160,
    step: "1",
  },
  {
    key: "pulseBpm",
    label: "Pulse",
    unit: "bpm",
    min: 20,
    max: 250,
    step: "1",
  },
  {
    key: "respiratoryRate",
    label: "Resp. rate",
    unit: "/min",
    min: 5,
    max: 80,
    step: "1",
  },
  {
    key: "oxygenSaturation",
    label: "SpO₂",
    unit: "%",
    min: 50,
    max: 100,
    step: "1",
  },
  {
    key: "weightKg",
    label: "Weight",
    unit: "kg",
    min: 0.5,
    max: 500,
    step: "0.1",
  },
  {
    key: "heightCm",
    label: "Height",
    unit: "cm",
    min: 20,
    max: 260,
    step: "0.1",
  },
] as const;

export type VitalKey = (typeof VITALS)[number]["key"];

export const TEXT_FIELDS = [
  {
    key: "chiefComplaint",
    label: "Chief complaint",
    rows: 2,
    placeholder: "Main reason in the patient's words",
  },
  {
    key: "symptoms",
    label: "Symptoms and history",
    rows: 3,
    placeholder: "Onset, duration, severity",
  },
  {
    key: "diagnosis",
    label: "Diagnosis",
    rows: 2,
    placeholder: "Required before signing",
  },
  {
    key: "treatmentPlan",
    label: "Treatment plan",
    rows: 3,
    placeholder: "Medicines, advice, follow up",
  },
  { key: "notes", label: "Additional notes", rows: 2, placeholder: "Optional" },
] as const;

export type TextKey = (typeof TEXT_FIELDS)[number]["key"];
