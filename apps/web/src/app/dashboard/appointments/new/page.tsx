"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { PatientPicker } from "@/components/patients/patient-picker";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { formatTime, humanize, toDateInputValue } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type {
  Appointment,
  AppointmentType,
  Doctor,
  Slot,
  SlotsResponse,
} from "@/types/appointment";
import type { Patient } from "@/types/patient";

const TYPES: AppointmentType[] = [
  "CONSULTATION",
  "FOLLOW_UP",
  "EMERGENCY",
  "TELECONSULTATION",
];

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

function BookAppointmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;
  const today = toDateInputValue();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(() => {
    const requested = searchParams.get("date");
    return requested && requested >= today ? requested : today;
  });
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsVersion, setSlotsVersion] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [type, setType] = useState<AppointmentType>("CONSULTATION");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Coming from a patient page? Preselect that patient.
  useEffect(() => {
    const patientId = searchParams.get("patientId");
    if (!hospitalId || !patientId) return;
    authRequest<Patient>(`/hospitals/${hospitalId}/patients/${patientId}`)
      .then(setPatient)
      .catch(() => undefined);
  }, [hospitalId, searchParams, authRequest]);

  useEffect(() => {
    if (!hospitalId) return;
    authRequest<Doctor[]>(`/hospitals/${hospitalId}/doctors`)
      .then((list) => {
        setDoctors(list);
        // Doctors can only book for themselves, so lock the choice.
        const own = list.find((doctor) => doctor.user.id === user?.id);
        if (own) setDoctorId(own.id);
      })
      .catch((err: Error) => setError(err.message));
  }, [hospitalId, user?.id, authRequest]);

  useEffect(() => {
    if (!hospitalId || !doctorId || !date) {
      setSlots(null);
      return;
    }

    let cancelled = false;
    setSlots(null);
    setSelectedSlot("");

    authRequest<SlotsResponse>(
      `/hospitals/${hospitalId}/doctors/available-slots?doctorId=${doctorId}&date=${date}`,
    )
      .then((data) => !cancelled && setSlots(data.slots))
      .catch((err: Error) => {
        if (cancelled) return;
        setSlots([]);
        setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [hospitalId, doctorId, date, slotsVersion, authRequest]);

  async function handleSubmit() {
    if (!patient || !doctorId || !selectedSlot) return;

    setIsSubmitting(true);
    setError("");
    try {
      await authRequest<Appointment>(`/hospitals/${hospitalId}/appointments`, {
        method: "POST",
        body: {
          patientId: patient.id,
          doctorId,
          appointmentAt: selectedSlot,
          type,
          reason: reason.trim() || undefined,
        },
      });
      router.push(`/dashboard/appointments?date=${date}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to book appointment",
      );
      // Someone may have taken the slot: reload so the grid shows the truth.
      setSlotsVersion((version) => version + 1);
      setIsSubmitting(false);
    }
  }

  if (!hospitalId) {
    return (
      <EmptyState
        title="No hospital selected"
        message="Sign in with a hospital staff account."
      />
    );
  }

  const isDoctor = user?.role === "DOCTOR";
  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);
  const canSubmit =
    Boolean(patient && doctorId && selectedSlot) && !isSubmitting;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/dashboard/appointments?date=${date}`}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to appointments
      </Link>

      <h2 className="text-2xl font-bold tracking-tight text-slate-900">
        Book appointment
      </h2>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Patient
          </label>
          <PatientPicker
            hospitalId={hospitalId}
            value={patient}
            onChange={setPatient}
          />
          {!patient && (
            <p className="text-xs text-slate-500">
              New patient?{" "}
              <Link
                href="/dashboard/patients/new"
                className="font-medium text-red-600"
              >
                Register them first
              </Link>
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="doctor"
              className="block text-sm font-medium text-slate-700"
            >
              Doctor
            </label>
            <select
              id="doctor"
              value={doctorId}
              disabled={isDoctor}
              onChange={(event) => setDoctorId(event.target.value)}
              className={`${fieldClass} disabled:bg-slate-50`}
            >
              <option value="">Select a doctor</option>
              {doctors.map((doctor) => (
                <option
                  key={doctor.id}
                  value={doctor.id}
                  disabled={!doctor.isAvailable}
                >
                  Dr {doctor.user.firstName} {doctor.user.lastName}
                  {doctor.specialization ? ` · ${doctor.specialization}` : ""}
                  {!doctor.isAvailable ? " (unavailable)" : ""}
                </option>
              ))}
            </select>
            {selectedDoctor?.department && (
              <p className="text-xs text-slate-500">
                {selectedDoctor.department.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="date"
              className="block text-sm font-medium text-slate-700"
            >
              Date
            </label>
            <input
              id="date"
              type="date"
              min={today}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Available times</p>
          {!doctorId ? (
            <p className="text-sm text-slate-500">
              Choose a doctor to see open slots.
            </p>
          ) : slots === null ? (
            <p className="text-sm text-slate-500">Loading slots...</p>
          ) : slots.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              No open slots on this day. Try another date.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {slots.map((slot) => {
                const active = slot.startsAt === selectedSlot;
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedSlot(slot.startsAt)}
                    className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${
                      active
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-slate-200 text-slate-700 hover:border-red-300 hover:bg-red-50"
                    }`}
                  >
                    {formatTime(slot.startsAt)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              htmlFor="type"
              className="block text-sm font-medium text-slate-700"
            >
              Visit type
            </label>
            <select
              id="type"
              value={type}
              onChange={(event) =>
                setType(event.target.value as AppointmentType)
              }
              className={fieldClass}
            >
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="reason"
            className="block text-sm font-medium text-slate-700"
          >
            Reason for visit
          </label>
          <textarea
            id="reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Fever and headache for three days"
            className={fieldClass}
          />
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {selectedSlot && selectedDoctor
            ? `${formatTime(selectedSlot)} with Dr ${selectedDoctor.user.lastName}`
            : "Pick a patient, doctor and time"}
        </p>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? "Booking..." : "Confirm booking"}
        </button>
      </div>
    </div>
  );
}

export default function BookAppointmentPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading..." />}>
      <BookAppointmentForm />
    </Suspense>
  );
}
