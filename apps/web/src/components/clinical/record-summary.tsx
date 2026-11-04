import { formatDate } from "@/lib/format";
import type { MedicalRecord } from "@/types/clinical";
import { TEXT_FIELDS, VITALS } from "./vitals";

export function RecordStatusBadge({
  status,
}: {
  status: MedicalRecord["status"];
}) {
  const signed = status === "SIGNED";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        signed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
      }`}
    >
      {signed ? "Signed" : "Draft"}
    </span>
  );
}

export function RecordSummary({ record }: { record: MedicalRecord }) {
  const recordedVitals = VITALS.filter((vital) => record[vital.key] !== null);
  const bloodPressure =
    record.bloodPressureSystolic && record.bloodPressureDiastolic
      ? `${record.bloodPressureSystolic}/${record.bloodPressureDiastolic}`
      : null;

  return (
    <div className="space-y-5">
      {recordedVitals.length > 0 && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {bloodPressure && (
            <div className="rounded-xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">Blood pressure</dt>
              <dd className="mt-0.5 font-semibold text-slate-900">
                {bloodPressure}{" "}
                <span className="text-xs font-normal text-slate-500">mmHg</span>
              </dd>
            </div>
          )}
          {recordedVitals
            .filter((vital) => !vital.key.startsWith("bloodPressure"))
            .map((vital) => (
              <div key={vital.key} className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-slate-500">{vital.label}</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {Number(record[vital.key])}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    {vital.unit}
                  </span>
                </dd>
              </div>
            ))}
        </dl>
      )}

      <dl className="space-y-4">
        {TEXT_FIELDS.filter((field) => record[field.key]).map((field) => (
          <div key={field.key}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {field.label}
            </dt>
            <dd className="mt-1 whitespace-pre-line text-sm text-slate-800">
              {record[field.key]}
            </dd>
          </div>
        ))}
      </dl>

      {record.signedAt && (
        <p className="text-xs text-slate-500">
          Signed by Dr {record.doctor.user.firstName}{" "}
          {record.doctor.user.lastName} on {formatDate(record.signedAt)}
        </p>
      )}
    </div>
  );
}
