"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import {
  PatientForm,
  type PatientFormValues,
} from "@/components/patients/patient-form";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { stripEmpty } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Patient } from "@/types/patient";

export default function EditPatientPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hospitalId) return;
    authRequest<Patient>(`/hospitals/${hospitalId}/patients/${patientId}`)
      .then(setPatient)
      .catch((err: Error) => setError(err.message));
  }, [hospitalId, patientId, authRequest]);

  async function handleSubmit(values: PatientFormValues) {
    await authRequest(`/hospitals/${hospitalId}/patients/${patientId}`, {
      method: "PATCH",
      body: stripEmpty(values),
    });
    router.push(`/dashboard/patients/${patientId}`);
  }

  if (error)
    return <ErrorState title="Could not load patient" message={error} />;
  if (!patient) return <LoadingState message="Loading patient..." />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/dashboard/patients/${patientId}`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to patient
      </Link>

      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Edit {patient.firstName} {patient.lastName}
      </h2>

      <PatientForm
        initialPatient={patient}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
