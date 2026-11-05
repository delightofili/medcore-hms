"use client";

import { useEffect, useState } from "react";

import { formatMoney, humanize } from "@/lib/format";
import type { PaymentMethod } from "@/types/billing";

const METHODS: PaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "ONLINE",
  "INSURANCE",
  "OTHER",
];

type PaymentDialogProps = {
  balance: string;
  currency: string;
  onSubmit: (payment: {
    amount: number;
    method: PaymentMethod;
    providerReference?: string;
    notes?: string;
    idempotencyKey: string;
  }) => Promise<void>;
  onClose: () => void;
};

export function PaymentDialog({
  balance,
  currency,
  onSubmit,
  onClose,
}: PaymentDialogProps) {
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // One key per dialog: retries and double clicks reuse it, so the server records the payment once.
  const [idempotencyKey] = useState(() => `pay-${crypto.randomUUID()}`);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) =>
      event.key === "Escape" && !isSaving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, isSaving]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);

    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim()) || value <= 0) {
      setError("Enter an amount above zero with up to 2 decimals");
      return;
    }
    if (value > Number(balance)) {
      setError(
        `Amount is more than the balance of ${formatMoney(balance, currency)}`,
      );
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await onSubmit({
        amount: value,
        method,
        providerReference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record payment");
      setIsSaving(false);
    }
  }

  const fieldClass =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={() => !isSaving && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <div>
          <h3
            id="payment-title"
            className="text-lg font-semibold text-slate-900"
          >
            Record payment
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Balance due: {formatMoney(balance, currency)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-slate-700"
            >
              Amount
            </label>
            <input
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              autoFocus
              className={fieldClass}
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="method"
              className="block text-sm font-medium text-slate-700"
            >
              Method
            </label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className={fieldClass}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {humanize(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {method !== "CASH" && (
          <div className="space-y-1.5">
            <label
              htmlFor="reference"
              className="block text-sm font-medium text-slate-700"
            >
              Reference
            </label>
            <input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transfer or card reference"
              className={fieldClass}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="pnotes"
            className="block text-sm font-medium text-slate-700"
          >
            Notes
          </label>
          <input
            id="pnotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            className={fieldClass}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isSaving ? "Recording..." : "Record payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
