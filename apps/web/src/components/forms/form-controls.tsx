"use client";

import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

const controlClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100";

type BaseProps = {
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
};

export function SelectField({
  label,
  registration,
  error,
  options,
  placeholder = "Select an option",
}: BaseProps & {
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        {...registration}
        aria-invalid={Boolean(error)}
        className={controlClass}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error?.message && (
        <p className="text-sm text-red-600">{error.message}</p>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  registration,
  error,
  placeholder,
  rows = 3,
}: BaseProps & { placeholder?: string; rows?: number }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        {...registration}
        rows={rows}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        className={controlClass}
      />
      {error?.message && (
        <p className="text-sm text-red-600">{error.message}</p>
      )}
    </div>
  );
}
