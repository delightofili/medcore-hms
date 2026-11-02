"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { calculateAge, humanize } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Paginated } from "@/types/common";
import type { Patient } from "@/types/patient";

export default function PatientsPage() {
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Patient> | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Wait until typing pauses before hitting the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!hospitalId) return;
    let cancelled = false;

    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (query) params.set("q", query);

    setIsLoading(true);
    setError("");

    authRequest<Paginated<Patient>>(
      `/hospitals/${hospitalId}/patients?${params}`,
    )
      .then((result) => !cancelled && setData(result))
      .catch((err: Error) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setIsLoading(false));

    return () => {
      cancelled = true;
    };
  }, [hospitalId, query, page, authRequest]);

  if (!hospitalId) {
    return (
      <EmptyState
        title="No hospital selected"
        message="Patients belong to a hospital. Sign in with a hospital staff account to manage them."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Patients
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {data
              ? `${data.pagination.total} registered patients`
              : "Patient registry"}
          </p>
        </div>

        <Link
          href="/dashboard/patients/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
        >
          <Plus size={16} />
          Register patient
        </Link>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name, patient number, phone or email"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
        />
      </div>

      {error ? (
        <ErrorState title="Could not load patients" message={error} />
      ) : isLoading && !data ? (
        <LoadingState message="Loading patients..." />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          title={query ? "No matching patients" : "No patients yet"}
          message={
            query
              ? "Try a different name or number."
              : "Register your first patient to get started."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Number</th>
                <th className="px-5 py-3 font-medium">Age / Gender</th>
                <th className="px-5 py-3 font-medium">Phone</th>
                <th className="px-5 py-3 font-medium">Blood</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y divide-slate-100 ${isLoading ? "opacity-60" : ""}`}
            >
              {data.items.map((patient) => {
                const age = calculateAge(patient.dateOfBirth);
                return (
                  <tr key={patient.id} className="transition hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <Link
                        href={`/dashboard/patients/${patient.id}`}
                        className="font-medium text-slate-900 hover:text-red-600"
                      >
                        {patient.firstName} {patient.lastName}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">
                      {patient.patientNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {age !== null ? `${age} yrs` : "Unknown"} ·{" "}
                      {patient.gender ? humanize(patient.gender) : "Unknown"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {patient.phone ?? "Not recorded"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {patient.bloodGroup ?? "Unknown"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Page {data.pagination.page} of {data.pagination.pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= data.pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
