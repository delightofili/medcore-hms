"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

import { PatientPicker } from "@/components/patients/patient-picker";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { BillingPatient, Invoice } from "@/types/billing";

// Demo price list. In a full system these would come from a services table.
const QUICK_ITEMS = [
  { description: "General consultation", unitPrice: "15000" },
  { description: "Follow up visit", unitPrice: "8000" },
  { description: "Malaria RDT", unitPrice: "2500" },
  { description: "Full blood count", unitPrice: "4500" },
];

const money = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v),
    "Use a number with up to 2 decimals",
  );

const invoiceSchema = z.object({
  items: z
    .array(
      z.object({
        description: z.string().trim().min(2, "Describe the item").max(200),
        quantity: z
          .string()
          .refine((v) => /^\d+$/.test(v) && Number(v) >= 1, "At least 1"),
        unitPrice: money.refine((v) => v !== "", "Enter a price"),
      }),
    )
    .min(1, "Add at least one item"),
  discountAmount: money,
  dueDate: z.string(),
  notes: z.string().trim().max(1000),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

// Preview only: maths in kobo (whole numbers) so the preview never shows float noise.
// The server recalculates everything with Decimal when the invoice is saved.
const toKobo = (value: string) => Math.round(Number(value || 0) * 100);

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100";

function NewInvoiceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;

  const [patient, setPatient] = useState<BillingPatient | null>(null);
  const [serverError, setServerError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      items: [{ description: "", quantity: "1", unitPrice: "" }],
      discountAmount: "",
      dueDate: "",
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  // useWatch re-renders only this component when items or discount change, for the live total.
  const items = useWatch({ control, name: "items" });
  const discount = useWatch({ control, name: "discountAmount" });

  // Coming from a patient page: preselect them through the billing lookup.
  useEffect(() => {
    const patientNumber = searchParams.get("patient");
    if (!hospitalId || !patientNumber) return;
    authRequest<{ items: BillingPatient[] }>(
      `/hospitals/${hospitalId}/invoices/patients?q=${encodeURIComponent(patientNumber)}`,
    )
      .then((data) => data.items[0] && setPatient(data.items[0]))
      .catch(() => undefined);
  }, [hospitalId, searchParams, authRequest]);

  if (!hospitalId) {
    return (
      <EmptyState
        title="No hospital selected"
        message="Sign in with a hospital staff account."
      />
    );
  }

  const subtotalKobo = (items ?? []).reduce(
    (sum, item) => sum + toKobo(item.unitPrice) * (Number(item.quantity) || 0),
    0,
  );
  const totalKobo = subtotalKobo - toKobo(discount);

  async function submit(values: InvoiceFormValues) {
    if (!patient) {
      setServerError("Choose the patient to bill");
      return;
    }

    setServerError("");
    try {
      const invoice = await authRequest<Invoice>(
        `/hospitals/${hospitalId}/invoices`,
        {
          method: "POST",
          body: {
            patientId: patient.id,
            items: values.items.map((item) => ({
              description: item.description,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            })),
            discountAmount: values.discountAmount
              ? Number(values.discountAmount)
              : undefined,
            dueDate: values.dueDate || undefined,
            notes: values.notes || undefined,
          },
        },
      );
      router.push(`/dashboard/billing/${invoice.id}`);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to create invoice",
      );
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/dashboard/billing"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to billing
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          New invoice
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Saved as a draft. You can review it before issuing.
        </p>
      </div>

      <form onSubmit={handleSubmit(submit)} className="space-y-6">
        {serverError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {serverError}
          </div>
        )}

        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-6">
          <label className="block text-sm font-medium text-slate-700">
            Patient
          </label>
          <PatientPicker<BillingPatient>
            hospitalId={hospitalId}
            value={patient}
            onChange={setPatient}
            searchPath={(term) =>
              `/hospitals/${hospitalId}/invoices/patients?q=${encodeURIComponent(term)}`
            }
          />
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">Items</h3>
            <div className="flex flex-wrap gap-2">
              {QUICK_ITEMS.map((item) => (
                <button
                  key={item.description}
                  type="button"
                  onClick={() => append({ ...item, quantity: "1" })}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-red-300 hover:bg-red-50"
                >
                  + {item.description}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden grid-cols-12 gap-3 text-xs font-medium uppercase tracking-wide text-slate-400 sm:grid">
            <span className="col-span-6">Description</span>
            <span className="col-span-2">Qty</span>
            <span className="col-span-3">Unit price</span>
          </div>

          {fields.map((field, index) => {
            const itemErrors = errors.items?.[index];
            return (
              <div
                key={field.id}
                className="grid grid-cols-12 items-start gap-3"
              >
                <div className="col-span-12 sm:col-span-6">
                  <input
                    {...register(`items.${index}.description`)}
                    placeholder="e.g. General consultation"
                    className={inputClass}
                  />
                  {itemErrors?.description && (
                    <p className="mt-1 text-xs text-red-600">
                      {itemErrors.description.message}
                    </p>
                  )}
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <input
                    {...register(`items.${index}.quantity`)}
                    inputMode="numeric"
                    className={inputClass}
                  />
                  {itemErrors?.quantity && (
                    <p className="mt-1 text-xs text-red-600">
                      {itemErrors.quantity.message}
                    </p>
                  )}
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <input
                    {...register(`items.${index}.unitPrice`)}
                    inputMode="decimal"
                    placeholder="0.00"
                    className={inputClass}
                  />
                  {itemErrors?.unitPrice && (
                    <p className="mt-1 text-xs text-red-600">
                      {itemErrors.unitPrice.message}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                  aria-label="Remove item"
                  className="col-span-2 flex justify-center rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:col-span-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() =>
              append({ description: "", quantity: "1", unitPrice: "" })
            }
            className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700"
          >
            <Plus size={16} /> Add item
          </button>
        </section>

        <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label
              htmlFor="discount"
              className="block text-sm font-medium text-slate-700"
            >
              Discount
            </label>
            <input
              id="discount"
              {...register("discountAmount")}
              inputMode="decimal"
              placeholder="0.00"
              className={inputClass}
            />
            {errors.discountAmount && (
              <p className="text-xs text-red-600">
                {errors.discountAmount.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="dueDate"
              className="block text-sm font-medium text-slate-700"
            >
              Due date
            </label>
            <input
              id="dueDate"
              type="date"
              {...register("dueDate")}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-slate-700"
            >
              Notes
            </label>
            <textarea
              id="notes"
              rows={2}
              {...register("notes")}
              placeholder="Optional"
              className={inputClass}
            />
          </div>
        </section>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="text-slate-500">
              Subtotal {formatMoney(subtotalKobo / 100)}
              {toKobo(discount) > 0 &&
                ` · Discount ${formatMoney(toKobo(discount) / 100)}`}
            </p>
            <p
              className={`mt-1 text-xl font-bold tabular-nums ${totalKobo < 0 ? "text-red-600" : "text-slate-900"}`}
            >
              {formatMoney(totalKobo / 100)}
            </p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !patient || totalKobo <= 0}
            className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save draft invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<LoadingState message="Loading..." />}>
      <NewInvoiceForm />
    </Suspense>
  );
}
