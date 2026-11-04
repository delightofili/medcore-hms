"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import type { MedicalRecord } from "@/types/clinical";
import { TEXT_FIELDS, VITALS, type TextKey, type VitalKey } from "./vitals";

const vitalShape = Object.fromEntries(
  VITALS.map((vital) => [
    vital.key,
    z
      .string()
      .trim()
      .refine(
        (value) =>
          value === "" ||
          (Number(value) >= vital.min && Number(value) <= vital.max),
        `${vital.label} must be between ${vital.min} and ${vital.max}`,
      ),
  ]),
) as Record<VitalKey, z.ZodString>;

const textShape = Object.fromEntries(
  TEXT_FIELDS.map((field) => [field.key, z.string().max(4000)]),
) as Record<TextKey, z.ZodString>;

const recordSchema = z.object({ ...textShape, ...vitalShape });

export type RecordFormValues = z.infer<typeof recordSchema>;

/** Text is always sent ("" clears it). Empty vitals are left out. */
export function toRecordPayload(values: RecordFormValues) {
  const payload: Record<string, string | number> = {};

  for (const field of TEXT_FIELDS) payload[field.key] = values[field.key];

  for (const vital of VITALS) {
    const raw = values[vital.key].trim();
    if (raw !== "") payload[vital.key] = Number(raw);
  }

  return payload;
}

function toFormValues(record?: MedicalRecord | null): RecordFormValues {
  const values = {} as RecordFormValues;
  for (const field of TEXT_FIELDS)
    values[field.key] = record?.[field.key] ?? "";
  for (const vital of VITALS) {
    const value = record?.[vital.key];
    values[vital.key] =
      value === null || value === undefined ? "" : String(Number(value));
  }
  return values;
}

type RecordFormProps = {
  record?: MedicalRecord | null;
  onSubmit: (values: RecordFormValues) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

export function RecordForm({
  record,
  onSubmit,
  onDirtyChange,
}: RecordFormProps) {
  const [serverError, setServerError] = useState("");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: toFormValues(record),
  });

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);

  async function submit(values: RecordFormValues) {
    setServerError("");
    try {
      await onSubmit(values);
      reset(values); // the saved values become the new "clean" state
      setSavedAt(new Date());
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to save the record",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6">
      {serverError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Vitals</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {VITALS.map((vital) => (
            <div key={vital.key} className="space-y-1.5">
              <label
                htmlFor={vital.key}
                className="block text-xs font-medium text-slate-600"
              >
                {vital.label}{" "}
                <span className="text-slate-400">({vital.unit})</span>
              </label>
              <input
                id={vital.key}
                type="number"
                inputMode="decimal"
                step={vital.step}
                min={vital.min}
                max={vital.max}
                {...register(vital.key)}
                aria-invalid={Boolean(errors[vital.key])}
                className={inputClass}
              />
              {errors[vital.key]?.message && (
                <p className="text-xs text-red-600">
                  {errors[vital.key]?.message}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Consultation notes</h3>
        {TEXT_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label
              htmlFor={field.key}
              className="block text-sm font-medium text-slate-700"
            >
              {field.label}
            </label>
            <textarea
              id={field.key}
              rows={field.rows}
              placeholder={field.placeholder}
              {...register(field.key)}
              className={inputClass}
            />
          </div>
        ))}
      </section>

      <div className="flex items-center justify-end gap-3">
        {savedAt && !isDirty && (
          <p className="text-xs text-slate-500">
            Saved at{" "}
            {savedAt.toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
        {isDirty && <p className="text-xs text-amber-700">Unsaved changes</p>}
        <button
          type="submit"
          disabled={isSubmitting || (!isDirty && Boolean(record))}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : record ? "Save draft" : "Create record"}
        </button>
      </div>
    </form>
  );
}
