"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";

import { humanize } from "@/lib/format";
import type { MedicineForm } from "@/types/clinical";

const FORMS: MedicineForm[] = [
  "TABLET",
  "CAPSULE",
  "SYRUP",
  "SUSPENSION",
  "INJECTION",
  "CREAM",
  "OINTMENT",
  "DROPS",
  "INHALER",
  "POWDER",
  "OTHER",
];

const itemSchema = z.object({
  medicineName: z.string().trim().min(2, "Medicine name is required").max(120),
  form: z.enum(["", ...FORMS] as [string, ...string[]]),
  dosage: z.string().trim().min(1, "Required").max(60),
  frequency: z.string().trim().min(1, "Required").max(60),
  duration: z.string().trim().min(1, "Required").max(60),
  quantity: z
    .string()
    .refine(
      (value) => Number.isInteger(Number(value)) && Number(value) >= 1,
      "At least 1",
    ),
  instructions: z.string().trim().max(300),
});

const prescriptionSchema = z.object({
  instructions: z.string().trim().max(1000),
  items: z.array(itemSchema).min(1, "Add at least one medicine").max(20),
});

type PrescriptionFormValues = z.infer<typeof prescriptionSchema>;

const emptyItem = {
  medicineName: "",
  form: "TABLET",
  dosage: "",
  frequency: "",
  duration: "",
  quantity: "1",
  instructions: "",
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100";

type PrescriptionBuilderProps = {
  onSubmit: (payload: {
    instructions?: string;
    items: Array<{
      medicineName: string;
      form?: MedicineForm;
      dosage: string;
      frequency: string;
      duration: string;
      quantity: number;
      instructions?: string;
    }>;
  }) => Promise<void>;
};

export function PrescriptionBuilder({ onSubmit }: PrescriptionBuilderProps) {
  const [serverError, setServerError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: { instructions: "", items: [emptyItem] },
  });

  // useFieldArray manages add/remove for repeated rows and keeps their ids stable.
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  async function submit(values: PrescriptionFormValues) {
    setServerError("");
    try {
      await onSubmit({
        instructions: values.instructions || undefined,
        items: values.items.map((item) => ({
          medicineName: item.medicineName,
          form: (item.form || undefined) as MedicineForm | undefined,
          dosage: item.dosage,
          frequency: item.frequency,
          duration: item.duration,
          quantity: Number(item.quantity),
          instructions: item.instructions || undefined,
        })),
      });
      reset({ instructions: "", items: [emptyItem] });
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to save prescription",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {serverError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      {fields.map((field, index) => {
        const itemErrors = errors.items?.[index];
        return (
          <div
            key={field.id}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="grid flex-1 gap-3 sm:grid-cols-6">
                <div className="sm:col-span-4">
                  <input
                    {...register(`items.${index}.medicineName`)}
                    placeholder="Medicine, e.g. Paracetamol 500mg"
                    className={inputClass}
                  />
                  {itemErrors?.medicineName && (
                    <p className="mt-1 text-xs text-red-600">
                      {itemErrors.medicineName.message}
                    </p>
                  )}
                </div>
                <select
                  {...register(`items.${index}.form`)}
                  className={`${inputClass} sm:col-span-2`}
                >
                  <option value="">Form</option>
                  {FORMS.map((form) => (
                    <option key={form} value={form}>
                      {humanize(form)}
                    </option>
                  ))}
                </select>
                <input
                  {...register(`items.${index}.dosage`)}
                  placeholder="Dose, e.g. 1g"
                  className={`${inputClass} sm:col-span-2`}
                />
                <input
                  {...register(`items.${index}.frequency`)}
                  placeholder="Frequency, e.g. 8 hourly"
                  className={`${inputClass} sm:col-span-2`}
                />
                <input
                  {...register(`items.${index}.duration`)}
                  placeholder="Duration, e.g. 5 days"
                  className={`${inputClass} sm:col-span-1`}
                />
                <input
                  {...register(`items.${index}.quantity`)}
                  type="number"
                  min={1}
                  placeholder="Qty"
                  className={`${inputClass} sm:col-span-1`}
                />
                <input
                  {...register(`items.${index}.instructions`)}
                  placeholder="Instructions, e.g. after meals (optional)"
                  className={`${inputClass} sm:col-span-6`}
                />
              </div>

              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length === 1}
                aria-label="Remove medicine"
                className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>
            {(itemErrors?.dosage ||
              itemErrors?.frequency ||
              itemErrors?.duration ||
              itemErrors?.quantity) && (
              <p className="mt-2 text-xs text-red-600">
                Dose, frequency, duration and quantity are required.
              </p>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => append(emptyItem)}
        disabled={fields.length >= 20}
        className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
      >
        <Plus size={16} /> Add another medicine
      </button>

      <textarea
        {...register("instructions")}
        rows={2}
        placeholder="General instructions for the patient (optional)"
        className={inputClass}
      />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save prescription"}
        </button>
      </div>
    </form>
  );
}
