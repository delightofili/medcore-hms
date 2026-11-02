"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, Archive } from "lucide-react";

import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { calculateAge, formatDate, humanize } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Patient } from "@/types/patient";

const ARCHIVE_ROLES = ["SUPER_ADMIN", "HOSPITAL_ADMIN", "RECEPTIONIST"];

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "Not recorded"}</dd>
    </div>
  );
}

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    if (!hospitalId) return;
    authRequest<Patient>(`/hospitals/${hospitalId}/patients/${patientId}`)
      .then(setPatient)
      .catch((err: Error) => setError(err.message));
  }, [hospitalId, patientId, authRequest]);

  async function handleArchive() {
    if (
      !patient ||
      !window.confirm(
        `Archive ${patient.firstName} ${patient.lastName}? Their record will be hidden from the registry.`,
      )
    ) {
      return;
    }

    setIsArchiving(true);
    try {
      await authRequest(`/hospitals/${hospitalId}/patients/${patient.id}`, {
        method: "DELETE",
      });
      router.push("/dashboard/patients");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to archive patient",
      );
      setIsArchiving(false);
    }
  }

  if (error)
    return <ErrorState title="Could not load patient" message={error} />;
  if (!patient) return <LoadingState message="Loading patient..." />;

  const age = calculateAge(patient.dateOfBirth);
  const address = [
    patient.addressLine1,
    patient.city,
    patient.state,
    patient.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/dashboard/patients"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to patients
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs text-slate-500">
            {patient.patientNumber}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {patient.firstName} {patient.lastName}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {age !== null ? `${age} years` : "Age unknown"} ·{" "}
            {humanize(patient.gender)} · Blood group{" "}
            {patient.bloodGroup ?? "unknown"}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/dashboard/patients/${patient.id}/edit`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Pencil size={16} /> Edit
          </Link>
          {user && ARCHIVE_ROLES.includes(user.role) && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={isArchiving}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              <Archive size={16} /> {isArchiving ? "Archiving..." : "Archive"}
            </button>
          )}
        </div>
      </div>

      {patient.allergies && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Allergies</p>
          <p className="mt-1 text-sm text-amber-800">{patient.allergies}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900">Contact</h3>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <Detail label="Phone" value={patient.phone} />
            <Detail label="Email" value={patient.email} />
            <Detail label="Address" value={address} />
            <Detail
              label="Date of birth"
              value={formatDate(patient.dateOfBirth)}
            />
            <Detail
              label="Emergency contact"
              value={patient.emergencyContactName}
            />
            <Detail
              label="Emergency phone"
              value={patient.emergencyContactPhone}
            />
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 className="font-semibold text-slate-900">Medical history</h3>
          <p className="mt-5 whitespace-pre-line text-sm text-slate-700">
            {patient.medicalHistory || "No medical history recorded."}
          </p>
          <p className="mt-6 text-xs text-slate-400">
            Registered {formatDate(patient.createdAt)}
          </p>
        </section>
      </div>
    </div>
  );
}
