"use client";

import { useEffect, useRef, useState } from "react";

type CancelDialogProps = {
  patientName: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
};

export function CancelDialog({
  patientName,
  onConfirm,
  onClose,
}: CancelDialogProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleConfirm() {
    if (!reason.trim()) {
      setError("Please give a reason for cancelling");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await onConfirm(reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel");
      setIsSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="cancel-title" className="text-lg font-semibold text-slate-900">
          Cancel appointment
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Cancel {patientName}&apos;s appointment. This cannot be undone.
        </p>

        <textarea
          ref={inputRef}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Reason, e.g. patient requested to reschedule"
          className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Keep appointment
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isSaving ? "Cancelling..." : "Cancel appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}
