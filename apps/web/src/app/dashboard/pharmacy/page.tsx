"use client";

import { useEffect, useState } from "react";

import { PrescriptionCard } from "@/components/clinical/prescription-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@/types/auth";
import type { Prescription, PrescriptionStatus } from "@/types/clinical";
import type { Paginated } from "@/types/common";

const DISPENSE_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "HOSPITAL_ADMIN",
  "PHARMACIST",
];

const TABS: Array<{ value: PrescriptionStatus; label: string }> = [
  { value: "ISSUED", label: "To dispense" },
  { value: "DISPENSED", label: "Dispensed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function PharmacyPage() {
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;

  const [status, setStatus] = useState<PrescriptionStatus>("ISSUED");
  const [items, setItems] = useState<Prescription[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!hospitalId) return;
    let cancelled = false;

    setItems(null);
    setError("");
    authRequest<Paginated<Prescription>>(
      `/hospitals/${hospitalId}/prescriptions?status=${status}&limit=50`,
    )
      .then((data) => !cancelled && setItems(data.items))
      .catch((err: Error) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [hospitalId, status, authRequest]);

  async function dispense(prescription: Prescription) {
    const name = `${prescription.patient?.firstName} ${prescription.patient?.lastName}`;
    if (!window.confirm(`Mark ${name}'s prescription as dispensed?`)) return;

    setBusyId(prescription.id);
    setError("");
    try {
      await authRequest(
        `/hospitals/${hospitalId}/prescriptions/${prescription.id}/status`,
        {
          method: "PATCH",
          body: { status: "DISPENSED" },
        },
      );
      // Dispensed items leave the "to dispense" queue straight away.
      setItems(
        (current) =>
          current?.filter((item) => item.id !== prescription.id) ?? null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to dispense");
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

  const canDispense = DISPENSE_ROLES.includes(user.role);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Pharmacy
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Prescriptions issued by doctors, oldest first in the queue.
        </p>
      </div>

      <div role="tablist" className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              status === tab.value
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorState title="Something went wrong" message={error} />}

      {!items ? (
        <LoadingState message="Loading prescriptions..." />
      ) : items.length === 0 ? (
        <EmptyState
          title={status === "ISSUED" ? "Queue is clear" : "Nothing here"}
          message={
            status === "ISSUED"
              ? "No prescriptions are waiting to be dispensed."
              : "No prescriptions in this list."
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* The API returns newest first; the queue should serve the oldest first. */}
          {(status === "ISSUED" ? [...items].reverse() : items).map(
            (prescription) => (
              <div key={prescription.id} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {prescription.patient?.firstName}{" "}
                    {prescription.patient?.lastName}
                    <span className="ml-2 font-mono text-xs font-normal text-slate-500">
                      {prescription.patient?.patientNumber}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    Dr {prescription.doctor?.user.lastName}
                  </p>
                </div>

                <PrescriptionCard prescription={prescription} />

                {status === "ISSUED" && canDispense && (
                  <button
                    type="button"
                    disabled={busyId === prescription.id}
                    onClick={() => dispense(prescription)}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busyId === prescription.id
                      ? "Saving..."
                      : "Mark as dispensed"}
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
