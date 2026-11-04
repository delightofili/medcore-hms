"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSignature,
} from "lucide-react";

import { StatusBadge } from "@/components/appointments/status-badge";
import { PrescriptionBuilder } from "@/components/clinical/prescription-builder";
import { PrescriptionCard } from "@/components/clinical/prescription-card";
import {
  RecordForm,
  toRecordPayload,
  type RecordFormValues,
} from "@/components/clinical/record-form";
import {
  RecordStatusBadge,
  RecordSummary,
} from "@/components/clinical/record-summary";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import {
  calculateAge,
  formatDate,
  formatTime,
  humanize,
  toDateInputValue,
} from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Appointment, AppointmentStatus } from "@/types/appointment";
import type { MedicalRecord, PrescriptionStatus } from "@/types/clinical";
import type { Patient } from "@/types/patient";

export default function ConsultationPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;
  const base = `/hospitals/${hospitalId}`;

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [record, setRecord] = useState<MedicalRecord | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadRecord = useCallback(
    (recordId: string) =>
      authRequest<MedicalRecord>(`${base}/medical-records/${recordId}`).then(
        setRecord,
      ),
    [authRequest, base],
  );

  useEffect(() => {
    if (!hospitalId) return;

    authRequest<Appointment>(`${base}/appointments/${appointmentId}`)
      .then(async (data) => {
        setAppointment(data);
        const [patientData] = await Promise.all([
          authRequest<Patient>(`${base}/patients/${data.patient.id}`),
          data.medicalRecord
            ? loadRecord(data.medicalRecord.id)
            : Promise.resolve(),
        ]);
        setPatient(patientData);
      })
      .catch((err: Error) => setError(err.message));
  }, [hospitalId, appointmentId, base, authRequest, loadRecord]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setActionError("");
    try {
      await task();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setBusy(false);
    }
  }

  const changeAppointmentStatus = (status: AppointmentStatus) =>
    run(async () => {
      const updated = await authRequest<Appointment>(
        `${base}/appointments/${appointmentId}/status`,
        {
          method: "PATCH",
          body: { status },
        },
      );
      setAppointment(updated);
    });

  async function saveRecord(values: RecordFormValues) {
    const payload = toRecordPayload(values);

    if (record) {
      const updated = await authRequest<MedicalRecord>(
        `${base}/medical-records/${record.id}`,
        {
          method: "PATCH",
          body: payload,
        },
      );
      setRecord(updated);
      return;
    }

    const created = await authRequest<MedicalRecord>(
      `${base}/medical-records`,
      {
        method: "POST",
        body: { ...payload, patientId: appointment!.patient.id, appointmentId },
      },
    );
    setRecord(created);
  }

  const signRecord = () => {
    if (!record) return;
    if (!window.confirm("Sign this record? Signed records cannot be edited."))
      return;

    run(async () => {
      const signed = await authRequest<MedicalRecord>(
        `${base}/medical-records/${record.id}/sign`,
        {
          method: "POST",
        },
      );
      setRecord(signed);
    });
  };

  async function createPrescription(payload: object) {
    await authRequest(`${base}/prescriptions`, {
      method: "POST",
      body: { ...payload, medicalRecordId: record!.id },
    });
    await loadRecord(record!.id);
  }

  async function changePrescriptionStatus(
    prescriptionId: string,
    status: PrescriptionStatus,
  ) {
    await authRequest(`${base}/prescriptions/${prescriptionId}/status`, {
      method: "PATCH",
      body: { status },
    });
    await loadRecord(record!.id);
  }

  if (error)
    return <ErrorState title="Could not open consultation" message={error} />;
  if (!appointment || !patient || !user)
    return <LoadingState message="Opening consultation..." />;

  const isDoctor = user.role === "DOCTOR";
  const consultationOpen =
    appointment.status === "IN_PROGRESS" || appointment.status === "COMPLETED";
  const canEditRecord =
    isDoctor && consultationOpen && (!record || record.status === "DRAFT");
  const isSigned = record?.status === "SIGNED";
  const age = calculateAge(patient.dateOfBirth);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={`/dashboard/appointments?date=${toDateInputValue(new Date(appointment.appointmentAt))}`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to appointments
      </Link>

      {/* Patient header */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-mono text-xs text-slate-500">
            {patient.patientNumber}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            <Link
              href={`/dashboard/patients/${patient.id}`}
              className="hover:text-red-600"
            >
              {patient.firstName} {patient.lastName}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {age !== null ? `${age} yrs` : "Age unknown"} ·{" "}
            {humanize(patient.gender)} · Blood group{" "}
            {patient.bloodGroup ?? "unknown"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {formatDate(appointment.appointmentAt)} at{" "}
            {formatTime(appointment.appointmentAt)} · Dr{" "}
            {appointment.doctor.user.lastName}
            {appointment.reason && (
              <>
                {" "}
                · <span className="italic">{appointment.reason}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={appointment.status} />
          {record && <RecordStatusBadge status={record.status} />}

          {isDoctor && appointment.status === "CHECKED_IN" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => changeAppointmentStatus("IN_PROGRESS")}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Start consultation
            </button>
          )}

          {isDoctor && record?.status === "DRAFT" && (
            <button
              type="button"
              disabled={busy || isDirty}
              title={isDirty ? "Save your changes first" : undefined}
              onClick={signRecord}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <FileSignature size={16} /> Sign record
            </button>
          )}

          {isDoctor && appointment.status === "IN_PROGRESS" && (
            <button
              type="button"
              disabled={busy || !isSigned}
              title={
                !isSigned
                  ? "Sign the record before completing the visit"
                  : undefined
              }
              onClick={() => changeAppointmentStatus("COMPLETED")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 size={16} /> Complete visit
            </button>
          )}
        </div>
      </div>

      {patient.allergies && (
        <div className="flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Allergies: check before prescribing
            </p>
            <p className="mt-0.5 text-sm text-amber-800">{patient.allergies}</p>
          </div>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      {/* Record */}
      <div>
        {canEditRecord ? (
          <RecordForm
            record={record}
            onSubmit={saveRecord}
            onDirtyChange={setIsDirty}
          />
        ) : record ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 font-semibold text-slate-900">
              Consultation record
            </h3>
            <RecordSummary record={record} />
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            {appointment.status === "CHECKED_IN" && isDoctor
              ? "Start the consultation to begin writing notes."
              : "No consultation record has been written for this visit yet."}
          </section>
        )}
      </div>

      {/* Prescriptions */}
      <section className="space-y-4">
        <h3 className="font-semibold text-slate-900">Prescriptions</h3>

        {record?.prescriptions?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {record.prescriptions.map((prescription) => (
              <PrescriptionCard
                key={prescription.id}
                prescription={prescription}
                onStatusChange={
                  isDoctor
                    ? (next) => changePrescriptionStatus(prescription.id, next)
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">None yet.</p>
        )}

        {isDoctor && record && consultationOpen && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-slate-700">
              New prescription
            </p>
            <PrescriptionBuilder onSubmit={createPrescription} />
          </div>
        )}

        {isDoctor && !record && consultationOpen && (
          <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            Create the record first, then you can prescribe.
          </p>
        )}
      </section>
    </div>
  );
}
