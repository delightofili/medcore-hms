"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { RecordStatusBadge } from "@/components/clinical/record-summary";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { MedicalRecord } from "@/types/clinical";
import type { Paginated } from "@/types/common";

const FILTERS = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Unsigned" },
  { value: "SIGNED", label: "Signed" },
];

function RecordsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;
  const status = searchParams.get("status") ?? "";

  const [data, setData] = useState<Paginated<MedicalRecord> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hospitalId) return;
    let cancelled = false;
    const params = new URLSearchParams({ limit: "50" });
    if (status) params.set("status", status);

    setData(null);
    authRequest<Paginated<MedicalRecord>>(
      `/hospitals/${hospitalId}/medical-records?${params}`,
    )
      .then((result) => !cancelled && setData(result))
      .catch((err: Error) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [hospitalId, status, authRequest]);

  if (!hospitalId) {
    return (
      <EmptyState
        title="No hospital selected"
        message="Sign in with a hospital staff account."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Medical records
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Most recent consultations first.
        </p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() =>
              router.replace(
                item.value
                  ? `/dashboard/records?status=${item.value}`
                  : "/dashboard/records",
              )
            }
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              status === item.value
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState title="Could not load records" message={error} />
      ) : !data ? (
        <LoadingState message="Loading records..." />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="No records"
          message="Records appear here once doctors write consultation notes."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Doctor</th>
                <th className="px-5 py-3 font-medium">Diagnosis</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((record) => (
                <tr key={record.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4 text-slate-600">
                    {formatDate(record.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={
                        record.appointmentId
                          ? `/dashboard/appointments/${record.appointmentId}/consult`
                          : `/dashboard/patients/${record.patient.id}`
                      }
                      className="font-medium text-slate-900 hover:text-red-600"
                    >
                      {record.patient.firstName} {record.patient.lastName}
                    </Link>
                    <p className="font-mono text-xs text-slate-500">
                      {record.patient.patientNumber}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    Dr {record.doctor.user.lastName}
                  </td>
                  <td className="max-w-[260px] px-5 py-4 text-slate-700">
                    <p className="line-clamp-2">
                      {record.diagnosis ?? (
                        <span className="text-slate-400">Not yet recorded</span>
                      )}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <RecordStatusBadge status={record.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RecordsPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading records..." />}>
      <RecordsView />
    </Suspense>
  );
}
