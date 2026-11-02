"use client";

import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/forms/form-field";
import { SelectField, TextAreaField } from "@/components/forms/form-controls";
import type { Patient } from "@/types/patient";

const optionalText = z.string().trim().max(200, "Too long");

export const patientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  dateOfBirth: z
    .string()
    .refine(
      (value) => value === "" || new Date(value) <= new Date(),
      "Date of birth cannot be in the future",
    ),
  gender: z.enum(["", "MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
  bloodGroup: optionalText,
  email: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Enter a valid email address",
    ),
  phone: z.string().trim().max(30, "Phone number is too long"),
  emergencyContactName: optionalText,
  emergencyContactPhone: z.string().trim().max(30),
  allergies: z.string().trim().max(2000),
  medicalHistory: z.string().trim().max(5000),
  addressLine1: optionalText,
  city: optionalText,
  state: optionalText,
  country: optionalText,
});

export type PatientFormValues = z.infer<typeof patientSchema>;

export function toFormValues(patient?: Patient): PatientFormValues {
  return {
    firstName: patient?.firstName ?? "",
    lastName: patient?.lastName ?? "",
    dateOfBirth: patient?.dateOfBirth ? patient.dateOfBirth.slice(0, 10) : "",
    gender: patient?.gender ?? "",
    bloodGroup: patient?.bloodGroup ?? "",
    email: patient?.email ?? "",
    phone: patient?.phone ?? "",
    emergencyContactName: patient?.emergencyContactName ?? "",
    emergencyContactPhone: patient?.emergencyContactPhone ?? "",
    allergies: patient?.allergies ?? "",
    medicalHistory: patient?.medicalHistory ?? "",
    addressLine1: patient?.addressLine1 ?? "",
    city: patient?.city ?? "",
    state: patient?.state ?? "",
    country: patient?.country ?? "",
  };
}

const genderOptions = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer not to say" },
];

const bloodGroupOptions = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
].map((value) => ({ value, label: value }));

type PatientFormProps = {
  initialPatient?: Patient;
  submitLabel: string;
  onSubmit: (values: PatientFormValues) => Promise<void>;
};

export function PatientForm({
  initialPatient,
  submitLabel,
  onSubmit,
}: PatientFormProps) {
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: toFormValues(initialPatient),
  });

  async function submit(values: PatientFormValues) {
    setServerError("");
    try {
      await onSubmit(values);
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Unable to save the patient.",
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-8">
      {serverError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Personal details</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <FormField
            label="First name"
            registration={register("firstName")}
            error={errors.firstName}
          />
          <FormField
            label="Last name"
            registration={register("lastName")}
            error={errors.lastName}
          />
          <FormField
            label="Date of birth"
            type="date"
            registration={register("dateOfBirth")}
            error={errors.dateOfBirth}
          />
          <SelectField
            label="Gender"
            options={genderOptions}
            registration={register("gender")}
            error={errors.gender}
          />
          <SelectField
            label="Blood group"
            options={bloodGroupOptions}
            registration={register("bloodGroup")}
            error={errors.bloodGroup}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Contact</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <FormField
            label="Phone"
            type="tel"
            placeholder="08012345678"
            registration={register("phone")}
            error={errors.phone}
          />
          <FormField
            label="Email"
            type="email"
            registration={register("email")}
            error={errors.email}
          />
          <FormField
            label="Address"
            registration={register("addressLine1")}
            error={errors.addressLine1}
          />
          <FormField
            label="City"
            registration={register("city")}
            error={errors.city}
          />
          <FormField
            label="State"
            registration={register("state")}
            error={errors.state}
          />
          <FormField
            label="Country"
            registration={register("country")}
            error={errors.country}
          />
          <FormField
            label="Emergency contact name"
            registration={register("emergencyContactName")}
            error={errors.emergencyContactName}
          />
          <FormField
            label="Emergency contact phone"
            type="tel"
            registration={register("emergencyContactPhone")}
            error={errors.emergencyContactPhone}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Clinical background</h3>
        <div className="mt-5 grid gap-5">
          <TextAreaField
            label="Allergies"
            placeholder="e.g. Penicillin"
            registration={register("allergies")}
            error={errors.allergies}
          />
          <TextAreaField
            label="Medical history"
            rows={4}
            registration={register("medicalHistory")}
            error={errors.medicalHistory}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
