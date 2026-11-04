"use client";

import { useState } from "react";

import { formatDate, humanize } from "@/lib/format";
import type { Prescription, PrescriptionStatus } from "@/types/clinical";

const statusStyles: Record<PrescriptionStatus, string> = {
  DRAFT: "bg-amber-50 text-amber-800",
  ISSUED: "bg-blue-50 text-blue-700",
  DISPENSED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500 line-through",
};

type PrescriptionCardProps = {
  prescription: Prescription;
  /** Pass this only when the viewer is allowed to issue or cancel. */
  onStatusChange?: (next: PrescriptionStatus) => Promise<void>;
};

export function PrescriptionCard({
  prescription,
  onStatusChange,
}: PrescriptionCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(next: PrescriptionStatus) {
    if (!onStatusChange) return;
    if (next === "CANCELLED" && !window.confirm("Cancel this prescription?"))
      return;

    setBusy(true);
    setError("");
    try {
      await onStatusChange(next);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update prescription",
      );
    } finally {
      setBusy(false);
    }
  }

  const canIssue = onStatusChange && prescription.status === "DRAFT";
  const canCancel =
    onStatusChange &&
    (prescription.status === "DRAFT" || prescription.status === "ISSUED");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[prescription.status]}`}
          >
            {humanize(prescription.status)}
          </span>
          <span className="text-xs text-slate-500">
            {prescription.issuedAt
              ? `Issued ${formatDate(prescription.issuedAt)}`
              : `Created ${formatDate(prescription.createdAt)}`}
          </span>
        </div>

        {(canIssue || canCancel) && (
          <div className="flex gap-2">
            {canIssue && (
              <button
                type="button"
                disabled={busy}
                onClick={() => change("ISSUED")}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Issue to pharmacy
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                disabled={busy}
                onClick={() => change("CANCELLED")}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      <ul className="mt-3 divide-y divide-slate-100">
        {prescription.items.map((item) => (
          <li key={item.id} className="py-2.5">
            <p className="text-sm font-medium text-slate-900">
              {item.medicineName}
              {item.form && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {humanize(item.form)}
                </span>
              )}
            </p>
            <p className="text-sm text-slate-600">
              {item.dosage} · {item.frequency} · {item.duration} · Qty{" "}
              {item.quantity}
            </p>
            {item.instructions && (
              <p className="text-xs text-slate-500">{item.instructions}</p>
            )}
          </li>
        ))}
      </ul>

      {prescription.instructions && (
        <p className="mt-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">
          {prescription.instructions}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
