"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormField } from "@/components/forms/form-field";
import { useAuth } from "@/providers/auth-provider";

const registerSchema = z
  .object({
    firstName: z.string().trim().min(2, "First name is required"),
    lastName: z.string().trim().min(2, "Last name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerAccount } = useAuth();

  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(values: RegisterValues) {
    setServerError("");
    setSuccess("");

    try {
      await registerAccount({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
      });

      setSuccess("Your account has been created. You can now sign in.");
      router.push("/login");
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "Unable to create your account.",
      );
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-red-600">
            MedCore HMS
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            Create your account
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Register as a patient to get started.
          </p>
        </div>

        {serverError && (
          <div
            role="alert"
            className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {serverError}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-5 rounded-xl bg-green-50 p-3 text-sm text-green-700"
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="First name"
              placeholder="First name"
              autoComplete="given-name"
              registration={register("firstName")}
              error={errors.firstName}
            />

            <FormField
              label="Last name"
              placeholder="Last name"
              autoComplete="family-name"
              registration={register("lastName")}
              error={errors.lastName}
            />
          </div>

          <FormField
            label="Email address"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            registration={register("email")}
            error={errors.email}
          />

          <FormField
            label="Password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            registration={register("password")}
            error={errors.password}
          />

          <FormField
            label="Confirm password"
            type="password"
            placeholder="Re-enter your password"
            autoComplete="new-password"
            registration={register("confirmPassword")}
            error={errors.confirmPassword}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-red-600 hover:text-red-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
