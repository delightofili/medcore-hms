"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/appointments/status-badge";
import { PrescriptionCard } from "@/components/clinical/prescription-card";
import {
  RecordStatusBadge,
  RecordSummary,
} from "@/components/clinical/record-summary";
import { formatDate, formatTime, humanize } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Appointment } from "@/types/appointment";
import type { UserRole } from "@/types/auth";
import type { MedicalRecord, Prescription } from "@/types/clinical";
import type { Paginated } from "@/types/common";

const CLINICAL_VIEW_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "NURSE",
];

type Tab = "clinical" | "visits";

export function PatientHistory({
  hospitalId,
  patientId,
}: {
  hospitalId: string;
  patientId: string;
}) {
  const { user, authRequest } = useAuth();
  const canSeeClinical = Boolean(
    user && CLINICAL_VIEW_ROLES.includes(user.role),
  );

  const [tab, setTab] = useState<Tab>(canSeeClinical ? "clinical" : "visits");
  const [visits, setVisits] = useState<Appointment[] | null>(null);
  const [records, setRecords] = useState<MedicalRecord[] | null>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const base = `/hospitals/${hospitalId}`;

    authRequest<Paginated<Appointment>>(
      `${base}/appointments?patientId=${patientId}&limit=50`,
    )
      .then((data) => setVisits([...data.items].reverse())) // newest first
      .catch((err: Error) => setError(err.message));

    if (!canSeeClinical) return;

    // Two requests in parallel: records, and every prescription for this patient.
    Promise.all([
      authRequest<Paginated<MedicalRecord>>(
        `${base}/medical-records?patientId=${patientId}&limit=50`,
      ),
      authRequest<Paginated<Prescription>>(
        `${base}/prescriptions?patientId=${patientId}&limit=100`,
      ),
    ])
      .then(([recordData, prescriptionData]) => {
        setRecords(recordData.items);
        setPrescriptions(prescriptionData.items);
      })
      .catch((err: Error) => setError(err.message));
  }, [hospitalId, patientId, canSeeClinical, authRequest]);

  // Group prescriptions under the record they came from, once, instead of filtering per record.
  const prescriptionsByRecord = useMemo(() => {
    const map = new Map<string, Prescription[]>();
    for (const prescription of prescriptions) {
      if (!prescription.medicalRecordId) continue;
      const list = map.get(prescription.medicalRecordId) ?? [];
      list.push(prescription);
      map.set(prescription.medicalRecordId, list);
    }
    return map;
  }, [prescriptions]);

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    ...(canSeeClinical
      ? [
          {
            key: "clinical" as const,
            label: "Clinical history",
            count: records?.length,
          },
        ]
      : []),
    { key: "visits", label: "Visits", count: visits?.length },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div role="tablist" className="flex gap-1 border-b border-slate-200 px-4">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 px-3 py-3 text-sm font-medium transition ${
              tab === item.key
                ? "border-red-600 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="ml-1.5 text-xs text-slate-400">
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-6">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {tab === "clinical" &&
          (records === null ? (
            <p className="text-sm text-slate-500">Loading history...</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-500">
              No consultation records yet.
            </p>
          ) : (
            <ol className="space-y-6">
              {records.map((record) => (
                <li
                  key={record.id}
                  className="relative border-l-2 border-slate-200 pl-5"
                >
                  <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-red-600" />
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(record.createdAt)}
                    </p>
                    <span className="text-sm text-slate-500">
                      Dr {record.doctor.user.firstName}{" "}
                      {record.doctor.user.lastName}
                    </span>
                    <RecordStatusBadge status={record.status} />
                    {record.appointmentId && (
                      <Link
                        href={`/dashboard/appointments/${record.appointmentId}/consult`}
                        className="text-xs font-medium text-red-600 hover:text-red-700"
                      >
                        Open
                      </Link>
                    )}
                  </div>

                  <div className="mt-3">
                    <RecordSummary record={record} />
                  </div>

                  {(prescriptionsByRecord.get(record.id) ?? []).length > 0 && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {prescriptionsByRecord
                        .get(record.id)!
                        .map((prescription) => (
                          <PrescriptionCard
                            key={prescription.id}
                            prescription={prescription}
                          />
                        ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ))}

        {tab === "visits" &&
          (visits === null ? (
            <p className="text-sm text-slate-500">Loading visits...</p>
          ) : visits.length === 0 ? (
            <p className="text-sm text-slate-500">No appointments yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visits.map((visit) => (
                <li
                  key={visit.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDate(visit.appointmentAt)} ·{" "}
                      {formatTime(visit.appointmentAt)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Dr {visit.doctor.user.lastName} ·{" "}
                      {visit.reason ?? humanize(visit.type)}
                    </p>
                  </div>
                  <StatusBadge status={visit.status} />
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}
