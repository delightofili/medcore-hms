"use client";

import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

type FormFieldProps = {
  label: string;
  type?: string;
  placeholder?: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  autoComplete?: string;
};

export function FormField({
  label,
  type = "text",
  placeholder,
  registration,
  error,
  autoComplete,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <input
        {...registration}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
      />

      {error?.message && (
        <p className="text-sm text-red-600">{error.message}</p>
      )}
    </div>
  );
}
