"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  PatientForm,
  type PatientFormValues,
} from "@/components/patients/patient-form";
import { EmptyState } from "@/components/ui/feedback";
import { stripEmpty } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Patient } from "@/types/patient";

export default function NewPatientPage() {
  const router = useRouter();
  const { user, authRequest } = useAuth();

  if (!user?.hospitalId) {
    return (
      <EmptyState
        title="No hospital selected"
        message="Sign in with a hospital staff account."
      />
    );
  }

  const hospitalId = user.hospitalId;

  async function handleSubmit(values: PatientFormValues) {
    const patient = await authRequest<Patient>(
      `/hospitals/${hospitalId}/patients`,
      {
        method: "POST",
        body: stripEmpty(values),
      },
    );
    router.push(`/dashboard/patients/${patient.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/patients"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to patients
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Register patient
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          A patient number is generated automatically.
        </p>
      </div>

      <PatientForm submitLabel="Register patient" onSubmit={handleSubmit} />
    </div>
  );
}
