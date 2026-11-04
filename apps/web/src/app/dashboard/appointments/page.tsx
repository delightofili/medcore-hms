"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import {
  actionsFor,
  type AppointmentAction,
} from "@/components/appointments/appointment-actions";
import { CancelDialog } from "@/components/appointments/cancel-dialog";
import { StatusBadge } from "@/components/appointments/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { formatTime, humanize, toDateInputValue } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Appointment, AppointmentStatus } from "@/types/appointment";
import type { Paginated } from "@/types/common";

const STATUS_FILTERS: Array<AppointmentStatus | ""> = [
  "",
  "SCHEDULED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

const CONSULT_ROLES = ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE"];
const CONSULT_STATUSES: AppointmentStatus[] = [
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
];

const toneClass: Record<AppointmentAction["tone"], string> = {
  primary: "bg-red-600 text-white hover:bg-red-700",
  neutral: "border border-slate-200 text-slate-700 hover:bg-slate-50",
  danger: "text-red-600 hover:bg-red-50",
};

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

function AppointmentsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;

  // The date lives in the URL so a refresh or a shared link keeps the same day.
  const date = searchParams.get("date") ?? toDateInputValue();
  const [status, setStatus] = useState<AppointmentStatus | "">("");
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);

  const setDate = (value: string) =>
    router.replace(`/dashboard/appointments?date=${value}`);

  useEffect(() => {
    if (!hospitalId) return;
    let cancelled = false;

    const params = new URLSearchParams({ date, limit: "100" });
    if (status) params.set("status", status);

    setAppointments(null);
    setError("");

    authRequest<Paginated<Appointment>>(
      `/hospitals/${hospitalId}/appointments?${params}`,
    )
      .then((data) => !cancelled && setAppointments(data.items))
      .catch((err: Error) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [hospitalId, date, status, authRequest]);

  const changeStatus = useCallback(
    async (
      appointment: Appointment,
      next: AppointmentStatus,
      cancellationReason?: string,
    ) => {
      const updated = await authRequest<Appointment>(
        `/hospitals/${hospitalId}/appointments/${appointment.id}/status`,
        { method: "PATCH", body: { status: next, cancellationReason } },
      );
      // Swap in the server's version instead of refetching the whole day.
      setAppointments(
        (current) =>
          current?.map((item) => (item.id === updated.id ? updated : item)) ??
          null,
      );
    },
    [authRequest, hospitalId],
  );

  async function handleAction(
    appointment: Appointment,
    action: AppointmentAction,
  ) {
    if (action.next === "CANCELLED") {
      setCancelTarget(appointment);
      return;
    }

    setBusyId(appointment.id);
    setActionError("");
    try {
      await changeStatus(appointment, action.next);
      // Starting a consultation takes the doctor straight to the notes.
      if (action.next === "IN_PROGRESS") {
        router.push(`/dashboard/appointments/${appointment.id}/consult`);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to update appointment",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!hospitalId || !user) {
    return (
      <EmptyState
        title="No hospital selected"
        message="Sign in with a hospital staff account."
      />
    );
  }

  const isToday = date === toDateInputValue();
  const counts = (appointments ?? []).reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Appointments
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {user.role === "DOCTOR" ? "Your schedule" : "Hospital schedule"}
            {appointments && ` · ${appointments.length} on this day`}
          </p>
        </div>

        <Link
          href={`/dashboard/appointments/new?date=${date}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <Plus size={16} />
          Book appointment
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, -1))}
            aria-label="Previous day"
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </button>
          <input
            type="date"
            value={date}
            onChange={(event) =>
              event.target.value && setDate(event.target.value)
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
          />
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, 1))}
            aria-label="Next day"
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </button>
          {!isToday && (
            <button
              type="button"
              onClick={() => setDate(toDateInputValue())}
              className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Today
            </button>
          )}
        </div>

        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as AppointmentStatus | "")
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-500"
        >
          {STATUS_FILTERS.map((value) => (
            <option key={value} value={value}>
              {value ? humanize(value) : "All statuses"}
            </option>
          ))}
        </select>
      </div>

      {appointments && appointments.length > 0 && !status && (
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          {Object.entries(counts).map(([key, count]) => (
            <span
              key={key}
              className="rounded-full border border-slate-200 bg-white px-3 py-1"
            >
              {humanize(key)}:{" "}
              <strong className="text-slate-900">{count}</strong>
            </span>
          ))}
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

      {error ? (
        <ErrorState title="Could not load appointments" message={error} />
      ) : !appointments ? (
        <LoadingState message="Loading appointments..." />
      ) : appointments.length === 0 ? (
        <EmptyState
          title="No appointments"
          message="Nothing booked for this day yet."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Doctor</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((appointment) => {
                const actions = actionsFor(appointment, user.role);
                const busy = busyId === appointment.id;

                return (
                  <tr key={appointment.id} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {formatTime(appointment.appointmentAt)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {appointment.durationMinutes} min
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/patients/${appointment.patient.id}`}
                        className="font-medium text-slate-900 hover:text-red-600"
                      >
                        {appointment.patient.firstName}{" "}
                        {appointment.patient.lastName}
                      </Link>
                      <p className="font-mono text-xs text-slate-500">
                        {appointment.patient.patientNumber}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      Dr {appointment.doctor.user.lastName}
                      <p className="text-xs text-slate-400">
                        {appointment.department?.name}
                      </p>
                    </td>
                    <td className="max-w-[220px] px-5 py-4 text-slate-600">
                      <p className="line-clamp-2">
                        {appointment.reason ?? humanize(appointment.type)}
                      </p>
                      {appointment.cancellationReason && (
                        <p className="mt-1 text-xs text-red-600">
                          Cancelled: {appointment.cancellationReason}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={appointment.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        {CONSULT_ROLES.includes(user.role) &&
                          CONSULT_STATUSES.includes(appointment.status) && (
                            <Link
                              href={`/dashboard/appointments/${appointment.id}/consult`}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              {appointment.medicalRecord
                                ? "View record"
                                : "Open"}
                            </Link>
                          )}
                        {actions.map((action) => (
                          <button
                            key={action.next}
                            type="button"
                            disabled={busy}
                            onClick={() => handleAction(appointment, action)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${toneClass[action.tone]}`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {cancelTarget && (
        <CancelDialog
          patientName={`${cancelTarget.patient.firstName} ${cancelTarget.patient.lastName}`}
          onClose={() => setCancelTarget(null)}
          onConfirm={async (reason) => {
            await changeStatus(cancelTarget, "CANCELLED", reason);
            setCancelTarget(null);
          }}
        />
      )}
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading appointments..." />}>
      <AppointmentsView />
    </Suspense>
  );
}
